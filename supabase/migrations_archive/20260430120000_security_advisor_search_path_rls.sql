-- Security Advisor follow-up (Supabase linter):
-- 1) Function search path: empty search_path + pg_catalog-qualified calls (stricter than SET search_path = public).
-- 2) email_verification_tokens: drop legacy permissive policies (USING true) if still present; keep SELECT own-row only.
-- 3) Leaked password protection: enable in Supabase Dashboard → Authentication → Attack Protection (not expressible in SQL here).

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

-- Legacy names from 20260328120000; hardened name from 20260328130000
DROP POLICY IF EXISTS "email_verification_tokens_select" ON public.email_verification_tokens;
DROP POLICY IF EXISTS "email_verification_tokens_update" ON public.email_verification_tokens;
DROP POLICY IF EXISTS "email_verification_tokens_insert" ON public.email_verification_tokens;

DROP POLICY IF EXISTS "email_verification_tokens_select_own" ON public.email_verification_tokens;

CREATE POLICY "email_verification_tokens_select_own"
  ON public.email_verification_tokens
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
