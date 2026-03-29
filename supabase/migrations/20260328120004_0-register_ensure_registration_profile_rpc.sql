-- Idempotent bootstrap: ensures public.profiles has a row when auth.users exists with matching id+email.
-- Use when AFTER INSERT triggers on auth.users are missing, failed to deploy, or pointed at another project.

CREATE OR REPLACE FUNCTION public.ensure_registration_profile(p_user_id uuid, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_id uuid;
  v_email text;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  SELECT u.id, u.email INTO v_id, v_email
  FROM auth.users u
  WHERE u.id = p_user_id AND lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_matching_user');
  END IF;

  INSERT INTO public.profiles (user_id, email)
  VALUES (v_id, COALESCE(v_email, ''))
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_registration_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_registration_profile(uuid, text) TO anon, authenticated;
