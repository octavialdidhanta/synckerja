-- Helper for updated_at triggers (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profiles (used by registration duplicate check + app data)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  active_organization_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_user_id_key UNIQUE (user_id),
  CONSTRAINT profiles_email_key UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Sync profile on signup (service role / trigger runs as postgres)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Email verification tokens (custom Resend link → /email-verified?token=...)
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id
  ON public.email_verification_tokens (user_id);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_verification_tokens_select" ON public.email_verification_tokens;
DROP POLICY IF EXISTS "email_verification_tokens_update" ON public.email_verification_tokens;
DROP POLICY IF EXISTS "email_verification_tokens_insert" ON public.email_verification_tokens;

-- MVP: allow clients to read/update verification rows for post-sign-out polling and link flow.
-- Tighten in production (e.g. RPC-only + service role) if required.
CREATE POLICY "email_verification_tokens_select" ON public.email_verification_tokens
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "email_verification_tokens_update" ON public.email_verification_tokens
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "email_verification_tokens_insert" ON public.email_verification_tokens
  FOR INSERT TO service_role WITH CHECK (true);

-- Safer confirmation path (optional; client may still use direct update like reference)
CREATE OR REPLACE FUNCTION public.confirm_email_verification(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v email_verification_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.email_verification_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF v.email_verified THEN
    RETURN json_build_object('ok', true, 'already', true);
  END IF;
  IF v.expires_at < now() THEN
    RETURN json_build_object('ok', false, 'error', 'expired');
  END IF;
  UPDATE public.email_verification_tokens
  SET email_verified = true, used_at = now()
  WHERE token = p_token;
  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_email_verification(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_email_verification(text) TO anon, authenticated;

-- Allow registration form to check duplicate email without exposing all profiles (anon)
CREATE OR REPLACE FUNCTION public.email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(trim(email)) = lower(trim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION public.email_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon, authenticated;
