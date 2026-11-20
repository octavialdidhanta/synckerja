-- Rollback for 20261120090000_harden_email_verification_otp.sql
-- WARNING: restores the brute-forceable behaviour. Only use if signup verification breaks.

SET LOCAL search_path = public, extensions, pg_temp;

CREATE OR REPLACE FUNCTION public.confirm_email_verification_otp(p_email text, p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $function$
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
  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(trim(u.email)) = v_email_norm LIMIT 1;
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  SELECT * INTO v_row FROM public.email_verification_tokens
  WHERE user_id = v_uid AND email_verified = false AND expires_at >= now()
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;
  IF v_row.token <> v_code THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  UPDATE public.email_verification_tokens SET email_verified = true, used_at = now() WHERE token = v_row.token;
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
    v_token := lpad((floor(random() * 1000000)::int)::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.email_verification_tokens t WHERE t.token = v_token);
    v_tries := v_tries + 1;
    IF v_tries > 80 THEN
      RAISE EXCEPTION 'could not generate unique verification otp';
    END IF;
  END LOOP;
  RETURN v_token;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirm_email_verification(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_verification_token_snapshot(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.poll_email_verified_by_token(text, uuid) TO anon, authenticated;

ALTER TABLE public.email_verification_tokens DROP COLUMN IF EXISTS failed_attempts;
