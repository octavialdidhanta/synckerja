-- MFA recovery codes (hashed) and security audit events for 2FA flows.

CREATE TABLE IF NOT EXISTS public.user_mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_mfa_recovery_codes_user_id_idx
  ON public.user_mfa_recovery_codes (user_id)
  WHERE used_at IS NULL;

ALTER TABLE public.user_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_mfa_recovery_codes_select_own
  ON public.user_mfa_recovery_codes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.auth_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_security_events_user_created_idx
  ON public.auth_security_events (user_id, created_at DESC);

ALTER TABLE public.auth_security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_security_events_select_own
  ON public.auth_security_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY auth_security_events_insert_own
  ON public.auth_security_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Replace all unused recovery codes for the current user.
CREATE OR REPLACE FUNCTION public.store_mfa_recovery_codes(p_hashes text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  DELETE FROM public.user_mfa_recovery_codes
  WHERE user_id = auth.uid();

  INSERT INTO public.user_mfa_recovery_codes (user_id, code_hash)
  SELECT auth.uid(), unnest(p_hashes);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_mfa_recovery_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  DELETE FROM public.user_mfa_recovery_codes
  WHERE user_id = auth.uid();
END;
$$;

-- Consume a recovery code (login recovery / account unlock). Returns true if valid.
CREATE OR REPLACE FUNCTION public.consume_mfa_recovery_code(p_code_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id INTO v_id
  FROM public.user_mfa_recovery_codes
  WHERE user_id = auth.uid()
    AND code_hash = p_code_hash
    AND used_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.user_mfa_recovery_codes
  SET used_at = now()
  WHERE id = v_id;

  INSERT INTO public.auth_security_events (user_id, event, metadata)
  VALUES (auth.uid(), 'mfa_recovery_used', '{}'::jsonb);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_auth_security_event(
  p_event text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.auth_security_events (user_id, event, metadata)
  VALUES (auth.uid(), p_event, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_mfa_recovery_codes(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_mfa_recovery_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_mfa_recovery_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_auth_security_event(text, jsonb) TO authenticated;
