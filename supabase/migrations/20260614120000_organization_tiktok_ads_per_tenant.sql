-- Per-tenant TikTok Ads: OAuth state, encrypted tokens, multi advertiser accounts, metrics cache.

CREATE TABLE IF NOT EXISTS public.tiktok_ads_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  state_token text NOT NULL,
  return_path text NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_ads_oauth_states_state_token_key UNIQUE (state_token)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_ads_oauth_states_expires
  ON public.tiktok_ads_oauth_states (expires_at);

ALTER TABLE public.tiktok_ads_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_tiktok_ads_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  tiktok_user_id text NULL,
  is_active boolean NOT NULL DEFAULT false,
  oauth_connected_at timestamptz NULL,
  last_test_at timestamptz NULL,
  last_test_ok boolean NULL,
  last_test_error text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_tiktok_ads_connections_org_key UNIQUE (organization_id)
);

COMMENT ON TABLE public.organization_tiktok_ads_connections IS
  'Per-org TikTok Ads connection metadata (is_active reserved for future Events API uploads).';

CREATE TABLE IF NOT EXISTS public.organization_tiktok_ads_connection_tokens (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  access_token_enc text NOT NULL,
  refresh_token_enc text NOT NULL,
  access_token_expires_at timestamptz NULL,
  refresh_token_expires_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_tiktok_ads_connection_tokens IS
  'Encrypted TikTok OAuth tokens per org. Edge Functions only.';

ALTER TABLE public.organization_tiktok_ads_connection_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_ads_connection_tokens_deny
  ON public.organization_tiktok_ads_connection_tokens;
CREATE POLICY organization_tiktok_ads_connection_tokens_deny
  ON public.organization_tiktok_ads_connection_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.organization_tiktok_ads_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  advertiser_id text NOT NULL,
  pixel_code text NULL,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_tiktok_ads_accounts_advertiser_digits
    CHECK (advertiser_id ~ '^[0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_organization_tiktok_ads_accounts_org
  ON public.organization_tiktok_ads_accounts (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_tiktok_ads_accounts_one_default
  ON public.organization_tiktok_ads_accounts (organization_id)
  WHERE is_default = true AND is_active = true;

COMMENT ON TABLE public.organization_tiktok_ads_accounts IS
  'TikTok advertiser accounts for reporting (pixel_code optional, for future Events API).';

CREATE TABLE IF NOT EXISTS public.tiktok_ads_metrics_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  advertiser_id text NOT NULL,
  entity text NOT NULL,
  date_start date NOT NULL,
  date_end date NOT NULL,
  metrics_key text NOT NULL DEFAULT 'default',
  page_token text NOT NULL DEFAULT ''::text,
  response_json jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_ads_metrics_cache_entity_check CHECK (
    entity = ANY (ARRAY['campaign'::text, 'adgroup'::text, 'ad'::text])
  )
);

ALTER TABLE public.tiktok_ads_metrics_cache
  ADD CONSTRAINT tiktok_ads_metrics_cache_lookup_key UNIQUE (
    organization_id,
    advertiser_id,
    entity,
    date_start,
    date_end,
    metrics_key,
    page_token
  );

CREATE INDEX IF NOT EXISTS idx_tiktok_ads_metrics_cache_expires
  ON public.tiktok_ads_metrics_cache (expires_at);

ALTER TABLE public.tiktok_ads_metrics_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tiktok_ads_metrics_cache_deny ON public.tiktok_ads_metrics_cache;
CREATE POLICY tiktok_ads_metrics_cache_deny
  ON public.tiktok_ads_metrics_cache
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.organization_tiktok_ads_metrics_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entity text NOT NULL DEFAULT 'campaign',
  visible_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_key text NOT NULL DEFAULT 'spend:desc',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_tiktok_ads_metrics_preferences_entity_check CHECK (
    entity = ANY (ARRAY['campaign'::text, 'adgroup'::text, 'ad'::text])
  ),
  CONSTRAINT organization_tiktok_ads_metrics_preferences_org_user_entity_key
    UNIQUE (organization_id, user_id, entity)
);

ALTER TABLE public.organization_tiktok_ads_metrics_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_ads_metrics_preferences_select
  ON public.organization_tiktok_ads_metrics_preferences;
CREATE POLICY organization_tiktok_ads_metrics_preferences_select
  ON public.organization_tiktok_ads_metrics_preferences
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_tiktok_ads_metrics_preferences_write
  ON public.organization_tiktok_ads_metrics_preferences;
CREATE POLICY organization_tiktok_ads_metrics_preferences_write
  ON public.organization_tiktok_ads_metrics_preferences
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.tiktok_ads_global_column_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity text NOT NULL,
  name text NOT NULL,
  metric_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_ads_global_column_sets_entity_check CHECK (
    entity = ANY (ARRAY['campaign'::text, 'adgroup'::text, 'ad'::text])
  ),
  CONSTRAINT tiktok_ads_global_column_sets_unique UNIQUE (entity, name),
  CONSTRAINT tiktok_ads_global_column_sets_metric_keys_array CHECK (jsonb_typeof(metric_keys) = 'array')
);

ALTER TABLE public.tiktok_ads_global_column_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tiktok_ads_global_column_sets_select ON public.tiktok_ads_global_column_sets;
CREATE POLICY tiktok_ads_global_column_sets_select
  ON public.tiktok_ads_global_column_sets
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.tiktok_ads_global_column_sets (entity, name, metric_keys)
VALUES
  ('campaign', 'Performance', '["spend","impressions","clicks","ctr","cpc"]'::jsonb),
  ('adgroup', 'Performance', '["spend","impressions","clicks","ctr","cpc"]'::jsonb),
  ('ad', 'Performance', '["spend","impressions","clicks","ctr","cpc"]'::jsonb)
