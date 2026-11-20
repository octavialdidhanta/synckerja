-- Per-tenant Google Ads: connections, encrypted tokens, multi-brand accounts, lead routing.

-- ---------------------------------------------------------------------------
-- OAuth CSRF state (short-lived)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_ads_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  state_token text NOT NULL,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_ads_oauth_states_state_token_key UNIQUE (state_token)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_oauth_states_expires
  ON public.google_ads_oauth_states (expires_at);

ALTER TABLE public.google_ads_oauth_states ENABLE ROW LEVEL SECURITY;

-- No policies: service role only (Edge Functions).

-- ---------------------------------------------------------------------------
-- Connection metadata (safe for authenticated read via RLS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_google_ads_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  login_customer_id text NULL,
  is_active boolean NOT NULL DEFAULT false,
  oauth_connected_at timestamptz NULL,
  last_test_at timestamptz NULL,
  last_test_ok boolean NULL,
  last_test_error text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_google_ads_connections_org_key UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_google_ads_connections_org
  ON public.organization_google_ads_connections (organization_id);

COMMENT ON TABLE public.organization_google_ads_connections IS
  'Per-org Google Ads connection metadata (no refresh token; see organization_google_ads_connection_tokens).';

-- ---------------------------------------------------------------------------
-- Encrypted refresh token (service role / Edge Functions only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_google_ads_connection_tokens (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  refresh_token_enc text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_google_ads_connection_tokens IS
  'Encrypted OAuth refresh token per org. No authenticated RLS — Edge Functions only.';

ALTER TABLE public.organization_google_ads_connection_tokens ENABLE ROW LEVEL SECURITY;
-- Block all client access
DROP POLICY IF EXISTS organization_google_ads_connection_tokens_deny ON public.organization_google_ads_connection_tokens;
CREATE POLICY organization_google_ads_connection_tokens_deny
  ON public.organization_google_ads_connection_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Brand / customer accounts (multi-brand per org)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_google_ads_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  customer_id text NOT NULL,
  conversion_action_id text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_google_ads_accounts_customer_digits
    CHECK (customer_id ~ '^[0-9]{10}$'),
  CONSTRAINT organization_google_ads_accounts_conversion_digits
    CHECK (conversion_action_id ~ '^[0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_organization_google_ads_accounts_org
  ON public.organization_google_ads_accounts (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_google_ads_accounts_one_default
  ON public.organization_google_ads_accounts (organization_id)
  WHERE is_default = true AND is_active = true;

COMMENT ON TABLE public.organization_google_ads_accounts IS
  'Google Ads customer + conversion action per brand; one default per org.';

-- ---------------------------------------------------------------------------
-- Lead → account override
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS google_ads_account_id uuid NULL
  REFERENCES public.organization_google_ads_accounts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_google_ads_account_id
  ON public.leads (google_ads_account_id)
  WHERE google_ads_account_id IS NOT NULL;

COMMENT ON COLUMN public.leads.google_ads_account_id IS
  'Optional Google Ads brand account; when null, upload uses org default account.';

-- ---------------------------------------------------------------------------
-- Upload audit log extension
-- ---------------------------------------------------------------------------
ALTER TABLE public.google_ads_conversion_uploads
  ADD COLUMN IF NOT EXISTS google_ads_account_id uuid NULL
  REFERENCES public.organization_google_ads_accounts (id) ON DELETE SET NULL;

ALTER TABLE public.google_ads_conversion_uploads
  ADD COLUMN IF NOT EXISTS customer_id_snapshot text NULL;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_organization_google_ads_connections_updated_at
  ON public.organization_google_ads_connections;
CREATE TRIGGER update_organization_google_ads_connections_updated_at
  BEFORE UPDATE ON public.organization_google_ads_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_google_ads_accounts_updated_at
  ON public.organization_google_ads_accounts;
CREATE TRIGGER update_organization_google_ads_accounts_updated_at
  BEFORE UPDATE ON public.organization_google_ads_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_google_ads_integration_enabled(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_google_ads_connections c
    INNER JOIN public.organization_google_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_google_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_google_ads_integration_enabled(uuid) IS
  'True when org has active Google Ads OAuth, uploads enabled, and at least one active account.';

GRANT EXECUTE ON FUNCTION public.is_google_ads_integration_enabled(uuid) TO authenticated;

-- Reuse omnichannel settings admin for Google Ads settings mutations from client (accounts table only).
-- Token writes go through Edge Functions (service role).

-- ---------------------------------------------------------------------------
-- RLS: organization_google_ads_connections
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_google_ads_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_google_ads_connections_select_org ON public.organization_google_ads_connections;
CREATE POLICY organization_google_ads_connections_select_org
  ON public.organization_google_ads_connections
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_google_ads_connections_admin_write ON public.organization_google_ads_connections;
CREATE POLICY organization_google_ads_connections_admin_write
  ON public.organization_google_ads_connections
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

-- ---------------------------------------------------------------------------
-- RLS: organization_google_ads_accounts
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_google_ads_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_google_ads_accounts_select_org ON public.organization_google_ads_accounts;
CREATE POLICY organization_google_ads_accounts_select_org
  ON public.organization_google_ads_accounts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_google_ads_accounts_admin_write ON public.organization_google_ads_accounts;
CREATE POLICY organization_google_ads_accounts_admin_write
  ON public.organization_google_ads_accounts
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

-- ---------------------------------------------------------------------------
-- Page access: /omnichannel/settings/google-ads
-- ---------------------------------------------------------------------------
INSERT INTO public.permission_configuration_defaults (
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
VALUES
  (
    '/omnichannel/settings/google-ads',
    'Pengaturan Omnichannel — Google Ads',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  )
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  job_levels_allowed = EXCLUDED.job_levels_allowed,
  exceptions = EXCLUDED.exceptions,
  exception_paths = EXCLUDED.exception_paths,
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id,
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
SELECT
  o.id,
  d.page_path,
  d.page_title,
  d.is_active,
  d.roles_allowed,
  d.job_levels_allowed,
  d.exceptions,
  d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path = '/omnichannel/settings/google-ads'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
