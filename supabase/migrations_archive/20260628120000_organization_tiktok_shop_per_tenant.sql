-- Per-tenant TikTok Shop: OAuth state, encrypted tokens per seller, shop accounts.

CREATE TABLE IF NOT EXISTS public.tiktok_shop_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  state_token text NOT NULL,
  return_path text NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_shop_oauth_states_state_token_key UNIQUE (state_token)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_shop_oauth_states_expires
  ON public.tiktok_shop_oauth_states (expires_at);

ALTER TABLE public.tiktok_shop_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_tiktok_shop_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  oauth_connected_at timestamptz NULL,
  last_test_at timestamptz NULL,
  last_test_ok boolean NULL,
  last_test_error text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_tiktok_shop_connections_org_key UNIQUE (organization_id)
);

COMMENT ON TABLE public.organization_tiktok_shop_connections IS
  'Per-org TikTok Shop connection metadata and connection test results.';

CREATE TABLE IF NOT EXISTS public.organization_tiktok_shop_connection_tokens (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  seller_open_id text NOT NULL,
  access_token_enc text NOT NULL,
  refresh_token_enc text NOT NULL,
  access_token_expires_at timestamptz NULL,
  refresh_token_expires_at timestamptz NULL,
  seller_name text NULL,
  seller_base_region text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, seller_open_id)
);

COMMENT ON TABLE public.organization_tiktok_shop_connection_tokens IS
  'Encrypted TikTok Shop OAuth tokens per org + seller. Edge Functions only.';

ALTER TABLE public.organization_tiktok_shop_connection_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_shop_connection_tokens_deny
  ON public.organization_tiktok_shop_connection_tokens;
CREATE POLICY organization_tiktok_shop_connection_tokens_deny
  ON public.organization_tiktok_shop_connection_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.organization_tiktok_shop_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  seller_open_id text NOT NULL,
  shop_id text NOT NULL,
  shop_cipher text NOT NULL,
  shop_name text NULL,
  region text NULL,
  seller_type text NULL,
  label text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_tiktok_shop_accounts_org_shop_key UNIQUE (organization_id, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_tiktok_shop_accounts_org
  ON public.organization_tiktok_shop_accounts (organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_tiktok_shop_accounts_seller
  ON public.organization_tiktok_shop_accounts (organization_id, seller_open_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_tiktok_shop_accounts_one_default
  ON public.organization_tiktok_shop_accounts (organization_id)
  WHERE is_default = true AND is_active = true;

COMMENT ON TABLE public.organization_tiktok_shop_accounts IS
  'TikTok Shop stores authorized per seller connection per org.';

CREATE OR REPLACE FUNCTION public.is_tiktok_shop_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_tiktok_shop_connection_tokens t
    WHERE t.organization_id = p_organization_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_tiktok_shop_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tiktok_shop_connected(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_tiktok_shop_integration_enabled(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_tiktok_shop_connections c
    INNER JOIN public.organization_tiktok_shop_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_tiktok_shop_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tiktok_shop_integration_enabled(uuid) TO authenticated;

DROP TRIGGER IF EXISTS update_organization_tiktok_shop_connections_updated_at
  ON public.organization_tiktok_shop_connections;
CREATE TRIGGER update_organization_tiktok_shop_connections_updated_at
  BEFORE UPDATE ON public.organization_tiktok_shop_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_tiktok_shop_accounts_updated_at
  ON public.organization_tiktok_shop_accounts;
CREATE TRIGGER update_organization_tiktok_shop_accounts_updated_at
  BEFORE UPDATE ON public.organization_tiktok_shop_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_tiktok_shop_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_shop_connections_select_org
  ON public.organization_tiktok_shop_connections;
CREATE POLICY organization_tiktok_shop_connections_select_org
  ON public.organization_tiktok_shop_connections
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_tiktok_shop_connections_admin_write
  ON public.organization_tiktok_shop_connections;
CREATE POLICY organization_tiktok_shop_connections_admin_write
  ON public.organization_tiktok_shop_connections
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

ALTER TABLE public.organization_tiktok_shop_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_shop_accounts_select_org
  ON public.organization_tiktok_shop_accounts;
CREATE POLICY organization_tiktok_shop_accounts_select_org
  ON public.organization_tiktok_shop_accounts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_tiktok_shop_accounts_admin_write
  ON public.organization_tiktok_shop_accounts;
CREATE POLICY organization_tiktok_shop_accounts_admin_write
  ON public.organization_tiktok_shop_accounts
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));
