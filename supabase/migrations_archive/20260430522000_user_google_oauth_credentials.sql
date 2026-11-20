-- Per-user Google OAuth tokens (Drive, etc.). Access only via service role (Edge Functions), not from the browser.

CREATE TABLE IF NOT EXISTS public.user_google_oauth_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  refresh_token text,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_google_oauth_credentials_updated_at_idx
  ON public.user_google_oauth_credentials (updated_at DESC);

ALTER TABLE public.user_google_oauth_credentials ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.user_google_oauth_credentials IS
  'Google OAuth tokens per user; read/write only with service role (e.g. Edge Functions).';
