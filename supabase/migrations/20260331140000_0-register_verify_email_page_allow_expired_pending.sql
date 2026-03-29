-- Allow /verify-email while there is any unused, unverified token row — including when
-- expires_at is in the past — so users can stay on the page and use "Resend email"
-- to issue a fresh token. Consumed rows (email_verified = true, used_at set) still fail the check.

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
  );
END;
$$;
