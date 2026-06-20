-- Remove Instagram-mirrored rows from Threads DM inbox (channels must stay separate).

-- 1) Delete threads_dm messages that duplicate an Instagram message on the linked conversation.
DELETE FROM public.threads_dm_messages tm
USING public.threads_dm_conversations tdc, public.instagram_messages im
WHERE tm.conversation_id = tdc.id
  AND tdc.instagram_conversation_id IS NOT NULL
  AND im.conversation_id = tdc.instagram_conversation_id
  AND im.platform_message_id IS NOT NULL
  AND tm.platform_message_id = im.platform_message_id;

-- 2) Also remove backfill duplicates matched by org + customer + platform_message_id (no link column).
DELETE FROM public.threads_dm_messages tm
USING public.threads_dm_conversations tdc,
      public.instagram_conversations ic,
      public.instagram_messages im
WHERE tm.conversation_id = tdc.id
  AND ic.organization_id = tdc.organization_id
  AND ic.customer_ig_id = tdc.customer_participant_id
  AND im.conversation_id = ic.id
  AND im.platform_message_id IS NOT NULL
  AND tm.platform_message_id = im.platform_message_id;

-- 3) Drop mirror-origin conversations that no longer have any messages.
DELETE FROM public.threads_dm_conversation_cycles cyc
USING public.threads_dm_conversations tdc
WHERE cyc.conversation_id = tdc.id
  AND tdc.instagram_conversation_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.threads_dm_messages m WHERE m.conversation_id = tdc.id
  );

DELETE FROM public.threads_dm_conversations tdc
WHERE tdc.instagram_conversation_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.threads_dm_messages m WHERE m.conversation_id = tdc.id
  );

-- 4) Refresh preview for remaining Threads-only conversations.
UPDATE public.threads_dm_conversations tdc
SET
  last_message_at = src.last_message_at,
  last_message_body = src.last_message_body,
  last_message_direction = src.last_message_direction,
  last_message_status = src.last_message_status,
  last_inbound_at = src.last_inbound_at,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (tdc.id)
    tdc.id AS conv_id,
    m.created_at AS last_message_at,
    LEFT(m.body, 200) AS last_message_body,
    m.direction AS last_message_direction,
    m.status AS last_message_status,
    CASE WHEN m.direction = 'inbound' THEN m.created_at ELSE tdc.last_inbound_at END AS last_inbound_at
  FROM public.threads_dm_conversations tdc
  JOIN public.threads_dm_messages m ON m.conversation_id = tdc.id
  ORDER BY tdc.id, m.created_at DESC
) src
WHERE tdc.id = src.conv_id;
