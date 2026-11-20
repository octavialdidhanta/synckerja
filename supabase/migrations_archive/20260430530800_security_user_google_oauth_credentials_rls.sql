-- Security Advisor: RLS enabled on user_google_oauth_credentials with no policies.
-- Authenticated users may only access their own row. Edge Functions use the service role and bypass RLS.
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

DROP POLICY IF EXISTS "user_google_oauth_credentials_own" ON public.user_google_oauth_credentials;
CREATE POLICY "user_google_oauth_credentials_own"
  ON public.user_google_oauth_credentials
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.user_google_oauth_credentials IS
  'Google OAuth tokens per user. RLS: authenticated may only access own row; Edge Functions typically use the service role.';
