-- Per-tenant Meta Ads: OAuth state, encrypted long-lived tokens, multi ad accounts, CAPI uploads, metrics cache.

-- ---------------------------------------------------------------------------
-- OAuth CSRF state (short-lived)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_ads_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  state_token text NOT NULL,
  code_verifier text NOT NULL,
  return_path text NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_ads_oauth_states_state_token_key UNIQUE (state_token)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_oauth_states_expires
  ON public.meta_ads_oauth_states (expires_at);

ALTER TABLE public.meta_ads_oauth_states ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Connection metadata
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_meta_ads_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  meta_user_id text NULL,
  is_active boolean NOT NULL DEFAULT false,
  oauth_connected_at timestamptz NULL,
  last_test_at timestamptz NULL,
  last_test_ok boolean NULL,
  last_test_error text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_meta_ads_connections_org_key UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_meta_ads_connections_org
  ON public.organization_meta_ads_connections (organization_id);

COMMENT ON TABLE public.organization_meta_ads_connections IS
  'Per-org Meta Ads connection metadata (is_active = offline conversion uploads enabled).';

COMMENT ON COLUMN public.organization_meta_ads_connections.is_active IS
  'When true, converted CRM leads are sent to Meta Conversions API.';

-- ---------------------------------------------------------------------------
-- Encrypted long-lived access token (Edge Functions only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_meta_ads_connection_tokens (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  access_token_enc text NOT NULL,
  token_expires_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_meta_ads_connection_tokens IS
  'Encrypted Meta long-lived user access token per org. Edge Functions only.';

ALTER TABLE public.organization_meta_ads_connection_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_meta_ads_connection_tokens_deny ON public.organization_meta_ads_connection_tokens;
CREATE POLICY organization_meta_ads_connection_tokens_deny
  ON public.organization_meta_ads_connection_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Ad accounts (multi-brand per org)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_meta_ads_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  ad_account_id text NOT NULL,
  pixel_id text NOT NULL,
  default_event_name text NOT NULL DEFAULT 'Purchase',
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_meta_ads_accounts_ad_account_digits
    CHECK (ad_account_id ~ '^[0-9]+$'),
  CONSTRAINT organization_meta_ads_accounts_pixel_digits
    CHECK (pixel_id ~ '^[0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_organization_meta_ads_accounts_org
  ON public.organization_meta_ads_accounts (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_meta_ads_accounts_one_default
  ON public.organization_meta_ads_accounts (organization_id)
  WHERE is_default = true AND is_active = true;

COMMENT ON TABLE public.organization_meta_ads_accounts IS
  'Meta ad account + pixel for reporting and CAPI offline conversions.';

-- ---------------------------------------------------------------------------
-- Lead attribution + account override
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fbclid text NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meta_ads_account_id uuid NULL
  REFERENCES public.organization_meta_ads_accounts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_fbclid
  ON public.leads (fbclid)
  WHERE fbclid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_meta_ads_account_id
  ON public.leads (meta_ads_account_id)
  WHERE meta_ads_account_id IS NOT NULL;

COMMENT ON COLUMN public.leads.fbclid IS 'Facebook Click ID for Meta Ads offline conversion (CAPI).';

COMMENT ON COLUMN public.leads.meta_ads_account_id IS
  'Optional Meta Ads brand account; when null, upload uses org default account.';

-- ---------------------------------------------------------------------------
-- CAPI upload audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_ads_conversion_uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  sales_activity_id uuid NULL REFERENCES public.sales_activities (id) ON DELETE SET NULL,
  meta_ads_account_id uuid NULL REFERENCES public.organization_meta_ads_accounts (id) ON DELETE SET NULL,
  fbclid text NULL,
  event_name text NULL,
  status text NOT NULL,
  skip_reason text NULL,
  error_message text NULL,
  meta_response jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_ads_conversion_uploads_lead_id_key UNIQUE (lead_id),
  CONSTRAINT meta_ads_conversion_uploads_status_check
    CHECK (status IN ('success', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_conversion_uploads_org_created
  ON public.meta_ads_conversion_uploads (organization_id, created_at DESC);

ALTER TABLE public.meta_ads_conversion_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_ads_conversion_uploads_select_org ON public.meta_ads_conversion_uploads;
CREATE POLICY meta_ads_conversion_uploads_select_org
  ON public.meta_ads_conversion_uploads
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

DROP POLICY IF EXISTS meta_ads_conversion_uploads_block_writes ON public.meta_ads_conversion_uploads;
CREATE POLICY meta_ads_conversion_uploads_block_writes
  ON public.meta_ads_conversion_uploads
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Metrics cache
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_ads_metrics_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,
  entity text NOT NULL,
  date_start date NOT NULL,
  date_end date NOT NULL,
  metrics_key text NOT NULL DEFAULT 'default',
  page_token text NOT NULL DEFAULT ''::text,
  response_json jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_ads_metrics_cache_entity_check CHECK (
    entity = ANY (ARRAY['campaign'::text, 'adset'::text, 'ad'::text])
  )
);

ALTER TABLE public.meta_ads_metrics_cache
  ADD CONSTRAINT meta_ads_metrics_cache_lookup_key UNIQUE (
    organization_id,
    ad_account_id,
    entity,
    date_start,
    date_end,
    metrics_key,
    page_token
  );

CREATE INDEX IF NOT EXISTS idx_meta_ads_metrics_cache_expires
  ON public.meta_ads_metrics_cache (expires_at);

ALTER TABLE public.meta_ads_metrics_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_ads_metrics_cache_deny ON public.meta_ads_metrics_cache;
CREATE POLICY meta_ads_metrics_cache_deny
  ON public.meta_ads_metrics_cache
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Metrics column preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_meta_ads_metrics_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entity text NOT NULL DEFAULT 'campaign',
  visible_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_key text NOT NULL DEFAULT 'spend:desc',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_meta_ads_metrics_preferences_entity_check CHECK (
    entity = ANY (ARRAY['campaign'::text, 'adset'::text, 'ad'::text])
  ),
  CONSTRAINT organization_meta_ads_metrics_preferences_org_user_entity_key
    UNIQUE (organization_id, user_id, entity)
);

ALTER TABLE public.organization_meta_ads_metrics_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_meta_ads_metrics_preferences_select ON public.organization_meta_ads_metrics_preferences;
CREATE POLICY organization_meta_ads_metrics_preferences_select
  ON public.organization_meta_ads_metrics_preferences
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_meta_ads_metrics_preferences_write ON public.organization_meta_ads_metrics_preferences;
CREATE POLICY organization_meta_ads_metrics_preferences_write
  ON public.organization_meta_ads_metrics_preferences
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_organization_meta_ads_connections_updated_at
  ON public.organization_meta_ads_connections;
CREATE TRIGGER update_organization_meta_ads_connections_updated_at
  BEFORE UPDATE ON public.organization_meta_ads_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_meta_ads_accounts_updated_at
  ON public.organization_meta_ads_accounts;
CREATE TRIGGER update_organization_meta_ads_accounts_updated_at
  BEFORE UPDATE ON public.organization_meta_ads_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meta_ads_conversion_uploads_updated_at
  ON public.meta_ads_conversion_uploads;
CREATE TRIGGER update_meta_ads_conversion_uploads_updated_at
  BEFORE UPDATE ON public.meta_ads_conversion_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RPC helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_meta_ads_integration_enabled(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_connections c
    INNER JOIN public.organization_meta_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_meta_ads_integration_enabled(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_meta_ads_reporting_enabled(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_connections c
    INNER JOIN public.organization_meta_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_meta_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_meta_ads_reporting_enabled(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: connections + accounts
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_meta_ads_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_meta_ads_connections_select_org ON public.organization_meta_ads_connections;
CREATE POLICY organization_meta_ads_connections_select_org
  ON public.organization_meta_ads_connections
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_meta_ads_connections_admin_write ON public.organization_meta_ads_connections;
CREATE POLICY organization_meta_ads_connections_admin_write
  ON public.organization_meta_ads_connections
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

ALTER TABLE public.organization_meta_ads_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_meta_ads_accounts_select_org ON public.organization_meta_ads_accounts;
CREATE POLICY organization_meta_ads_accounts_select_org
  ON public.organization_meta_ads_accounts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_meta_ads_accounts_admin_write ON public.organization_meta_ads_accounts;
CREATE POLICY organization_meta_ads_accounts_admin_write
  ON public.organization_meta_ads_accounts
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

-- ---------------------------------------------------------------------------
-- Page permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permission_configuration_defaults (
  page_path, page_title, is_active, roles_allowed, job_levels_allowed, exceptions, exception_paths
)
VALUES
  (
    '/digital-marketing/meta-ads',
    'Digital Marketing — Meta Ads',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/digital-marketing/meta-ads/settings',
    'Digital Marketing — Meta Ads Settings',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/omnichannel/settings/offline-conversion',
    'Pengaturan Omnichannel — Offline Conversion',
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
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id, page_path, page_title, is_active,
  roles_allowed, job_levels_allowed, exceptions, exception_paths
)
SELECT o.id, d.page_path, d.page_title, d.is_active,
  d.roles_allowed, d.job_levels_allowed, d.exceptions, d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path IN (
  '/digital-marketing/meta-ads',
  '/digital-marketing/meta-ads/settings',
  '/omnichannel/settings/offline-conversion'
)
AND NOT EXISTS (
  SELECT 1 FROM public.permission_configurations p
  WHERE p.organization_id = o.id AND p.page_path = d.page_path
);
