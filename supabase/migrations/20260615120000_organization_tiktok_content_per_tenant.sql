-- Per-tenant TikTok Content Insight (Login Kit): OAuth, encrypted tokens per open_id, metrics cache.

CREATE TABLE IF NOT EXISTS public.tiktok_content_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  state_token text NOT NULL,
  return_path text NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_content_oauth_states_state_token_key UNIQUE (state_token)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_content_oauth_states_expires
  ON public.tiktok_content_oauth_states (expires_at);

ALTER TABLE public.tiktok_content_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_tiktok_content_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  oauth_connected_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_tiktok_content_connections_org_key UNIQUE (organization_id)
);

COMMENT ON TABLE public.organization_tiktok_content_connections IS
  'Per-org TikTok Content Insight connection metadata.';

CREATE TABLE IF NOT EXISTS public.organization_tiktok_content_connection_tokens (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  open_id text NOT NULL,
  access_token_enc text NOT NULL,
  refresh_token_enc text NOT NULL,
  access_token_expires_at timestamptz NULL,
  refresh_token_expires_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, open_id)
);

COMMENT ON TABLE public.organization_tiktok_content_connection_tokens IS
  'Encrypted TikTok Login Kit tokens per org + open_id. Edge Functions only.';

ALTER TABLE public.organization_tiktok_content_connection_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_content_connection_tokens_deny
  ON public.organization_tiktok_content_connection_tokens;
CREATE POLICY organization_tiktok_content_connection_tokens_deny
  ON public.organization_tiktok_content_connection_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.organization_tiktok_content_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  open_id text NOT NULL,
  label text NOT NULL DEFAULT '',
  display_name text NULL,
  avatar_url text NULL,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_tiktok_content_accounts_org_open_id_key UNIQUE (organization_id, open_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_tiktok_content_accounts_org
  ON public.organization_tiktok_content_accounts (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_tiktok_content_accounts_one_default
  ON public.organization_tiktok_content_accounts (organization_id)
  WHERE is_default = true AND is_active = true;

COMMENT ON TABLE public.organization_tiktok_content_accounts IS
  'TikTok creator/business accounts connected via Login Kit per org.';

CREATE TABLE IF NOT EXISTS public.tiktok_content_metrics_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  open_id text NOT NULL,
  date_start date NOT NULL,
  date_end date NOT NULL,
  metrics_key text NOT NULL DEFAULT 'video-list-v1',
  page_token text NOT NULL DEFAULT ''::text,
  response_json jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_content_metrics_cache
  ADD CONSTRAINT tiktok_content_metrics_cache_lookup_key UNIQUE (
    organization_id,
    open_id,
    date_start,
    date_end,
    metrics_key,
    page_token
  );

CREATE INDEX IF NOT EXISTS idx_tiktok_content_metrics_cache_expires
  ON public.tiktok_content_metrics_cache (expires_at);

ALTER TABLE public.tiktok_content_metrics_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tiktok_content_metrics_cache_deny ON public.tiktok_content_metrics_cache;
CREATE POLICY tiktok_content_metrics_cache_deny
  ON public.tiktok_content_metrics_cache
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

ALTER TABLE public.social_media_links
  ADD COLUMN IF NOT EXISTS external_post_id text NULL,
  ADD COLUMN IF NOT EXISTS platform_account_open_id text NULL,
  ADD COLUMN IF NOT EXISTS last_insights_sync_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.is_tiktok_content_connected(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_tiktok_content_connection_tokens t
    WHERE t.organization_id = p_organization_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tiktok_content_connected(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_tiktok_content_reporting_enabled(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_tiktok_content_accounts a
    WHERE a.organization_id = p_organization_id
      AND a.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tiktok_content_reporting_enabled(uuid) TO authenticated;

ALTER TABLE public.organization_tiktok_content_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_content_connections_select_org
  ON public.organization_tiktok_content_connections;
CREATE POLICY organization_tiktok_content_connections_select_org
  ON public.organization_tiktok_content_connections
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_tiktok_content_connections_admin_write
  ON public.organization_tiktok_content_connections;
CREATE POLICY organization_tiktok_content_connections_admin_write
  ON public.organization_tiktok_content_connections
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

ALTER TABLE public.organization_tiktok_content_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tiktok_content_accounts_select_org
  ON public.organization_tiktok_content_accounts;
CREATE POLICY organization_tiktok_content_accounts_select_org
  ON public.organization_tiktok_content_accounts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_tiktok_content_accounts_admin_write
  ON public.organization_tiktok_content_accounts;
CREATE POLICY organization_tiktok_content_accounts_admin_write
  ON public.organization_tiktok_content_accounts
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

INSERT INTO public.permission_configuration_defaults (
  page_path, page_title, is_active, roles_allowed, job_levels_allowed, exceptions, exception_paths
)
VALUES
  (
    '/digital-marketing/social-media-performance',
    'Digital Marketing — Social Media Performance',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/digital-marketing/social-media-performance/tiktok/settings',
    'Digital Marketing — TikTok Content Settings',
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
  '/digital-marketing/social-media-performance',
  '/digital-marketing/social-media-performance/tiktok/settings'
)
AND NOT EXISTS (
  SELECT 1 FROM public.permission_configurations p
  WHERE p.organization_id = o.id AND p.page_path = d.page_path
);
