-- Synckerja Agent (laptop program) — step 2: per-organization Agent tokens and the device list.
--
-- An Agent token belongs to ONE organization. The plaintext token is shown once at creation;
-- only its sha256 is stored. Owners/admins create and revoke tokens. The agent-api edge function
-- (service role) checks the hash and takes the organization from the token, never from the request.
-- One laptop (device) can serve several organizations: one row in agent_device_orgs per org.
-- Each organization only sees the devices that serve it.

CREATE TABLE public.agent_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  label text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['catalog', 'render']::text[],
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  CONSTRAINT agent_tokens_label_check CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  CONSTRAINT agent_tokens_scopes_check CHECK (
    cardinality(scopes) >= 1 AND scopes <@ ARRAY['catalog', 'render']::text[]
  )
);

CREATE INDEX agent_tokens_org_idx ON public.agent_tokens (organization_id, created_at DESC);

CREATE TABLE public.agent_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_key uuid NOT NULL UNIQUE,
  name text NOT NULL,
  agent_version text,
  platform text,
  tools jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_devices_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 80)
);

CREATE TABLE public.agent_device_orgs (
  device_id uuid NOT NULL REFERENCES public.agent_devices(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token_id uuid REFERENCES public.agent_tokens(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, organization_id)
);

CREATE INDEX agent_device_orgs_org_idx ON public.agent_device_orgs (organization_id, last_seen_at DESC);

-- ── Row level security: read only for the browser; every write goes through the functions below.
ALTER TABLE public.agent_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_device_orgs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.agent_tokens, public.agent_devices, public.agent_device_orgs FROM anon, authenticated;
GRANT ALL ON public.agent_tokens, public.agent_devices, public.agent_device_orgs TO service_role;

-- The hash never leaves the database: owners/admins can read every column except token_hash.
GRANT SELECT (id, organization_id, token_prefix, label, scopes, created_by, created_at,
              expires_at, revoked_at, revoked_by, last_used_at)
  ON public.agent_tokens TO authenticated;
GRANT SELECT ON public.agent_devices, public.agent_device_orgs TO authenticated;

CREATE POLICY agent_tokens_select_admin ON public.agent_tokens
  FOR SELECT TO authenticated
  USING (public.user_is_org_owner_or_admin(organization_id));

CREATE POLICY agent_device_orgs_select_member ON public.agent_device_orgs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = (SELECT auth.uid())
      AND uo.organization_id = agent_device_orgs.organization_id
      AND COALESCE(uo.is_active, true)
  ));

CREATE POLICY agent_devices_select_member ON public.agent_devices
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.agent_device_orgs d
    JOIN public.user_organizations uo
      ON uo.organization_id = d.organization_id
     AND uo.user_id = (SELECT auth.uid())
     AND COALESCE(uo.is_active, true)
    WHERE d.device_id = agent_devices.id
  ));

-- ── Office: create / revoke (owner or admin of that organization).

CREATE OR REPLACE FUNCTION public.agent_token_create(
  p_organization_id uuid,
  p_label text,
  p_expires_in_days integer DEFAULT 365,
  p_scopes text[] DEFAULT ARRAY['catalog', 'render']::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $create$
DECLARE
  v_prefix text;
  v_token text;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'not_owner_or_admin' USING ERRCODE = '42501';
  END IF;
  IF p_label IS NULL OR char_length(btrim(p_label)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'invalid_label' USING ERRCODE = '22023';
  END IF;
  IF p_expires_in_days IS NOT NULL AND (p_expires_in_days < 1 OR p_expires_in_days > 730) THEN
    RAISE EXCEPTION 'invalid_expiry' USING ERRCODE = '22023';
  END IF;
  IF p_scopes IS NULL OR cardinality(p_scopes) < 1
     OR NOT (p_scopes <@ ARRAY['catalog', 'render']::text[]) THEN
    RAISE EXCEPTION 'invalid_scopes' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.agent_tokens t
      WHERE t.organization_id = p_organization_id
        AND t.revoked_at IS NULL
        AND (t.expires_at IS NULL OR t.expires_at > now())) >= 20 THEN
    RAISE EXCEPTION 'too_many_tokens' USING ERRCODE = '54000';
  END IF;

  v_prefix := encode(extensions.gen_random_bytes(4), 'hex');
  v_token := 'sk_agent_' || v_prefix || '_' || encode(extensions.gen_random_bytes(24), 'hex');
  -- Never expire is not offered: a lost laptop must not hold a key forever.
  v_expires := now() + make_interval(days => COALESCE(p_expires_in_days, 365));

  INSERT INTO public.agent_tokens (organization_id, token_hash, token_prefix, label, scopes, created_by, expires_at)
  VALUES (
    p_organization_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_prefix,
    btrim(p_label),
    (SELECT array_agg(DISTINCT s ORDER BY s) FROM unnest(p_scopes) s),
    auth.uid(),
    v_expires
  )
  RETURNING id INTO v_id;

  -- The only time the plaintext token exists outside the laptop.
  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'token_prefix', v_prefix, 'expires_at', v_expires);
