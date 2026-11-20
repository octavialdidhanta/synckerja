-- Harden signup email verification against brute force.
--
-- Problem: verification tokens are 6-digit codes. Two anon-callable RPCs accepted them
-- with no attempt limit:
--   * confirm_email_verification(p_token)          -- token only, no email binding
--   * confirm_email_verification_otp(p_email, p_code)
-- Anyone could loop 000000..999999 and mark another person's pending signup as verified.
-- get_verification_token_snapshot(p_token) additionally returned the user_id for a guessed code.
--
-- Fix:
--   1. confirm_email_verification_otp: max 5 wrong codes per token (token is then expired),
--      and max 20 wrong codes per user per 24h across all tokens.
--   2. The token-only legacy link flow (the confirmation email now sends a code, not a link)
--      is no longer callable from the API: EXECUTE revoked from PUBLIC/anon/authenticated on
--      confirm_email_verification, get_verification_token_snapshot, poll_email_verified_by_token.
--      service_role keeps access.
--   3. OTP generation uses a cryptographically secure source instead of random().
--
-- Rollback: supabase/rollback/20261120_harden_email_verification_otp_rollback.sql

SET LOCAL search_path = public, extensions, pg_temp;

ALTER TABLE public.email_verification_tokens
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.confirm_email_verification_otp(p_email text, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $function$
DECLARE
  c_max_per_token constant int := 5;
  c_max_per_user_24h constant int := 20;
  v_email_norm text := lower(trim(coalesce(p_email, '')));
  v_code text;
  v_uid uuid;
  v_recent_failures int;
  v_row public.email_verification_tokens%ROWTYPE;
BEGIN
  IF length(v_email_norm) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  v_code := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  IF length(v_code) <> 6 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(trim(u.email)) = v_email_norm LIMIT 1;
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT coalesce(sum(t.failed_attempts), 0) INTO v_recent_failures
  FROM public.email_verification_tokens t
  WHERE t.user_id = v_uid AND t.created_at > now() - interval '24 hours';
  IF v_recent_failures >= c_max_per_user_24h THEN
    RETURN json_build_object('ok', false, 'error', 'too_many_attempts');
  END IF;

  SELECT * INTO v_row
  FROM public.email_verification_tokens
  WHERE user_id = v_uid AND email_verified = false AND expires_at >= now()
    AND failed_attempts < c_max_per_token
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;

  IF v_row.token <> v_code THEN
    UPDATE public.email_verification_tokens
    SET failed_attempts = failed_attempts + 1,
        expires_at = CASE WHEN failed_attempts + 1 >= c_max_per_token THEN now() - interval '1 second' ELSE expires_at END
    WHERE id = v_row.id;
    IF v_row.failed_attempts + 1 >= c_max_per_token THEN
      RETURN json_build_object('ok', false, 'error', 'too_many_attempts');
    END IF;
    RETURN json_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  UPDATE public.email_verification_tokens
  SET email_verified = true, used_at = now()
  WHERE id = v_row.id;
  RETURN json_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_unique_verification_otp()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
  v_tries int := 0;
BEGIN
  LOOP
    v_token := lpad(
      ((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text,
      6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.email_verification_tokens t WHERE t.token = v_token);
    v_tries := v_tries + 1;
    IF v_tries > 80 THEN
      RAISE EXCEPTION 'could not generate unique verification otp';
    END IF;
  END LOOP;
  RETURN v_token;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.confirm_email_verification(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_verification_token_snapshot(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.poll_email_verified_by_token(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_email_verification(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_verification_token_snapshot(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.poll_email_verified_by_token(text, uuid) TO service_role;
