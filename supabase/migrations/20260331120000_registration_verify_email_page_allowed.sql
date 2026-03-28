-- Gate /verify-email: allow only when user+email match and there is an active pending OTP row
-- (email_verified = false, used_at IS NULL). Rows with email_verified = true and used_at set
-- do not satisfy that predicate; once the latest pending row is consumed, access is denied.

CREATE OR REPLACE FUNCTION public.registration_verify_email_page_allowed(p_user_id uuid, p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_user_id
      AND lower(trim(u.email)) = lower(trim(p_email))
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.email_verification_tokens t
    WHERE t.user_id = p_user_id
      AND t.email_verified = false
      AND t.used_at IS NULL
      AND t.expires_at >= now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registration_verify_email_page_allowed(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registration_verify_email_page_allowed(uuid, text) TO anon, authenticated;
