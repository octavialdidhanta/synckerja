-- Per-organization Canva account for later AI-employee design writes.
-- The browser can read connection status. Encrypted tokens stay on the service role.

CREATE TABLE IF NOT EXISTS public.canva_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  state_token text NOT NULL,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canva_oauth_states_state_token_key UNIQUE (state_token)
);

CREATE INDEX IF NOT EXISTS idx_canva_oauth_states_expires
  ON public.canva_oauth_states (expires_at);

ALTER TABLE public.canva_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.canva_oauth_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.canva_oauth_states TO service_role;

CREATE TABLE IF NOT EXISTS public.organization_canva_connections (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  canva_user_id text NULL,
  canva_team_id text NULL,
  display_name text NULL,
  is_active boolean NOT NULL DEFAULT false,
  oauth_connected_at timestamptz NULL,
  connected_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_canva_connections IS
  'Canva account linked to one organization. Tokens live in organization_canva_connection_tokens.';

DROP TRIGGER IF EXISTS update_organization_canva_connections_updated_at
  ON public.organization_canva_connections;
CREATE TRIGGER update_organization_canva_connections_updated_at
  BEFORE UPDATE ON public.organization_canva_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_canva_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_canva_connections_select_org
  ON public.organization_canva_connections;
CREATE POLICY organization_canva_connections_select_org
  ON public.organization_canva_connections
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

REVOKE ALL ON TABLE public.organization_canva_connections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.organization_canva_connections TO authenticated;
GRANT ALL ON TABLE public.organization_canva_connections TO service_role;

CREATE TABLE IF NOT EXISTS public.organization_canva_connection_tokens (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  refresh_token_enc text NOT NULL,
  access_token_enc text NULL,
  access_token_expires_at timestamptz NULL,
  oauth_scopes text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_canva_connection_tokens IS
  'Encrypted Canva OAuth tokens. Edge Functions with the service role only.';

ALTER TABLE public.organization_canva_connection_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_canva_connection_tokens_deny
  ON public.organization_canva_connection_tokens;
CREATE POLICY organization_canva_connection_tokens_deny
  ON public.organization_canva_connection_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.organization_canva_connection_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.organization_canva_connection_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.is_canva_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_canva_connections c
    INNER JOIN public.organization_canva_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.oauth_connected_at IS NOT NULL
      AND p_organization_id IN (SELECT public.user_organization_ids())
  );
$$;

COMMENT ON FUNCTION public.is_canva_connected(uuid) IS
  'True when the caller belongs to the organization and that organization has an active Canva connection.';

REVOKE ALL ON FUNCTION public.is_canva_connected(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_canva_connected(uuid) TO authenticated;