END;
$create$;

CREATE OR REPLACE FUNCTION public.agent_token_revoke(p_token_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $revoke$
DECLARE
  v_org uuid;
  v_revoked timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT organization_id, revoked_at INTO v_org, v_revoked
  FROM public.agent_tokens WHERE id = p_token_id;
  IF v_org IS NULL OR NOT public.user_is_org_owner_or_admin(v_org) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_revoked IS NULL THEN
    UPDATE public.agent_tokens
    SET revoked_at = now(), revoked_by = auth.uid()
    WHERE id = p_token_id
    RETURNING revoked_at INTO v_revoked;
  END IF;
  RETURN jsonb_build_object('id', p_token_id, 'revoked_at', v_revoked);
END;
$revoke$;

-- ── agent-api (service role): check a token, record a heartbeat.

CREATE OR REPLACE FUNCTION public.agent_auth(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $auth$
DECLARE
  t public.agent_tokens%ROWTYPE;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO t FROM public.agent_tokens WHERE token_hash = p_token_hash;
  IF t.id IS NULL OR t.revoked_at IS NOT NULL OR (t.expires_at IS NOT NULL AND t.expires_at <= now()) THEN
    RETURN NULL;
  END IF;
  -- One write per minute at most, so a busy Agent does not churn the row.
  IF t.last_used_at IS NULL OR t.last_used_at < now() - interval '1 minute' THEN
    UPDATE public.agent_tokens SET last_used_at = now() WHERE id = t.id;
  END IF;
  RETURN jsonb_build_object(
    'token_id', t.id,
    'organization_id', t.organization_id,
    'scopes', to_jsonb(t.scopes),
    'created_by', t.created_by,
    'expires_at', t.expires_at
  );
END;
$auth$;

CREATE OR REPLACE FUNCTION public.agent_heartbeat(
  p_token_id uuid,
  p_device_key uuid,
  p_name text,
  p_agent_version text,
  p_platform text,
  p_tools jsonb,
  p_last_error text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $heartbeat$
DECLARE
  v_org uuid;
  v_device uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.agent_tokens
  WHERE id = p_token_id AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'token_inactive' USING ERRCODE = '42501';
  END IF;
  IF p_device_key IS NULL OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF p_tools IS NOT NULL AND (jsonb_typeof(p_tools) <> 'object' OR octet_length(p_tools::text) > 20000) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.agent_devices AS d (device_key, name, agent_version, platform, tools, last_error, last_seen_at)
  VALUES (
    p_device_key,
    btrim(p_name),
    left(p_agent_version, 40),
    left(p_platform, 40),
    COALESCE(p_tools, '{}'::jsonb),
    left(p_last_error, 2000),
    now()
  )
  ON CONFLICT (device_key) DO UPDATE SET
    name = EXCLUDED.name,
    agent_version = EXCLUDED.agent_version,
    platform = EXCLUDED.platform,
    tools = CASE WHEN p_tools IS NULL THEN d.tools ELSE EXCLUDED.tools END,
    last_error = EXCLUDED.last_error,
    last_seen_at = now(),
    updated_at = now()
  RETURNING id INTO v_device;

  INSERT INTO public.agent_device_orgs AS o (device_id, organization_id, token_id)
  VALUES (v_device, v_org, p_token_id)
  ON CONFLICT (device_id, organization_id) DO UPDATE SET
    token_id = EXCLUDED.token_id,
    last_seen_at = now();

  RETURN jsonb_build_object('device_id', v_device, 'organization_id', v_org, 'server_time', now());
END;
$heartbeat$;

REVOKE ALL ON FUNCTION public.agent_token_create(uuid, text, integer, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_token_create(uuid, text, integer, text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.agent_token_revoke(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_token_revoke(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.agent_auth(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_auth(text) TO service_role;
REVOKE ALL ON FUNCTION public.agent_heartbeat(uuid, uuid, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_heartbeat(uuid, uuid, text, text, text, jsonb, text) TO service_role;
