-- Route @vialdi_wedding IG account DMs to Threads inbox (TH-*); @octa.vialdi stays Instagram-only.
-- Meta has no separate Threads DM API — this split uses per-account webhook entry id.

UPDATE public.organization_instagram_accounts
SET threads_dm_inbox_primary = false
WHERE has_threads = true;

UPDATE public.organization_instagram_accounts
SET threads_dm_inbox_primary = true
WHERE LOWER(TRIM(COALESCE(instagram_username, ''))) = 'vialdi_wedding';

COMMENT ON COLUMN public.organization_instagram_accounts.threads_dm_inbox_primary IS
  'When true (and has_threads), messaging on this IG business account entry routes exclusively to Threads DM inbox (TH-*), not instagram_conversations. Use for the brand Threads profile linked account (e.g. @vialdi_wedding).';
