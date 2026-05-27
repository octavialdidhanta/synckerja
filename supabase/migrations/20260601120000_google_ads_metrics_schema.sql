-- Google Ads metrics reporting: cache, reporting RPC, page permission, column preferences.

-- ---------------------------------------------------------------------------
-- 1) Server-side metrics cache (Edge Functions / service role only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_ads_metrics_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  entity text NOT NULL,
  date_start date NOT NULL,
  date_end date NOT NULL,
  metrics_key text NOT NULL,
  status_filter text NOT NULL DEFAULT 'all',
  only_running boolean NOT NULL DEFAULT true,
  page_token text NOT NULL DEFAULT ''::text,
  sort_key text NOT NULL DEFAULT 'spent:desc',
  response_json jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_ads_metrics_cache_entity_check CHECK (
    entity = ANY (ARRAY['campaign'::text, 'ad_group'::text, 'ad'::text])
  ),
  CONSTRAINT google_ads_metrics_cache_status_filter_check CHECK (
    status_filter = ANY (ARRAY['all'::text, 'enabled_only'::text])
  )
);

ALTER TABLE public.google_ads_metrics_cache
  ADD CONSTRAINT google_ads_metrics_cache_lookup_key UNIQUE (
    organization_id,
    customer_id,
    entity,
    date_start,
    date_end,
    metrics_key,
    status_filter,
    only_running,
    page_token,
    sort_key
  );

CREATE INDEX IF NOT EXISTS idx_google_ads_metrics_cache_expires
  ON public.google_ads_metrics_cache (expires_at);

COMMENT ON TABLE public.google_ads_metrics_cache IS
  'Short-lived cache for Google Ads GAQL metric fetches (service role only).';

ALTER TABLE public.google_ads_metrics_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_ads_metrics_cache_deny ON public.google_ads_metrics_cache;
CREATE POLICY google_ads_metrics_cache_deny
  ON public.google_ads_metrics_cache
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2) Reporting enabled (OAuth + account; uploads toggle not required)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_google_ads_reporting_enabled(p_organization_id uuid)
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
      AND c.oauth_connected_at IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_google_ads_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_google_ads_reporting_enabled(uuid) IS
  'True when org has Google Ads OAuth and at least one active account (reporting; uploads toggle optional).';

GRANT EXECUTE ON FUNCTION public.is_google_ads_reporting_enabled(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Page permission: /digital-marketing/google-ads
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
VALUES (
  '/digital-marketing/google-ads',
  'Digital Marketing — Google Ads',
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
WHERE d.page_path = '/digital-marketing/google-ads'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );

-- ---------------------------------------------------------------------------
-- 4) Per-user metric column preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_google_ads_metrics_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entity text NOT NULL,
  selected_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_google_ads_metrics_preferences_entity_check CHECK (
    entity = ANY (ARRAY['campaign'::text, 'ad_group'::text, 'ad'::text])
  ),
  CONSTRAINT organization_google_ads_metrics_preferences_unique
    UNIQUE (organization_id, user_id, entity),
  CONSTRAINT organization_google_ads_metrics_preferences_metrics_array
    CHECK (jsonb_typeof(selected_metrics) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_google_ads_metrics_prefs_org_user
  ON public.organization_google_ads_metrics_preferences (organization_id, user_id);

COMMENT ON TABLE public.organization_google_ads_metrics_preferences IS
  'Saved Google Ads metrics column keys per user, org, and entity tab.';

ALTER TABLE public.organization_google_ads_metrics_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_google_ads_metrics_preferences_select ON public.organization_google_ads_metrics_preferences;
CREATE POLICY organization_google_ads_metrics_preferences_select
  ON public.organization_google_ads_metrics_preferences
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS organization_google_ads_metrics_preferences_insert ON public.organization_google_ads_metrics_preferences;
CREATE POLICY organization_google_ads_metrics_preferences_insert
  ON public.organization_google_ads_metrics_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS organization_google_ads_metrics_preferences_update ON public.organization_google_ads_metrics_preferences;
CREATE POLICY organization_google_ads_metrics_preferences_update
  ON public.organization_google_ads_metrics_preferences
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS organization_google_ads_metrics_preferences_delete ON public.organization_google_ads_metrics_preferences;
CREATE POLICY organization_google_ads_metrics_preferences_delete
  ON public.organization_google_ads_metrics_preferences
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP TRIGGER IF EXISTS update_organization_google_ads_metrics_preferences_updated_at
  ON public.organization_google_ads_metrics_preferences;
CREATE TRIGGER update_organization_google_ads_metrics_preferences_updated_at
  BEFORE UPDATE ON public.organization_google_ads_metrics_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
