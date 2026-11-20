-- Global + per-org named column presets for Meta Ads metrics.

CREATE TABLE IF NOT EXISTS public.meta_ads_global_column_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity text NOT NULL,
  name text NOT NULL,
  metric_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_ads_global_column_sets_entity_check CHECK (
    entity = ANY (ARRAY['campaign'::text, 'adset'::text, 'ad'::text])
  ),
  CONSTRAINT meta_ads_global_column_sets_unique UNIQUE (entity, name),
  CONSTRAINT meta_ads_global_column_sets_metric_keys_array CHECK (jsonb_typeof(metric_keys) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_global_column_sets_entity
  ON public.meta_ads_global_column_sets (entity);

COMMENT ON TABLE public.meta_ads_global_column_sets IS
  'Global Meta Ads metric column presets shared across all tenants.';

ALTER TABLE public.meta_ads_global_column_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_ads_global_column_sets_select ON public.meta_ads_global_column_sets;
CREATE POLICY meta_ads_global_column_sets_select
  ON public.meta_ads_global_column_sets
  FOR SELECT
  TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS update_meta_ads_global_column_sets_updated_at
  ON public.meta_ads_global_column_sets;
CREATE TRIGGER update_meta_ads_global_column_sets_updated_at
  BEFORE UPDATE ON public.meta_ads_global_column_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.meta_ads_global_column_sets (entity, name, metric_keys)
VALUES
  (
    'campaign',
    'Web Speed Performance',
    '["clicks","traffic_total_visit_page","traffic_visit_click_rate"]'::jsonb
  ),
  (
    'campaign',
    'Offering Performance',
    '["traffic_total_visit_page","leads_total","leads_visit_rate","leads_cost_per_lead"]'::jsonb
  )
ON CONFLICT (entity, name) DO UPDATE
SET metric_keys = EXCLUDED.metric_keys,
    updated_at = now();

-- Per-user/org column presets
CREATE TABLE IF NOT EXISTS public.organization_meta_ads_column_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entity text NOT NULL,
  name text NOT NULL,
  metric_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_meta_ads_column_sets_entity_check CHECK (
    entity = ANY (ARRAY['campaign'::text, 'adset'::text, 'ad'::text])
  ),
  CONSTRAINT organization_meta_ads_column_sets_unique
    UNIQUE (organization_id, user_id, entity, name),
  CONSTRAINT organization_meta_ads_column_sets_metric_keys_array
    CHECK (jsonb_typeof(metric_keys) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_column_sets_org_user_entity
  ON public.organization_meta_ads_column_sets (organization_id, user_id, entity);

COMMENT ON TABLE public.organization_meta_ads_column_sets IS
  'Saved Meta Ads metric column presets per user, org, and entity tab.';

ALTER TABLE public.organization_meta_ads_column_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_meta_ads_column_sets_select
  ON public.organization_meta_ads_column_sets;
CREATE POLICY organization_meta_ads_column_sets_select
  ON public.organization_meta_ads_column_sets
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

DROP POLICY IF EXISTS organization_meta_ads_column_sets_insert
  ON public.organization_meta_ads_column_sets;
CREATE POLICY organization_meta_ads_column_sets_insert
  ON public.organization_meta_ads_column_sets
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

DROP POLICY IF EXISTS organization_meta_ads_column_sets_update
  ON public.organization_meta_ads_column_sets;
CREATE POLICY organization_meta_ads_column_sets_update
  ON public.organization_meta_ads_column_sets
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

DROP POLICY IF EXISTS organization_meta_ads_column_sets_delete
  ON public.organization_meta_ads_column_sets;
CREATE POLICY organization_meta_ads_column_sets_delete
  ON public.organization_meta_ads_column_sets
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

DROP TRIGGER IF EXISTS update_organization_meta_ads_column_sets_updated_at
  ON public.organization_meta_ads_column_sets;
CREATE TRIGGER update_organization_meta_ads_column_sets_updated_at
  BEFORE UPDATE ON public.organization_meta_ads_column_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
