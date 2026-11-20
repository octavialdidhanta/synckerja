-- Align facebook + threads conversation tables with whatsapp_conversations follow-up columns
-- (required by sales.ts livechat virtual leads merge).

ALTER TABLE public.facebook_conversations
  ADD COLUMN IF NOT EXISTS followup INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fu_priority TEXT;

COMMENT ON COLUMN public.facebook_conversations.followup IS
  'Number of follow-up updates for this Messenger conversation in Leads Management.';
COMMENT ON COLUMN public.facebook_conversations.fu_priority IS
  'Follow-up priority (Low/Medium/High/Please Follow Up) for Messenger conversations.';

ALTER TABLE public.threads_conversations
  ADD COLUMN IF NOT EXISTS followup INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fu_priority TEXT;

COMMENT ON COLUMN public.threads_conversations.followup IS
  'Number of follow-up updates for this Threads conversation in Leads Management.';
COMMENT ON COLUMN public.threads_conversations.fu_priority IS
  'Follow-up priority (Low/Medium/High/Please Follow Up) for Threads conversations.';

-- Backfill dedicated Threads webhook verify token from IG verify_token when missing.
UPDATE public.organization_instagram_accounts
SET threads_verify_token = verify_token
WHERE has_threads = true
  AND is_active = true
  AND verify_token IS NOT NULL
  AND TRIM(verify_token) <> ''
  AND (threads_verify_token IS NULL OR TRIM(threads_verify_token) = '');
