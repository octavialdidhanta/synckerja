-- Distinguish Login Kit tokens from TikTok Business Organic (tt_user) tokens.

ALTER TABLE public.organization_tiktok_content_connection_tokens
  ADD COLUMN IF NOT EXISTS oauth_token_kind text NOT NULL DEFAULT 'login_kit';

COMMENT ON COLUMN public.organization_tiktok_content_connection_tokens.oauth_token_kind IS
  'login_kit = open.tiktokapis.com OAuth; tt_user = business-api account-holder OAuth (required for comment API).';
