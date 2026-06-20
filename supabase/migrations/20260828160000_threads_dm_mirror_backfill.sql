-- Backfill threads_dm_messages from instagram_messages for linked conversations
-- (fixes preview/message desync after aggressive routing).

INSERT INTO public.threads_dm_messages (
  conversation_id,
  direction,
  platform_message_id,
  body,
  message_type,
  media_url,
  raw_metadata,
  status,
  status_updated_at,
  reply_to_platform_message_id,
  reply_to_body,
  reply_to_message_type,
  created_at
)
SELECT
  tdc.id,
  im.direction,
  im.platform_message_id,
  im.body,
  im.message_type,
  im.media_url,
  im.raw_metadata,
  im.status,
  im.status_updated_at,
  im.reply_to_platform_message_id,
  im.reply_to_body,
  im.reply_to_message_type,
  im.created_at
FROM public.instagram_messages im
JOIN public.instagram_conversations ic ON ic.id = im.conversation_id
JOIN public.organization_instagram_accounts a
  ON a.organization_id = ic.organization_id
 AND a.instagram_business_account_id = ic.instagram_business_account_id
 AND a.has_threads = true
 AND a.threads_user_id IS NOT NULL
JOIN public.threads_dm_conversations tdc
  ON (
    tdc.instagram_conversation_id = ic.id
    OR (
      tdc.organization_id = ic.organization_id
      AND tdc.threads_user_id = a.threads_user_id
      AND tdc.customer_participant_id = ic.customer_ig_id
    )
  )
WHERE im.platform_message_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.threads_dm_messages tm
    WHERE tm.conversation_id = tdc.id
      AND tm.platform_message_id = im.platform_message_id
  );

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
    im.created_at AS last_message_at,
    LEFT(im.body, 200) AS last_message_body,
    im.direction AS last_message_direction,
    im.status AS last_message_status,
    CASE WHEN im.direction = 'inbound' THEN im.created_at ELSE tdc.last_inbound_at END AS last_inbound_at
  FROM public.threads_dm_conversations tdc
  JOIN public.threads_dm_messages im ON im.conversation_id = tdc.id
  ORDER BY tdc.id, im.created_at DESC
) src
WHERE tdc.id = src.conv_id;
