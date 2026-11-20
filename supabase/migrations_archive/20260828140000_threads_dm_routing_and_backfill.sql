-- Threads DM routing: Meta does not send messaging_product=threads on inbound DMs.
-- Add per-account override + backfill existing IG DMs from linked Threads accounts.

ALTER TABLE public.organization_instagram_accounts
  ADD COLUMN IF NOT EXISTS threads_dm_inbox_primary BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organization_instagram_accounts.threads_dm_inbox_primary IS
  'When true (and has_threads), all messaging on this linked IG account routes to Threads DM inbox (TH-*) instead of instagram_conversations.';

-- Backfill threads_dm from instagram for linked Threads accounts (one-time).
INSERT INTO public.threads_dm_conversations (
  id,
  organization_id,
  threads_user_id,
  customer_participant_id,
  customer_name,
  customer_external_id,
  customer_username,
  conversation_origin,
  instagram_conversation_id,
  last_message_at,
  last_message_body,
  last_message_direction,
  last_message_status,
  lead_status_id,
  first_inbound_at,
  last_inbound_at,
  meta_session_expires_at,
  assignee_id,
  last_handling_assignee_id,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  ic.organization_id,
  a.threads_user_id,
  ic.customer_ig_id,
  ic.customer_name,
  ic.customer_external_id,
  NULLIF(TRIM(BOTH '@' FROM COALESCE(ic.customer_name, '')), ''),
  'threads_app',
  ic.id,
  ic.last_message_at,
  ic.last_message_body,
  ic.last_message_direction,
  ic.last_message_status,
  ic.lead_status_id,
  ic.first_inbound_at,
  ic.last_inbound_at,
  ic.last_inbound_at + INTERVAL '24 hours',
  ic.assignee_id,
  ic.last_handling_assignee_id,
  ic.created_at,
  ic.updated_at
FROM public.instagram_conversations ic
JOIN public.organization_instagram_accounts a
  ON a.organization_id = ic.organization_id
 AND a.instagram_business_account_id = ic.instagram_business_account_id
 AND a.has_threads = true
 AND a.threads_user_id IS NOT NULL
 AND TRIM(a.threads_user_id) <> ''
WHERE NOT EXISTS (
  SELECT 1
  FROM public.threads_dm_conversations tdc
  WHERE tdc.organization_id = ic.organization_id
    AND tdc.threads_user_id = a.threads_user_id
    AND tdc.customer_participant_id = ic.customer_ig_id
);

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
  ON tdc.instagram_conversation_id = ic.id
WHERE im.platform_message_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.threads_dm_messages tm
    WHERE tm.conversation_id = tdc.id
      AND tm.platform_message_id = im.platform_message_id
  );

INSERT INTO public.threads_dm_conversation_cycles (conversation_id, cycle_started_at)
SELECT tdc.id, COALESCE(tdc.first_inbound_at, tdc.created_at, NOW())
FROM public.threads_dm_conversations tdc
WHERE NOT EXISTS (
  SELECT 1 FROM public.threads_dm_conversation_cycles c WHERE c.conversation_id = tdc.id
);
