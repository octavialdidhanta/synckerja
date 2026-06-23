-- Separate Login Kit tokens for Content Posting API (open.tiktokapis.com).
-- Business tt_user tokens are used for comments/insights; publish needs Login Kit exchange.

ALTER TABLE public.organization_tiktok_content_connection_tokens
  ADD COLUMN IF NOT EXISTS publish_access_token_enc text NULL,
  ADD COLUMN IF NOT EXISTS publish_refresh_token_enc text NULL,
  ADD COLUMN IF NOT EXISTS publish_access_token_expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS publish_oauth_scopes text NULL;

COMMENT ON COLUMN public.organization_tiktok_content_connection_tokens.publish_access_token_enc IS
  'Login Kit access token for Content Posting API (video.publish on open.tiktokapis.com).';

ALTER TABLE public.tiktok_content_oauth_states
  ADD COLUMN IF NOT EXISTS oauth_purpose text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS target_open_id text NULL;

COMMENT ON COLUMN public.tiktok_content_oauth_states.oauth_purpose IS
  'full = business + optional login_kit; publish = login_kit only for Content Posting API.';

COMMENT ON COLUMN public.tiktok_content_oauth_states.target_open_id IS
  'When oauth_purpose=publish, update publish_* tokens on this business open_id row.';
