-- Revoke Claude connections, record tool calls, and count the 5-minute rate window.
-- Office calls the authenticated functions with the user JWT. The MCP service calls the service_role functions.
-- The rate window matches decideToolRate: 60 calls, then one denial audit per window.

CREATE TABLE IF NOT EXISTS public.mcp_oauth_revocations (
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  client_id text NOT NULL,
  revoked_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, organization_id, client_id)
);

CREATE TABLE IF NOT EXISTS public.mcp_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  tool_name text NOT NULL,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_tool_calls_outcome_check
    CHECK (outcome IN ('ok', 'error', 'forbidden', 'rate_limited'))
);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_org_created
  ON public.mcp_tool_calls (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mcp_tool_rate (
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  call_count integer NOT NULL,
  denial_logged boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, organization_id),
  CONSTRAINT mcp_tool_rate_count_check CHECK (call_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_refresh_live
  ON public.mcp_oauth_refresh_tokens (organization_id, user_id, client_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.mcp_oauth_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tool_rate ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mcp_oauth_revocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mcp_tool_calls FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mcp_tool_rate FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.mcp_oauth_revocations TO service_role;
GRANT ALL ON TABLE public.mcp_tool_calls TO service_role;
GRANT ALL ON TABLE public.mcp_tool_rate TO service_role;

CREATE OR REPLACE FUNCTION public.mcp_list_connections(p_organization_id uuid)
RETURNS TABLE (
  user_id uuid,
  client_id text,
  full_name text,
  client_name text,
  connected_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_org_wide boolean;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = v_user
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  v_org_wide := EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_user
      AND ur.organization_id = p_organization_id
      AND lower(ur.role) IN ('owner', 'admin')
  );

  RETURN QUERY
  SELECT
    token.user_id,
    token.client_id,
    profile.full_name,
    client.client_name,
    max(token.created_at)
  FROM public.mcp_oauth_refresh_tokens token
  LEFT JOIN public.profiles profile
    ON profile.user_id = token.user_id
  LEFT JOIN public.mcp_oauth_clients client
    ON client.client_id = token.client_id
  WHERE token.organization_id = p_organization_id
    AND token.revoked_at IS NULL
    AND token.expires_at > now()
    AND (v_org_wide OR token.user_id = v_user)
  GROUP BY token.user_id, token.client_id, profile.full_name, client.client_name
  ORDER BY max(token.created_at) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_revoke_connection(
  p_organization_id uuid,
  p_user_id uuid,
  p_client_id text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_org_wide boolean;
  v_now timestamptz;
  v_count integer;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL OR p_organization_id IS NULL OR p_user_id IS NULL OR NULLIF(btrim(COALESCE(p_client_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = v_user
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  v_org_wide := EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_user
      AND ur.organization_id = p_organization_id
      AND lower(ur.role) IN ('owner', 'admin')
  );

  IF v_user <> p_user_id AND NOT v_org_wide THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_now := clock_timestamp();

  UPDATE public.mcp_oauth_refresh_tokens token
  SET revoked_at = v_now
  WHERE token.organization_id = p_organization_id
    AND token.user_id = p_user_id
    AND token.client_id = p_client_id
    AND token.revoked_at IS NULL
    AND token.expires_at > v_now;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.mcp_oauth_revocations (user_id, organization_id, client_id, revoked_at)
  VALUES (p_user_id, p_organization_id, p_client_id, v_now)
  ON CONFLICT (user_id, organization_id, client_id)
  DO UPDATE SET revoked_at = EXCLUDED.revoked_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_tool_audit(p_organization_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  tool_name text,
  outcome text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_org_wide boolean;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = v_user
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  v_org_wide := EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_user
      AND ur.organization_id = p_organization_id
      AND lower(ur.role) IN ('owner', 'admin')
  );

  RETURN QUERY
  SELECT
    call.user_id,
    profile.full_name,
    call.tool_name,
    call.outcome,
    call.created_at
  FROM public.mcp_tool_calls call
  LEFT JOIN public.profiles profile
    ON profile.user_id = call.user_id
  WHERE call.organization_id = p_organization_id
    AND (v_org_wide OR call.user_id = v_user)
  ORDER BY call.created_at DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_access_cutoff(
  p_user_id uuid,
  p_organization_id uuid,
  p_client_id text
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revoked_at timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR NULLIF(btrim(COALESCE(p_client_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT revocation.revoked_at
  INTO v_revoked_at
  FROM public.mcp_oauth_revocations revocation
  WHERE revocation.user_id = p_user_id
    AND revocation.organization_id = p_organization_id
    AND revocation.client_id = p_client_id;

  RETURN v_revoked_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_take_tool_slot(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  allowed boolean,
  record_denial boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz;
  v_count integer;
  v_logged boolean;
  v_now timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.mcp_tool_rate (user_id, organization_id, window_start, call_count, denial_logged)
  VALUES (p_user_id, p_organization_id, clock_timestamp(), 0, false)
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  SELECT rate.window_start, rate.call_count, rate.denial_logged
  INTO v_window, v_count, v_logged
  FROM public.mcp_tool_rate rate
  WHERE rate.user_id = p_user_id
    AND rate.organization_id = p_organization_id
  FOR UPDATE;

  IF v_window IS NULL THEN
    RAISE EXCEPTION 'rate_limit_failed' USING ERRCODE = '55000';
  END IF;

  v_now := clock_timestamp();

  IF v_window <= v_now - interval '5 minutes' THEN
    UPDATE public.mcp_tool_rate rate
    SET window_start = v_now, call_count = 1, denial_logged = false
    WHERE rate.user_id = p_user_id
      AND rate.organization_id = p_organization_id;
    RETURN QUERY SELECT true, false;
    RETURN;
  END IF;

  IF v_count < 60 THEN
    UPDATE public.mcp_tool_rate rate
    SET call_count = v_count + 1
    WHERE rate.user_id = p_user_id
      AND rate.organization_id = p_organization_id;
    RETURN QUERY SELECT true, false;
    RETURN;
  END IF;

  IF NOT v_logged THEN
    UPDATE public.mcp_tool_rate rate
    SET denial_logged = true
    WHERE rate.user_id = p_user_id
      AND rate.organization_id = p_organization_id;
    RETURN QUERY SELECT false, true;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_record_tool_call(
  p_user_id uuid,
  p_organization_id uuid,
  p_client_id text,
  p_tool_name text,
  p_outcome text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL
    OR p_organization_id IS NULL
    OR NULLIF(btrim(COALESCE(p_client_id, '')), '') IS NULL
    OR NULLIF(btrim(COALESCE(p_tool_name, '')), '') IS NULL
    OR char_length(p_tool_name) > 120
    OR p_outcome NOT IN ('ok', 'error', 'forbidden', 'rate_limited') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.mcp_tool_calls old_call
  WHERE old_call.organization_id = p_organization_id
    AND old_call.created_at < now() - interval '30 days';

  INSERT INTO public.mcp_tool_calls (organization_id, user_id, client_id, tool_name, outcome)
  VALUES (p_organization_id, p_user_id, p_client_id, p_tool_name, p_outcome);
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_list_connections(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.mcp_list_connections(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.mcp_revoke_connection(uuid, uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.mcp_revoke_connection(uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.mcp_list_tool_audit(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.mcp_list_tool_audit(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.mcp_access_cutoff(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_access_cutoff(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_take_tool_slot(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_take_tool_slot(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_record_tool_call(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_record_tool_call(uuid, uuid, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
