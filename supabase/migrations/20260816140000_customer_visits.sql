-- Walk-in store check-in (CS). Separate from client_visits so unmatched
-- rows can exist without a clients FK, and field-sales GPS/attendance stay untouched.

CREATE TABLE IF NOT EXISTS public.customer_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  visit_date date NOT NULL,
  status text NOT NULL DEFAULT 'completed'::text,
  lead_id uuid NULL REFERENCES public.leads (id) ON DELETE SET NULL,
  lookup_kind text NOT NULL,
  lookup_raw text NOT NULL,
  lookup_normalized text NOT NULL,
  match_status text NOT NULL,
  notes text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_visits_pkey PRIMARY KEY (id),
  CONSTRAINT customer_visits_status_check CHECK (
    lower(status) = ANY (ARRAY['completed'::text, 'cancelled'::text])
  ),
  CONSTRAINT customer_visits_lookup_kind_check CHECK (
    lookup_kind = ANY (ARRAY['phone'::text, 'instagram'::text])
  ),
  CONSTRAINT customer_visits_match_status_check CHECK (
    match_status = ANY (ARRAY['matched'::text, 'unmatched'::text])
  ),
  CONSTRAINT customer_visits_matched_lead_check CHECK (
    (match_status = 'matched' AND lead_id IS NOT NULL)
    OR (match_status = 'unmatched' AND lead_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_customer_visits_organization_visit_date
  ON public.customer_visits USING btree (organization_id, visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_customer_visits_org_lead
  ON public.customer_visits USING btree (organization_id, lead_id)
  WHERE lead_id IS NOT NULL;

ALTER TABLE public.customer_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_visits_org_select" ON public.customer_visits;
CREATE POLICY "customer_visits_org_select"
  ON public.customer_visits FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "customer_visits_org_insert" ON public.customer_visits;
CREATE POLICY "customer_visits_org_insert"
  ON public.customer_visits FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "customer_visits_org_update" ON public.customer_visits;
CREATE POLICY "customer_visits_org_update"
  ON public.customer_visits FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "customer_visits_org_delete" ON public.customer_visits;
CREATE POLICY "customer_visits_org_delete"
  ON public.customer_visits FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_customer_visits_updated_at ON public.customer_visits;
CREATE TRIGGER update_customer_visits_updated_at
  BEFORE UPDATE ON public.customer_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.customer_visits IS
  'Store walk-in check-ins. Matched lead_id counts toward Lead Magnet offline visits; unmatched is a shop log only.';
