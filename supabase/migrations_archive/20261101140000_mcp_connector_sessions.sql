-- One active organization per connector (user + client). The access token no longer chooses the org.
-- Office connection lists still read mcp_oauth_refresh_tokens.organization_id, so a switch updates that column too.

CREATE TABLE IF NOT EXISTS public.mcp_connector_sessions (
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  connection_id uuid NOT NULL,
  active_organization_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id)
);

CREATE TABLE IF NOT EXISTS public.mcp_org_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  from_organization_id uuid NOT NULL,
  to_organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_org_switches_user_created
  ON public.mcp_org_switches (user_id, created_at DESC);

ALTER TABLE public.mcp_oauth_refresh_tokens
  ADD COLUMN IF NOT EXISTS connection_id uuid;

WITH grouped AS (
  SELECT
    token.user_id,
    token.client_id,
    (array_agg(token.organization_id ORDER BY token.created_at DESC, token.id DESC))[1] AS organization_id,
    gen_random_uuid() AS connection_id
  FROM public.mcp_oauth_refresh_tokens token
  WHERE token.revoked_at IS NULL
    AND token.expires_at > now()
    AND token.connection_id IS NULL
  GROUP BY token.user_id, token.client_id
)
UPDATE public.mcp_oauth_refresh_tokens token
SET connection_id = grouped.connection_id
FROM grouped
WHERE token.user_id = grouped.user_id
  AND token.client_id = grouped.client_id
  AND token.revoked_at IS NULL
  AND token.expires_at > now()
  AND token.connection_id IS NULL;

INSERT INTO public.mcp_connector_sessions (user_id, client_id, connection_id, active_organization_id)
SELECT DISTINCT ON (token.user_id, token.client_id)
  token.user_id,
  token.client_id,
  token.connection_id,
  token.organization_id
FROM public.mcp_oauth_refresh_tokens token
WHERE token.connection_id IS NOT NULL
  AND token.revoked_at IS NULL
  AND token.expires_at > now()
ORDER BY token.user_id, token.client_id, token.created_at DESC, token.id DESC
ON CONFLICT (user_id, client_id) DO NOTHING;

ALTER TABLE public.mcp_connector_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_org_switches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mcp_connector_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mcp_org_switches FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.mcp_connector_sessions TO service_role;
GRANT ALL ON TABLE public.mcp_org_switches TO service_role;

CREATE OR REPLACE FUNCTION public.mcp_switch_organization(
  p_user_id uuid,
  p_client_id text,
  p_organization_id uuid
)
RETURNS TABLE (
  connection_id uuid,
  organization_id uuid,
  employee_id uuid,
  organization_name text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from uuid;
  v_connection uuid;
  v_employee uuid;
  v_name text;
  v_now timestamptz;
BEGIN
  IF p_user_id IS NULL
    OR p_organization_id IS NULL
    OR NULLIF(btrim(COALESCE(p_client_id, '')), '') IS NULL
  THEN
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

  SELECT session.connection_id, session.active_organization_id
  INTO v_connection, v_from
  FROM public.mcp_connector_sessions session
  WHERE session.user_id = p_user_id
    AND session.client_id = p_client_id
  FOR UPDATE;

  IF v_connection IS NULL THEN
    RAISE EXCEPTION 'session_missing' USING ERRCODE = 'P0002';
  END IF;

  SELECT employee.id
  INTO v_employee
  FROM public.employees employee
  WHERE employee.user_id = p_user_id
    AND employee.organization_id = p_organization_id
  LIMIT 1;

  SELECT org.company_name
  INTO v_name
  FROM public.organizations org
  WHERE org.id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization_lookup_failed' USING ERRCODE = 'P0002';
  END IF;

  v_now := clock_timestamp();

  UPDATE public.mcp_connector_sessions session
  SET active_organization_id = p_organization_id,
      updated_at = v_now
  WHERE session.user_id = p_user_id
    AND session.client_id = p_client_id;

  UPDATE public.mcp_oauth_refresh_tokens token
  SET organization_id = p_organization_id,
      employee_id = v_employee
  WHERE token.user_id = p_user_id
    AND token.client_id = p_client_id
    AND token.revoked_at IS NULL
    AND token.expires_at > v_now;

  IF v_from IS DISTINCT FROM p_organization_id THEN
    INSERT INTO public.mcp_org_switches (
      connection_id,
      user_id,
      client_id,
      from_organization_id,
      to_organization_id,
      created_at
    )
    VALUES (v_connection, p_user_id, p_client_id, v_from, p_organization_id, v_now);
  END IF;

  connection_id := v_connection;
  organization_id := p_organization_id;
  employee_id := v_employee;
  organization_name := COALESCE(v_name, '');
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_switch_organization(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_switch_organization(uuid, text, uuid) TO service_role;
