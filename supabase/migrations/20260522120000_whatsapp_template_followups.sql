-- Livechat 1:1 WhatsApp template follow-ups (audit log; sends via edge function).

CREATE TABLE IF NOT EXISTS public.whatsapp_template_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  whatsapp_conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations (id) ON DELETE CASCADE,
  whatsapp_message_id uuid NULL REFERENCES public.whatsapp_messages (id) ON DELETE SET NULL,
  whatsapp_account_id uuid NOT NULL REFERENCES public.organization_whatsapp_accounts (id) ON DELETE RESTRICT,
  phone_number_id text NOT NULL,
  customer_wa_id text NOT NULL,
  ticket_id text NULL,
  template_name text NOT NULL,
  template_language text NOT NULL,
  template_hsm_id text NULL,
  parameter_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_components_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  send_status text NOT NULL DEFAULT 'sent'
    CHECK (send_status IN ('sent', 'failed')),
  error_message text NULL,
  wa_message_id text NULL,
  sent_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_template_followups_template_name_len CHECK (char_length(trim(template_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_template_followups_org_created
  ON public.whatsapp_template_followups (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_template_followups_conversation
  ON public.whatsapp_template_followups (whatsapp_conversation_id, created_at DESC);

COMMENT ON TABLE public.whatsapp_template_followups IS 'Audit log for livechat 1:1 template follow-up sends (Resolve/Expired); not whatsapp_campaigns.';

ALTER TABLE public.whatsapp_template_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_template_followups_select ON public.whatsapp_template_followups;
CREATE POLICY whatsapp_template_followups_select
  ON public.whatsapp_template_followups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id = whatsapp_template_followups.organization_id
    )
  );
