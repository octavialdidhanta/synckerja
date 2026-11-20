-- Named column presets for Google Ads metrics (per user, org, entity).

CREATE TABLE IF NOT EXISTS public.organization_google_ads_column_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entity text NOT NULL,
  name text NOT NULL,
  metric_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_google_ads_column_sets_entity_check CHECK (
    entity = ANY (
      ARRAY[
        'campaign'::text,
        'ad_group'::text,
        'ad'::text,
        'keyword'::text
      ]
    )
  ),
  CONSTRAINT organization_google_ads_column_sets_unique
    UNIQUE (organization_id, user_id, entity, name),
  CONSTRAINT organization_google_ads_column_sets_metric_keys_array
    CHECK (jsonb_typeof(metric_keys) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_google_ads_column_sets_org_user_entity
  ON public.organization_google_ads_column_sets (organization_id, user_id, entity);

COMMENT ON TABLE public.organization_google_ads_column_sets IS
  'Saved Google Ads metric column presets (ordered metric keys) per user, org, and entity tab.';

ALTER TABLE public.organization_google_ads_column_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_google_ads_column_sets_select
  ON public.organization_google_ads_column_sets;
CREATE POLICY organization_google_ads_column_sets_select
  ON public.organization_google_ads_column_sets
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

DROP POLICY IF EXISTS organization_google_ads_column_sets_insert
  ON public.organization_google_ads_column_sets;
CREATE POLICY organization_google_ads_column_sets_insert
  ON public.organization_google_ads_column_sets
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

DROP POLICY IF EXISTS organization_google_ads_column_sets_update
  ON public.organization_google_ads_column_sets;
CREATE POLICY organization_google_ads_column_sets_update
  ON public.organization_google_ads_column_sets
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

DROP POLICY IF EXISTS organization_google_ads_column_sets_delete
  ON public.organization_google_ads_column_sets;
CREATE POLICY organization_google_ads_column_sets_delete
  ON public.organization_google_ads_column_sets
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

DROP TRIGGER IF EXISTS update_organization_google_ads_column_sets_updated_at
  ON public.organization_google_ads_column_sets;
CREATE TRIGGER update_organization_google_ads_column_sets_updated_at
  BEFORE UPDATE ON public.organization_google_ads_column_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
