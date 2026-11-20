-- send-confirmation-email can be reached without a user session (signup / resend), so the OTP
-- issuer itself now refuses abuse:
--   * already_verified : the user already confirmed an OTP, do not mail again
--   * rate_limited     : at most 1 code per 60 seconds and 5 per hour per user
-- Real traffic: 2 codes in the last 7 days, max 1 per user, so these limits never touch real users.
-- Everything else (signature, service_role-only gate, token format, 24h expiry) is unchanged.

CREATE OR REPLACE FUNCTION public.issue_new_verification_token(p_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_token text;
  v_expires timestamptz := now() + interval '24 hours';
  v_email_norm text := lower(trim(p_email));
BEGIN
  IF coalesce(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  IF v_email_norm IS NULL OR length(v_email_norm) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_input');
  END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(trim(email)) = v_email_norm LIMIT 1;
  IF v_uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'user_not_found'); END IF;

  IF EXISTS (
    SELECT 1 FROM public.email_verification_tokens t
    WHERE t.user_id = v_uid AND t.email_verified = true
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'already_verified');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.email_verification_tokens t
    WHERE t.user_id = v_uid AND t.created_at > now() - interval '60 seconds'
  ) OR (
    SELECT count(*) FROM public.email_verification_tokens t
    WHERE t.user_id = v_uid AND t.created_at > now() - interval '1 hour'
  ) >= 5 THEN
    RETURN json_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  v_token := public.generate_unique_verification_otp();
  INSERT INTO public.email_verification_tokens (user_id, token, expires_at, email_verified)
  VALUES (v_uid, v_token, v_expires, false);
  RETURN json_build_object('ok', true, 'token', v_token);
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_new_verification_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_new_verification_token(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_new_verification_token(text) TO service_role;
