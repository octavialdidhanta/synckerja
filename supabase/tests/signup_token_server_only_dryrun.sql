-- Uji 20261104160000. Semua perubahan dibatalkan di akhir.
-- Jangan jalankan file migration ini sebagai apply.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_latest_signup_verification_token(p_user_id uuid, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_token text;
BEGIN
  IF coalesce(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    RETURN json_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_user_id IS NULL OR p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  SELECT u.id INTO v_uid
  FROM auth.users u
  WHERE u.id = p_user_id AND lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_matching_user');
  END IF;

  SELECT t.token INTO v_token
  FROM public.email_verification_tokens t
  WHERE t.user_id = v_uid
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF v_token IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_token');
  END IF;

  RETURN json_build_object('ok', true, 'token', v_token);
END;
$function$;

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
$function$;

DO $test$
DECLARE
  v_email text;
  v_uid uuid;
  v_before integer;
  v_after integer;
  v_res jsonb;
BEGIN
  SELECT u.email, u.id INTO v_email, v_uid
  FROM auth.users u
  WHERE u.email IS NOT NULL AND length(trim(u.email)) > 0
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'tidak ada user untuk uji';
  END IF;

  SELECT count(*) INTO v_before
  FROM public.email_verification_tokens
  WHERE user_id = v_uid;

  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  v_res := public.issue_new_verification_token(v_email)::jsonb;
  IF v_res->>'error' IS DISTINCT FROM 'not_authorized' OR v_res ? 'token' THEN
    RAISE EXCEPTION 'anon masih bisa meminta token';
  END IF;

  v_res := public.get_latest_signup_verification_token(v_uid, v_email)::jsonb;
  IF v_res->>'error' IS DISTINCT FROM 'not_authorized' OR v_res ? 'token' THEN
    RAISE EXCEPTION 'anon masih bisa membaca token';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  v_res := public.issue_new_verification_token(v_email)::jsonb;
  IF v_res->>'error' IS DISTINCT FROM 'not_authorized' OR v_res ? 'token' THEN
    RAISE EXCEPTION 'pengguna login masih bisa meminta token';
  END IF;

  SELECT count(*) INTO v_after
  FROM public.email_verification_tokens
  WHERE user_id = v_uid;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'token baru terbuat tanpa service_role';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  v_res := public.issue_new_verification_token('nobody-signup-token-test@example.invalid')::jsonb;
  IF v_res->>'error' IS DISTINCT FROM 'user_not_found' OR v_res ? 'token' THEN
    RAISE EXCEPTION 'email palsu harus user_not_found';
  END IF;

  v_res := public.issue_new_verification_token(v_email)::jsonb;
  IF coalesce(v_res->>'ok', '') IS DISTINCT FROM 'true' OR coalesce(v_res->>'token', '') = '' THEN
    RAISE EXCEPTION 'service_role gagal membuat token';
  END IF;

  SELECT count(*) INTO v_after
  FROM public.email_verification_tokens
  WHERE user_id = v_uid;
  IF v_after <> v_before + 1 THEN
    RAISE EXCEPTION 'service_role tidak menyimpan token';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  v_res := public.get_latest_signup_verification_token(v_uid, v_email)::jsonb;
  IF v_res->>'error' IS DISTINCT FROM 'not_authorized' OR v_res ? 'token' THEN
    RAISE EXCEPTION 'anon membaca token setelah dibuat';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  v_res := public.get_latest_signup_verification_token(v_uid, v_email)::jsonb;
  IF coalesce(v_res->>'ok', '') IS DISTINCT FROM 'true' OR coalesce(v_res->>'token', '') = '' THEN
    RAISE EXCEPTION 'service_role gagal membaca token';
  END IF;
END
$test$;

ROLLBACK;
