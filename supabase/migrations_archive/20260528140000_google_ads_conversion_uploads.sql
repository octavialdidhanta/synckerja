-- Log Google Ads offline conversion uploads when a lead becomes Converted (idempotent per lead).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS gclid text NULL;

COMMENT ON COLUMN public.leads.gclid IS 'Google Click ID captured at lead creation (Google Ads offline conversion).';

CREATE TABLE IF NOT EXISTS public.google_ads_conversion_uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  sales_activity_id uuid NULL,
  gclid text NULL,
  status text NOT NULL,
  skip_reason text NULL,
  error_message text NULL,
  google_ads_partial_failure jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_ads_conversion_uploads_pkey PRIMARY KEY (id),
  CONSTRAINT google_ads_conversion_uploads_lead_id_key UNIQUE (lead_id),
  CONSTRAINT google_ads_conversion_uploads_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT google_ads_conversion_uploads_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE CASCADE,
  CONSTRAINT google_ads_conversion_uploads_sales_activity_id_fkey
    FOREIGN KEY (sales_activity_id) REFERENCES public.sales_activities (id) ON DELETE SET NULL,
  CONSTRAINT google_ads_conversion_uploads_status_check
    CHECK (status IN ('success', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_google_ads_conversion_uploads_org_created
  ON public.google_ads_conversion_uploads (organization_id, created_at DESC);

COMMENT ON TABLE public.google_ads_conversion_uploads IS
  'Audit log for Google Ads offline conversion uploads triggered on CRM Converted status.';

ALTER TABLE public.google_ads_conversion_uploads ENABLE ROW LEVEL SECURITY;

-- Authenticated users: read uploads for their active organization only.
DROP POLICY IF EXISTS google_ads_conversion_uploads_select_org ON public.google_ads_conversion_uploads;
CREATE POLICY google_ads_conversion_uploads_select_org
  ON public.google_ads_conversion_uploads
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
  );

-- Writes only via service role (Edge Function).
DROP POLICY IF EXISTS google_ads_conversion_uploads_block_authenticated_writes ON public.google_ads_conversion_uploads;
CREATE POLICY google_ads_conversion_uploads_block_authenticated_writes
  ON public.google_ads_conversion_uploads
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
