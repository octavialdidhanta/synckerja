-- Legacy livechat hook calls get_threads_conversations_with_preview; proxy to DM RPC so
-- production frontend shows threads_dm rows without waiting for a new deploy.

DROP FUNCTION IF EXISTS public.get_threads_conversations_with_preview(uuid);

CREATE FUNCTION public.get_threads_conversations_with_preview(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  customer_threads_id text,
  customer_name text,
  root_media_id text,
  last_message_at timestamptz,
  last_message_body text,
  last_message_direction text,
  last_message_status text,
  lead_status_id uuid,
  lead_status_name text,
  threads_user_id text,
  threads_account_display_name text,
  ticket_id text,
  assignee_id uuid,
  meta_session_expires_at timestamptz,
  last_inbound_at timestamptz,
  conversation_origin text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dm.id,
    dm.organization_id,
    dm.customer_threads_id,
    dm.customer_name,
    NULL::text AS root_media_id,
    dm.last_message_at,
    dm.last_message_body,
    dm.last_message_direction,
    dm.last_message_status,
    dm.lead_status_id,
    dm.lead_status_name,
    dm.threads_user_id,
    dm.threads_account_display_name,
    dm.ticket_id,
    dm.assignee_id,
    dm.meta_session_expires_at,
    dm.last_inbound_at,
    dm.conversation_origin,
    dm.created_at,
    dm.updated_at
  FROM public.get_threads_dm_conversations_with_preview(p_organization_id) dm;
$$;

COMMENT ON FUNCTION public.get_threads_conversations_with_preview(uuid) IS
  'Legacy alias — proxies to get_threads_dm_conversations_with_preview for Threads DM livechat.';

GRANT EXECUTE ON FUNCTION public.get_threads_conversations_with_preview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_threads_conversations_with_preview(uuid) TO service_role;
