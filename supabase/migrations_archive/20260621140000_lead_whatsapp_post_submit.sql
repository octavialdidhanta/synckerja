-- Lead confirmation WhatsApp after POST /api/v1/leads (org template + audit columns).

ALTER TABLE public.organization_omnichannel_api_settings
  ADD COLUMN IF NOT EXISTS default_whatsapp_lead_template_name text NULL;

COMMENT ON COLUMN public.organization_omnichannel_api_settings.default_whatsapp_lead_template_name IS
  'Meta-approved WhatsApp template name for automatic lead confirmation after POST /api/v1/leads.';

ALTER TABLE public.organization_omnichannel_api_tokens
  ADD COLUMN IF NOT EXISTS whatsapp_lead_template_name text NULL;

COMMENT ON COLUMN public.organization_omnichannel_api_tokens.whatsapp_lead_template_name IS
  'Optional per-token override for lead confirmation WhatsApp template.';

ALTER TABLE public.lead_submissions
  ADD COLUMN IF NOT EXISTS whatsapp_status text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_message_id text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_skip_reason text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz NULL;

ALTER TABLE public.lead_submissions
  DROP CONSTRAINT IF EXISTS lead_submissions_whatsapp_status_check;

ALTER TABLE public.lead_submissions
  ADD CONSTRAINT lead_submissions_whatsapp_status_check
  CHECK (
    whatsapp_status IS NULL
    OR whatsapp_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])
  );

COMMENT ON COLUMN public.lead_submissions.whatsapp_status IS
  'WhatsApp lead confirmation outcome after POST /api/v1/leads.';
COMMENT ON COLUMN public.lead_submissions.whatsapp_skip_reason IS
  'Why WA was not sent: no_consent, no_phone, no_template, wa_not_configured, etc.';
