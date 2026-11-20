-- Livechat: one row per Meta message id per conversation (Messenger + Instagram).
--
-- Echo events (replies typed in the Facebook / Instagram apps) are now stored as outbound
-- messages. Messages sent from Synckerja also echo back, and the echo can arrive while
-- send-*-message is still inserting the same platform_message_id. This index makes the second
-- insert fail (23505) instead of creating a duplicate; both writers already handle that.
-- The same mid can still exist in two conversations (a DM between two connected inboxes is
-- outbound in one and inbound in the other).

CREATE UNIQUE INDEX IF NOT EXISTS uq_facebook_messages_conversation_platform_mid
  ON public.facebook_messages (conversation_id, platform_message_id)
  WHERE platform_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_instagram_messages_conversation_platform_mid
  ON public.instagram_messages (conversation_id, platform_message_id)
  WHERE platform_message_id IS NOT NULL;
