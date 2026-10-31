-- Phase 0 MCP gateway: OAuth grants (service role only) and a membership-checked content plan read.

CREATE TABLE IF NOT EXISTS public.mcp_oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  client_name text NOT NULL,
  redirect_uris text[] NOT NULL,
  token_endpoint_auth_method text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_oauth_clients_auth_method_check
    CHECK (token_endpoint_auth_method = 'none')
);

CREATE TABLE IF NOT EXISTS public.mcp_oauth_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  code_challenge_method text NOT NULL,
  scope text NOT NULL,
  state text NULL,
  resource text NULL,
  expires_at timestamptz NOT NULL,
  user_id uuid NULL,
  profile_id uuid NULL,
  organization_id uuid NULL,
  employee_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_oauth_requests_pkce_check
    CHECK (code_challenge_method = 'S256')
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_requests_expires_at
  ON public.mcp_oauth_requests (expires_at);

CREATE TABLE IF NOT EXISTS public.mcp_oauth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  request_id uuid NOT NULL REFERENCES public.mcp_oauth_requests (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  employee_id uuid NULL,
  scope text NOT NULL,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mcp_oauth_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  employee_id uuid NULL,
  scope text NOT NULL,
  client_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mcp_oauth_clients FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mcp_oauth_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mcp_oauth_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mcp_oauth_refresh_tokens FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.mcp_oauth_clients TO service_role;
GRANT ALL ON TABLE public.mcp_oauth_requests TO service_role;
GRANT ALL ON TABLE public.mcp_oauth_codes TO service_role;
GRANT ALL ON TABLE public.mcp_oauth_refresh_tokens TO service_role;

-- Caller must pass the user id from a verified MCP token. Executable only by service_role
-- so a signed-in member cannot supply another user's id.
CREATE OR REPLACE FUNCTION public.mcp_list_content_plans(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  post_date timestamptz,
  approved boolean,
  production_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.status,
    p.post_date,
    p.approved,
    p.production_status
  FROM public.social_media_plans p
  WHERE p.organization_id = p_organization_id
  ORDER BY p.post_date DESC NULLS FIRST, p.created_at DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_list_content_plans(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_content_plans(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_content_plans(uuid, uuid) TO service_role;