ON CONFLICT (entity, name) DO UPDATE
SET metric_keys = EXCLUDED.metric_keys,
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.organization_tiktok_ads_column_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entity text NOT NULL,
  name text NOT NULL,
  metric_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_tiktok_ads_column_sets_entity_check CHECK (
    entity = ANY (ARRAY['campaign'::text, 'adgroup'::text, 'ad'::text])
  ),
  CONSTRAINT organization_tiktok_ads_column_sets_unique
    UNIQUE (organization_id, user_id, entity, name),
  CONSTRAINT organization_tiktok_ads_column_sets_metric_keys_array
    CHECK (jsonb_typeof(metric_keys) = 'array')
);

ALTER TABLE public.organization_tiktok_ads_column_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_ads_column_sets_select
  ON public.organization_tiktok_ads_column_sets;
CREATE POLICY organization_tiktok_ads_column_sets_select
  ON public.organization_tiktok_ads_column_sets
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_tiktok_ads_column_sets_write
  ON public.organization_tiktok_ads_column_sets;
CREATE POLICY organization_tiktok_ads_column_sets_write
  ON public.organization_tiktok_ads_column_sets
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

CREATE TABLE IF NOT EXISTS public.organization_tiktok_ads_campaign_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  advertiser_id text NOT NULL,
  campaign_id text NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_tiktok_ads_campaign_services_advertiser_digits CHECK (
    advertiser_id ~ '^[0-9]+$'
  ),
  CONSTRAINT organization_tiktok_ads_campaign_services_campaign_id_nonempty CHECK (
    length(trim(campaign_id)) > 0
  ),
  CONSTRAINT organization_tiktok_ads_campaign_services_unique
    UNIQUE (organization_id, advertiser_id, campaign_id)
);

ALTER TABLE public.organization_tiktok_ads_campaign_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_ads_campaign_services_select
  ON public.organization_tiktok_ads_campaign_services;
CREATE POLICY organization_tiktok_ads_campaign_services_select
  ON public.organization_tiktok_ads_campaign_services
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_tiktok_ads_campaign_services_write
  ON public.organization_tiktok_ads_campaign_services;
CREATE POLICY organization_tiktok_ads_campaign_services_write
  ON public.organization_tiktok_ads_campaign_services
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  )
  WITH CHECK (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP TRIGGER IF EXISTS update_organization_tiktok_ads_connections_updated_at
  ON public.organization_tiktok_ads_connections;
CREATE TRIGGER update_organization_tiktok_ads_connections_updated_at
  BEFORE UPDATE ON public.organization_tiktok_ads_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_tiktok_ads_accounts_updated_at
  ON public.organization_tiktok_ads_accounts;
CREATE TRIGGER update_organization_tiktok_ads_accounts_updated_at
  BEFORE UPDATE ON public.organization_tiktok_ads_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_tiktok_ads_campaign_services_updated_at
  ON public.organization_tiktok_ads_campaign_services;
CREATE TRIGGER update_organization_tiktok_ads_campaign_services_updated_at
  BEFORE UPDATE ON public.organization_tiktok_ads_campaign_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_tiktok_ads_integration_enabled(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_tiktok_ads_connections c
    INNER JOIN public.organization_tiktok_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_tiktok_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tiktok_ads_integration_enabled(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_tiktok_ads_reporting_enabled(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_tiktok_ads_connections c
    INNER JOIN public.organization_tiktok_ads_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = p_organization_id
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_tiktok_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tiktok_ads_reporting_enabled(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_tiktok_ads_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_tiktok_ads_connections c
    WHERE c.organization_id = p_organization_id
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_tiktok_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tiktok_ads_connected(uuid) TO authenticated;

ALTER TABLE public.organization_tiktok_ads_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_ads_connections_select_org
  ON public.organization_tiktok_ads_connections;
CREATE POLICY organization_tiktok_ads_connections_select_org
  ON public.organization_tiktok_ads_connections
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_tiktok_ads_connections_admin_write
  ON public.organization_tiktok_ads_connections;
CREATE POLICY organization_tiktok_ads_connections_admin_write
  ON public.organization_tiktok_ads_connections
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

ALTER TABLE public.organization_tiktok_ads_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_ads_accounts_select_org
  ON public.organization_tiktok_ads_accounts;
CREATE POLICY organization_tiktok_ads_accounts_select_org
  ON public.organization_tiktok_ads_accounts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_tiktok_ads_accounts_admin_write
  ON public.organization_tiktok_ads_accounts;
CREATE POLICY organization_tiktok_ads_accounts_admin_write
  ON public.organization_tiktok_ads_accounts
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

INSERT INTO public.permission_configuration_defaults (
  page_path, page_title, is_active, roles_allowed, job_levels_allowed, exceptions, exception_paths
)
VALUES (
  '/digital-marketing/tiktok-ads/settings',
  'Digital Marketing — TikTok Ads Settings',
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
WHERE d.page_path = '/digital-marketing/tiktok-ads/settings'
AND NOT EXISTS (
  SELECT 1 FROM public.permission_configurations p
  WHERE p.organization_id = o.id AND p.page_path = d.page_path
);
