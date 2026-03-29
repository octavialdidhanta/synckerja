-- Drop OTP attempts table; confirm_email_verification_otp uses only email_verification_tokens.

DROP TABLE IF EXISTS public.email_verification_otp_attempts;

CREATE OR REPLACE FUNCTION public.confirm_email_verification_otp(p_email text, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_email_norm text := lower(trim(coalesce(p_email, '')));
  v_code text;
  v_uid uuid;
  v_row public.email_verification_tokens%ROWTYPE;
BEGIN
  IF length(v_email_norm) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  v_code := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  IF length(v_code) <> 6 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT u.id INTO v_uid
  FROM auth.users u
  WHERE lower(trim(u.email)) = v_email_norm
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT * INTO v_row
  FROM public.email_verification_tokens
  WHERE user_id = v_uid
    AND email_verified = false
    AND expires_at >= now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;

  IF v_row.token <> v_code THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  UPDATE public.email_verification_tokens
  SET email_verified = true, used_at = now()
  WHERE token = v_row.token;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_email_verification_otp(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_email_verification_otp(text, text) TO anon, authenticated;
