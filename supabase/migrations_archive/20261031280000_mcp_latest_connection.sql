-- A new Claude connect registers a new client and leaves the previous refresh token alive.
-- Keep one live connection per user and organization: the newest token.

CREATE OR REPLACE FUNCTION public.mcp_supersede_connections(
  p_user_id uuid,
  p_organization_id uuid,
  p_keep_client_id text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR NULLIF(btrim(COALESCE(p_keep_client_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_now := clock_timestamp();

  WITH newest AS (
    SELECT token.id
    FROM public.mcp_oauth_refresh_tokens token
    WHERE token.user_id = p_user_id
      AND token.organization_id = p_organization_id
      AND token.client_id = p_keep_client_id
      AND token.revoked_at IS NULL
      AND token.expires_at > v_now
    ORDER BY token.created_at DESC, token.id DESC
    LIMIT 1
  ),
  doomed AS (
    SELECT token.id, token.client_id
    FROM public.mcp_oauth_refresh_tokens token
    WHERE token.user_id = p_user_id
      AND token.organization_id = p_organization_id
      AND token.revoked_at IS NULL
      AND token.expires_at > v_now
      AND NOT EXISTS (SELECT 1 FROM newest WHERE newest.id = token.id)
  ),
  closed AS (
    UPDATE public.mcp_oauth_refresh_tokens token
    SET revoked_at = v_now
    FROM doomed
    WHERE token.id = doomed.id
    RETURNING doomed.client_id
  )
  INSERT INTO public.mcp_oauth_revocations (user_id, organization_id, client_id, revoked_at)
  SELECT p_user_id, p_organization_id, closed.client_id, v_now
  FROM closed
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.mcp_oauth_refresh_tokens live
    WHERE live.user_id = p_user_id
      AND live.organization_id = p_organization_id
      AND live.client_id = closed.client_id
      AND live.revoked_at IS NULL
      AND live.expires_at > v_now
  )
  ON CONFLICT (user_id, organization_id, client_id)
  DO UPDATE SET revoked_at = EXCLUDED.revoked_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_supersede_connections(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_supersede_connections(uuid, uuid, text) TO service_role;

SELECT public.mcp_supersede_connections(newest.user_id, newest.organization_id, newest.client_id)
FROM (
  SELECT DISTINCT ON (token.user_id, token.organization_id)
    token.user_id,
    token.organization_id,
    token.client_id
  FROM public.mcp_oauth_refresh_tokens token
  WHERE token.revoked_at IS NULL
    AND token.expires_at > now()
  ORDER BY token.user_id, token.organization_id, token.created_at DESC, token.id DESC
) newest;

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
    picked.user_id,
    picked.client_id,
    picked.full_name,
    picked.client_name,
    picked.connected_at
  FROM (
    SELECT DISTINCT ON (token.user_id)
      token.user_id,
      token.client_id,
      COALESCE(
        NULLIF(btrim(profile.full_name), ''),
        (
          SELECT emp.full_name
          FROM public.employees emp
          WHERE emp.user_id = token.user_id
            AND emp.organization_id = token.organization_id
            AND NULLIF(btrim(emp.full_name), '') IS NOT NULL
          LIMIT 1
        )
      ) AS full_name,
      client.client_name,
      token.created_at AS connected_at
    FROM public.mcp_oauth_refresh_tokens token
    LEFT JOIN public.profiles profile
      ON profile.user_id = token.user_id
    LEFT JOIN public.mcp_oauth_clients client
      ON client.client_id = token.client_id
    WHERE token.organization_id = p_organization_id
      AND token.revoked_at IS NULL
      AND token.expires_at > now()
      AND (v_org_wide OR token.user_id = v_user)
    ORDER BY token.user_id, token.created_at DESC, token.id DESC
  ) picked
  ORDER BY picked.connected_at DESC;
END;
$$;

NOTIFY pgrst, 'reload schema';
