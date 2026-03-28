-- 6-digit email verification OTP (replaces UUID token for new rows) + confirm RPC using only email_verification_tokens.

CREATE OR REPLACE FUNCTION public.generate_unique_verification_otp()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_tries int := 0;
BEGIN
  LOOP
    v_token := lpad((floor(random() * 1000000)::int)::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.email_verification_tokens t WHERE t.token = v_token
    );
    v_tries := v_tries + 1;
    IF v_tries > 80 THEN
      RAISE EXCEPTION 'could not generate unique verification otp';
    END IF;
  END LOOP;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_unique_verification_otp() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_email_verification_token_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_expires timestamptz := now() + interval '24 hours';
BEGIN
  v_token := public.generate_unique_verification_otp();
  INSERT INTO public.email_verification_tokens (user_id, token, expires_at, email_verified)
  VALUES (NEW.id, v_token, v_expires, false);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_new_verification_token(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_uid uuid;
  v_token text;
  v_expires timestamptz := now() + interval '24 hours';
  v_email_norm text := lower(trim(p_email));
BEGIN
  IF v_email_norm IS NULL OR length(v_email_norm) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(trim(email)) = v_email_norm
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  v_token := public.generate_unique_verification_otp();
  INSERT INTO public.email_verification_tokens (user_id, token, expires_at, email_verified)
  VALUES (v_uid, v_token, v_expires, false);

  RETURN json_build_object('ok', true, 'token', v_token);
END;
$$;

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
