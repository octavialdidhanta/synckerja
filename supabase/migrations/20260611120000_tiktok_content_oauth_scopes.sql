-- Store granted OAuth scopes per TikTok Content token (for comment moderation re-auth prompts).

ALTER TABLE public.organization_tiktok_content_connection_tokens
  ADD COLUMN IF NOT EXISTS oauth_scopes text NULL;

COMMENT ON COLUMN public.organization_tiktok_content_connection_tokens.oauth_scopes IS
  'Comma-separated OAuth scopes granted at last token exchange/refresh.';
