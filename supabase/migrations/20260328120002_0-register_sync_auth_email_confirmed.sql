-- Custom verification (email_verification_tokens) did not update auth.users.email_confirmed_at,
-- so signInWithPassword still failed with "email not confirmed" while the app showed success.

CREATE OR REPLACE FUNCTION public.sync_auth_email_on_token_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.email_verified IS TRUE AND (OLD.email_verified IS DISTINCT FROM TRUE) THEN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_auth_email_on_token_verified() FROM PUBLIC;

DROP TRIGGER IF EXISTS email_verification_tokens_sync_auth_email ON public.email_verification_tokens;
CREATE TRIGGER email_verification_tokens_sync_auth_email
  AFTER UPDATE OF email_verified ON public.email_verification_tokens
  FOR EACH ROW
  WHEN (NEW.email_verified = true AND (OLD.email_verified IS DISTINCT FROM true))
  EXECUTE FUNCTION public.sync_auth_email_on_token_verified();

-- One-time backfill: users already marked verified in app but still blocked at login
UPDATE auth.users u
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE u.email_confirmed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.email_verification_tokens t
    WHERE t.user_id = u.id AND t.email_verified = true
  );
