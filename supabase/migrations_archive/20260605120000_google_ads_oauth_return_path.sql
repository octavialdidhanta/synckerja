-- Store optional post-OAuth redirect path (digital marketing vs omnichannel settings).
ALTER TABLE public.google_ads_oauth_states
  ADD COLUMN IF NOT EXISTS return_path text NULL;

COMMENT ON COLUMN public.google_ads_oauth_states.return_path IS
  'App path to redirect after OAuth callback (allowlisted in google-ads-oauth-callback).';
