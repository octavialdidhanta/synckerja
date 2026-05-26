-- Google OAuth sign-in: treat verified Google identity as email-verified for onboarding gates.

CREATE OR REPLACE FUNCTION public.registration_has_verified_email(p_user_id uuid, p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_ok boolean;
  v_has_google boolean;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN public.email_verification_tokens t ON t.user_id = u.id
    WHERE u.id = p_user_id
      AND lower(trim(u.email)) = lower(trim(p_email))
      AND t.email_verified = true
  )
  INTO v_ok;

  IF COALESCE(v_ok, false) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.identities i
    INNER JOIN auth.users u ON u.id = i.user_id
    WHERE i.user_id = p_user_id
      AND lower(trim(u.email)) = lower(trim(p_email))
      AND i.provider = 'google'
  )
  INTO v_has_google;

  IF COALESCE(v_has_google, false) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.registration_has_verified_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registration_has_verified_email(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_oauth_registration_verified(p_user_id uuid, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_uid uuid;
  v_email text;
  v_has_google boolean;
  v_token text;
  v_updated int;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT u.id, u.email INTO v_uid, v_email
  FROM auth.users u
  WHERE u.id = p_user_id
    AND lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_matching_user');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.identities i
    WHERE i.user_id = p_user_id
      AND i.provider = 'google'
  )
  INTO v_has_google;

  IF NOT COALESCE(v_has_google, false) THEN
    RETURN json_build_object('ok', false, 'error', 'not_google_identity');
  END IF;

  UPDATE public.email_verification_tokens
  SET email_verified = true, used_at = COALESCE(used_at, now())
  WHERE user_id = p_user_id
    AND email_verified = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 AND NOT EXISTS (
    SELECT 1
    FROM public.email_verification_tokens t
    WHERE t.user_id = p_user_id AND t.email_verified = true
  ) THEN
    v_token := 'oauth-google-' || gen_random_uuid()::text;
    INSERT INTO public.email_verification_tokens (user_id, token, expires_at, email_verified, used_at)
    VALUES (p_user_id, v_token, now() + interval '10 years', true, now());
  END IF;

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = p_user_id
    AND email_confirmed_at IS NULL;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_oauth_registration_verified(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_oauth_registration_verified(uuid, text) TO authenticated;
