-- Per-period Department Objective link for Social Media Insight KPI targets.

CREATE TABLE IF NOT EXISTS public.social_media_insight_target_period_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly')),
  year int NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month int CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  quarter int CHECK (quarter IS NULL OR (quarter >= 1 AND quarter <= 4)),
  department_objective_id uuid NOT NULL REFERENCES public.department_objectives(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smitps_period_shape CHECK (
    (period_type = 'monthly' AND month IS NOT NULL AND quarter IS NULL) OR
    (period_type = 'quarterly' AND quarter IS NOT NULL AND month IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS social_media_insight_target_period_settings_unique_monthly
  ON public.social_media_insight_target_period_settings (organization_id, year, month)
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX IF NOT EXISTS social_media_insight_target_period_settings_unique_quarterly
  ON public.social_media_insight_target_period_settings (organization_id, year, quarter)
  WHERE period_type = 'quarterly';

CREATE INDEX IF NOT EXISTS social_media_insight_target_period_settings_org_period_idx
  ON public.social_media_insight_target_period_settings (organization_id, period_type, year, month, quarter);

COMMENT ON TABLE public.social_media_insight_target_period_settings IS
  'Required Department Objective per insight target period; all synced Individual Objectives link here.';

ALTER TABLE public.social_media_insight_target_period_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_media_insight_target_period_settings_select
  ON public.social_media_insight_target_period_settings;
CREATE POLICY social_media_insight_target_period_settings_select
  ON public.social_media_insight_target_period_settings
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS social_media_insight_target_period_settings_insert
  ON public.social_media_insight_target_period_settings;
CREATE POLICY social_media_insight_target_period_settings_insert
  ON public.social_media_insight_target_period_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS social_media_insight_target_period_settings_update
  ON public.social_media_insight_target_period_settings;
CREATE POLICY social_media_insight_target_period_settings_update
  ON public.social_media_insight_target_period_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS social_media_insight_target_period_settings_delete
  ON public.social_media_insight_target_period_settings;
CREATE POLICY social_media_insight_target_period_settings_delete
  ON public.social_media_insight_target_period_settings
  FOR DELETE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id));

DROP TRIGGER IF EXISTS update_social_media_insight_target_period_settings_updated_at
  ON public.social_media_insight_target_period_settings;
CREATE TRIGGER update_social_media_insight_target_period_settings_updated_at
  BEFORE UPDATE ON public.social_media_insight_target_period_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
