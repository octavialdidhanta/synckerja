-- Instagram DM thread UX: read_at + unread RPCs (mirror facebook_messages / whatsapp_messages).

ALTER TABLE public.instagram_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

COMMENT ON COLUMN public.instagram_messages.read_at IS
  'When an agent opened/read inbound message in livechat; NULL = unread.';

CREATE OR REPLACE FUNCTION public.get_instagram_unread_counts(p_organization_id UUID)
RETURNS TABLE(conversation_id UUID, unread_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id AS conversation_id, COUNT(m.id)::BIGINT AS unread_count
  FROM public.instagram_conversations c
  LEFT JOIN public.instagram_messages m
    ON m.conversation_id = c.id
    AND m.direction = 'inbound'
    AND m.read_at IS NULL
  WHERE c.organization_id = p_organization_id
  GROUP BY c.id;
$$;

CREATE OR REPLACE FUNCTION public.mark_instagram_conversation_read(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.instagram_messages
  SET read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND direction = 'inbound'
    AND read_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.instagram_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = instagram_messages.conversation_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_instagram_unread_counts(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_instagram_conversation_read(UUID) TO authenticated, service_role;
