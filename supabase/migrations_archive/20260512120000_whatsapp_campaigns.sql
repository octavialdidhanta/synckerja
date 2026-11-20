-- WhatsApp template campaigns: blast + scheduled sends (org owner RLS, aligned with recipient lists).

CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES public.organization_whatsapp_accounts (id) ON DELETE RESTRICT,
  recipient_list_id uuid NOT NULL REFERENCES public.whatsapp_recipient_lists (id) ON DELETE RESTRICT,
  name text NOT NULL,
  template_name text NOT NULL,
  template_language text NOT NULL,
  template_hsm_id text NULL,
  template_components_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'scheduled',
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled'
      )
    ),
  scheduled_at timestamptz NULL,
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  last_error text NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_campaigns_name_len CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_org_status_scheduled
  ON public.whatsapp_campaigns (organization_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_org_created
  ON public.whatsapp_campaigns (organization_id, created_at DESC);

COMMENT ON TABLE public.whatsapp_campaigns IS 'WhatsApp Cloud API template blast; scheduled_at set for Send later; worker processes recipients in batches.';

CREATE OR REPLACE FUNCTION public.update_whatsapp_campaigns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_campaigns_updated_at ON public.whatsapp_campaigns;
CREATE TRIGGER trg_whatsapp_campaigns_updated_at
  BEFORE UPDATE ON public.whatsapp_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_campaigns_updated_at();

CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.whatsapp_campaigns (id) ON DELETE CASCADE,
  list_member_id uuid NOT NULL REFERENCES public.whatsapp_recipient_list_members (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  parameter_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  send_status text NOT NULL DEFAULT 'pending'
    CHECK (send_status IN ('pending', 'sent', 'failed', 'skipped')),
  wa_message_id text NULL,
  error_detail text NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_campaign_recipients_phone_len CHECK (char_length(trim(phone_e164)) >= 8)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_campaign_recipients_campaign_member
  ON public.whatsapp_campaign_recipients (campaign_id, list_member_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_recipients_campaign_status
  ON public.whatsapp_campaign_recipients (campaign_id, send_status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_recipients_org
  ON public.whatsapp_campaign_recipients (organization_id);

COMMENT ON TABLE public.whatsapp_campaign_recipients IS 'Per-recipient template parameters and Meta send outcome; phone_e164 snapshot at campaign creation.';

CREATE OR REPLACE FUNCTION public.update_whatsapp_campaign_recipients_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_campaign_recipients_updated_at ON public.whatsapp_campaign_recipients;
CREATE TRIGGER trg_whatsapp_campaign_recipients_updated_at
  BEFORE UPDATE ON public.whatsapp_campaign_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_campaign_recipients_updated_at();

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_campaigns_select ON public.whatsapp_campaigns;
CREATE POLICY whatsapp_campaigns_select
  ON public.whatsapp_campaigns FOR SELECT
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_campaigns.organization_id
    )
  );

DROP POLICY IF EXISTS whatsapp_campaigns_insert ON public.whatsapp_campaigns;
CREATE POLICY whatsapp_campaigns_insert
  ON public.whatsapp_campaigns FOR INSERT
  WITH CHECK (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_campaigns.organization_id
    )
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS whatsapp_campaigns_update ON public.whatsapp_campaigns;
CREATE POLICY whatsapp_campaigns_update
  ON public.whatsapp_campaigns FOR UPDATE
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_campaigns.organization_id
    )
  )
  WITH CHECK (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_campaigns.organization_id
    )
  );

DROP POLICY IF EXISTS whatsapp_campaigns_delete ON public.whatsapp_campaigns;
CREATE POLICY whatsapp_campaigns_delete
  ON public.whatsapp_campaigns FOR DELETE
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_campaigns.organization_id
    )
  );

DROP POLICY IF EXISTS whatsapp_campaign_recipients_select ON public.whatsapp_campaign_recipients;
CREATE POLICY whatsapp_campaign_recipients_select
  ON public.whatsapp_campaign_recipients FOR SELECT
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_campaign_recipients.organization_id
    )
  );

DROP POLICY IF EXISTS whatsapp_campaign_recipients_insert ON public.whatsapp_campaign_recipients;
CREATE POLICY whatsapp_campaign_recipients_insert
  ON public.whatsapp_campaign_recipients FOR INSERT
  WITH CHECK (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_campaign_recipients.organization_id
    )
  );

DROP POLICY IF EXISTS whatsapp_campaign_recipients_update ON public.whatsapp_campaign_recipients;
CREATE POLICY whatsapp_campaign_recipients_update
  ON public.whatsapp_campaign_recipients FOR UPDATE
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_campaign_recipients.organization_id
    )
  )
  WITH CHECK (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_campaign_recipients.organization_id
    )
  );

DROP POLICY IF EXISTS whatsapp_campaign_recipients_delete ON public.whatsapp_campaign_recipients;
CREATE POLICY whatsapp_campaign_recipients_delete
  ON public.whatsapp_campaign_recipients FOR DELETE
  USING (
    public.user_is_org_owner(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_campaign_recipients.organization_id
    )
  );
