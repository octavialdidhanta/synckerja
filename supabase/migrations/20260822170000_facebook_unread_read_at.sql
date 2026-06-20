-- Messenger thread UX: read_at + unread RPCs (mirror whatsapp_messages).

ALTER TABLE public.facebook_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.get_facebook_unread_counts(p_organization_id UUID)
RETURNS TABLE(conversation_id UUID, unread_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id AS conversation_id, COUNT(m.id)::BIGINT AS unread_count
  FROM public.facebook_conversations c
  LEFT JOIN public.facebook_messages m
    ON m.conversation_id = c.id
    AND m.direction = 'inbound'
    AND m.read_at IS NULL
  WHERE c.organization_id = p_organization_id
  GROUP BY c.id;
$$;

CREATE OR REPLACE FUNCTION public.mark_facebook_conversation_read(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.facebook_messages
  SET read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND direction = 'inbound'
    AND read_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.facebook_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = facebook_messages.conversation_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_facebook_unread_counts(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_facebook_conversation_read(UUID) TO authenticated, service_role;

-- Message body search (mirror search_whatsapp_messages).
CREATE OR REPLACE FUNCTION public.search_facebook_messages(
  p_organization_id UUID,
  p_search TEXT
)
RETURNS TABLE (
  conversation_id UUID,
  message_id UUID,
  body TEXT,
  created_at TIMESTAMPTZ,
  direction TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS conversation_id,
    m.id AS message_id,
    LEFT(m.body, 300) AS body,
    m.created_at,
    m.direction::TEXT
  FROM public.facebook_conversations c
  INNER JOIN public.facebook_messages m ON m.conversation_id = c.id
  WHERE c.organization_id = p_organization_id
    AND p_search IS NOT NULL
    AND length(trim(p_search)) > 0
    AND m.body IS NOT NULL
    AND m.body ILIKE '%' || trim(p_search) || '%'
  ORDER BY m.created_at DESC
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.search_facebook_messages(UUID, TEXT) TO authenticated, service_role;
