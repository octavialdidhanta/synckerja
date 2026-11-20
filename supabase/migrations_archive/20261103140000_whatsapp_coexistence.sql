-- WhatsApp Coexistence: a number used in the WhatsApp Business app and the Cloud API
-- together, onboarded through Embedded Signup.
--
-- 1) whatsapp_messages.source gains 'business_app' for replies typed in the app on the
--    phone (smb_message_echoes) and for business messages imported from history.
-- 2) organization_whatsapp_accounts records how the number was connected and the
--    history / contact sync started right after onboarding.
-- 3) MCP inbox reads count business_app replies as replies by a person.

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_source_chk;
ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_source_chk
  CHECK (source IN ('agent', 'flow_automation', 'system', 'business_app'));

COMMENT ON COLUMN public.whatsapp_messages.source IS
  'agent = sent from Synckerja by a person; flow_automation / system = automatic; business_app = typed in the WhatsApp Business app (Coexistence echo or imported history).';

ALTER TABLE public.organization_whatsapp_accounts
  ADD COLUMN IF NOT EXISTS connection_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS coexistence_onboarded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS contacts_sync_request_id text NULL,
  ADD COLUMN IF NOT EXISTS history_sync_request_id text NULL,
  ADD COLUMN IF NOT EXISTS history_sync_status text NULL,
  ADD COLUMN IF NOT EXISTS history_sync_progress integer NULL,
  ADD COLUMN IF NOT EXISTS history_sync_error text NULL,
  ADD COLUMN IF NOT EXISTS disconnected_reason text NULL;

ALTER TABLE public.organization_whatsapp_accounts
  DROP CONSTRAINT IF EXISTS organization_whatsapp_accounts_connection_mode_chk;
ALTER TABLE public.organization_whatsapp_accounts
  ADD CONSTRAINT organization_whatsapp_accounts_connection_mode_chk
  CHECK (connection_mode IN ('manual', 'embedded_cloud_api', 'coexistence'));

ALTER TABLE public.organization_whatsapp_accounts
  DROP CONSTRAINT IF EXISTS organization_whatsapp_accounts_history_sync_status_chk;
ALTER TABLE public.organization_whatsapp_accounts
  ADD CONSTRAINT organization_whatsapp_accounts_history_sync_status_chk
  CHECK (history_sync_status IS NULL OR history_sync_status IN ('requested', 'running', 'done', 'declined', 'error'));

COMMENT ON COLUMN public.organization_whatsapp_accounts.connection_mode IS
  'manual = IDs and token pasted in the form; embedded_cloud_api = Embedded Signup, number on Cloud API only; coexistence = Embedded Signup, number also stays in the WhatsApp Business app.';
COMMENT ON COLUMN public.organization_whatsapp_accounts.history_sync_status IS
  'Coexistence history import: requested after onboarding, running while history webhooks arrive, done at phase 2 100%, declined when the business did not share history, error when the sync request failed.';

CREATE OR REPLACE FUNCTION public.mcp_inbox_period_messages(
  p_organization_id uuid,
  p_employee_id uuid,
  p_channel text,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  conversation_id uuid,
  channel text,
  message_id uuid,
  direction text,
  is_human_reply boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.conversation_id, 'instagram'::text, m.id, m.direction, m.direction = 'outbound', m.created_at
  FROM public.instagram_messages m
  JOIN public.instagram_conversations c ON c.id = m.conversation_id
  WHERE c.organization_id = p_organization_id
    AND (p_channel IS NULL OR p_channel = 'instagram')
    AND (p_employee_id IS NULL OR c.assignee_id = p_employee_id)
    AND m.created_at >= p_from AND m.created_at < p_to

  UNION ALL

  SELECT m.conversation_id, 'facebook'::text, m.id, m.direction, m.direction = 'outbound', m.created_at
  FROM public.facebook_messages m
  JOIN public.facebook_conversations c ON c.id = m.conversation_id
  WHERE c.organization_id = p_organization_id
    AND (p_channel IS NULL OR p_channel = 'facebook')
    AND (p_employee_id IS NULL OR c.assignee_id = p_employee_id)
    AND m.created_at >= p_from AND m.created_at < p_to

  UNION ALL

  SELECT m.conversation_id, 'whatsapp'::text, m.id, m.direction,
         m.direction = 'outbound' AND COALESCE(m.source, 'agent') IN ('agent', 'business_app'), m.created_at
  FROM public.whatsapp_messages m
  JOIN public.whatsapp_conversations c ON c.id = m.conversation_id
  WHERE c.organization_id = p_organization_id
    AND COALESCE(c.channel, 'whatsapp') = 'whatsapp'
    AND (p_channel IS NULL OR p_channel = 'whatsapp')
    AND (p_employee_id IS NULL OR c.assignee_id = p_employee_id)
    AND m.created_at >= p_from AND m.created_at < p_to;
$$;

CREATE OR REPLACE FUNCTION public.mcp_inbox_messages(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_channel text,
  p_conversation_id uuid,
  p_limit integer
)
RETURNS TABLE (
  message_id uuid,
  direction text,
  sent_by text,
  message_type text,
  body text,
  has_media boolean,
  reply_to_body text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel text;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  PERFORM public.mcp_inbox_assert_member(p_user_id, p_organization_id);
  v_channel := public.mcp_inbox_check_channel(p_channel);
  IF v_channel IS NULL OR p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.mcp_inbox_conversation_base(p_organization_id, p_employee_id, v_channel) b
    WHERE b.conversation_id = p_conversation_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_channel = 'instagram' THEN
    RETURN QUERY
    SELECT x.* FROM (
      SELECT m.id, m.direction,
             CASE WHEN m.direction = 'inbound' THEN 'customer' ELSE 'agent' END,
             m.message_type, left(m.body, 2000), m.media_url IS NOT NULL,
             left(m.reply_to_body, 300), m.created_at
      FROM public.instagram_messages m
      WHERE m.conversation_id = p_conversation_id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT v_limit
    ) x ORDER BY x.created_at ASC, x.id ASC;
  ELSIF v_channel = 'facebook' THEN
    RETURN QUERY
    SELECT x.* FROM (
      SELECT m.id, m.direction,
             CASE WHEN m.direction = 'inbound' THEN 'customer' ELSE 'agent' END,
             m.message_type, left(m.body, 2000), m.media_url IS NOT NULL,
             left(m.reply_to_body, 300), m.created_at
      FROM public.facebook_messages m
      WHERE m.conversation_id = p_conversation_id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT v_limit
    ) x ORDER BY x.created_at ASC, x.id ASC;
  ELSE
    RETURN QUERY
    SELECT x.* FROM (
      SELECT m.id, m.direction,
             CASE WHEN m.direction = 'inbound' THEN 'customer'
                  WHEN COALESCE(m.source, 'agent') IN ('agent', 'business_app') THEN 'agent'
                  ELSE 'automation' END,
             m.message_type, left(m.body, 2000), m.media_url IS NOT NULL,
             left(m.reply_to_body, 300), m.created_at
      FROM public.whatsapp_messages m
      WHERE m.conversation_id = p_conversation_id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT v_limit
    ) x ORDER BY x.created_at ASC, x.id ASC;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
