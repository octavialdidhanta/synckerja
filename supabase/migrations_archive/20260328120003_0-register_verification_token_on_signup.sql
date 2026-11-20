-- Create verification token in the same DB transaction as auth signup (no Edge/PostgREST race or wrong-project keys).

CREATE OR REPLACE FUNCTION public.create_email_verification_token_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text := gen_random_uuid()::text;
  v_expires timestamptz := now() + interval '48 hours';
BEGIN
  INSERT INTO public.email_verification_tokens (user_id, token, expires_at, email_verified)
  VALUES (NEW.id, v_token, v_expires, false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_verification_token ON auth.users;
CREATE TRIGGER on_auth_user_email_verification_token
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_email_verification_token_on_signup();

REVOKE ALL ON FUNCTION public.create_email_verification_token_on_signup() FROM PUBLIC;

-- Resend flow: new token without Edge needing to read auth (user may be signed out; anon ok with email match).
CREATE OR REPLACE FUNCTION public.issue_new_verification_token(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_uid uuid;
  v_token text := gen_random_uuid()::text;
  v_expires timestamptz := now() + interval '48 hours';
BEGIN
  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'user_not_found');
  END IF;
  INSERT INTO public.email_verification_tokens (user_id, token, expires_at, email_verified)
  VALUES (v_uid, v_token, v_expires, false);
  RETURN json_build_object('ok', true, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_new_verification_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_new_verification_token(text) TO anon, authenticated;
