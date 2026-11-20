-- KPI targets for Social Media Insight Report (per platform, monthly/quarterly).

CREATE TABLE public.social_media_insight_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'youtube', 'linkedin')),
  metric text NOT NULL CHECK (metric IN (
    'audience', 'views', 'likes', 'comments', 'shares', 'avg_engagement_rate'
  )),
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly')),
  year int NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month int CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  quarter int CHECK (quarter IS NULL OR (quarter >= 1 AND quarter <= 4)),
  target_value numeric NOT NULL CHECK (target_value >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smit_period_shape CHECK (
    (period_type = 'monthly' AND month IS NOT NULL AND quarter IS NULL) OR
    (period_type = 'quarterly' AND quarter IS NOT NULL AND month IS NULL)
  )
);

CREATE UNIQUE INDEX social_media_insight_targets_unique_monthly
  ON public.social_media_insight_targets (organization_id, platform, metric, year, month)
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX social_media_insight_targets_unique_quarterly
  ON public.social_media_insight_targets (organization_id, platform, metric, year, quarter)
  WHERE period_type = 'quarterly';

CREATE INDEX social_media_insight_targets_org_period_idx
  ON public.social_media_insight_targets (organization_id, period_type, year, month, quarter);

ALTER TABLE public.social_media_insight_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_media_insight_targets_select ON public.social_media_insight_targets;
CREATE POLICY social_media_insight_targets_select
  ON public.social_media_insight_targets
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS social_media_insight_targets_insert ON public.social_media_insight_targets;
CREATE POLICY social_media_insight_targets_insert
  ON public.social_media_insight_targets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS social_media_insight_targets_update ON public.social_media_insight_targets;
CREATE POLICY social_media_insight_targets_update
  ON public.social_media_insight_targets
  FOR UPDATE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS social_media_insight_targets_delete ON public.social_media_insight_targets;
CREATE POLICY social_media_insight_targets_delete
  ON public.social_media_insight_targets
  FOR DELETE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id));

DROP TRIGGER IF EXISTS update_social_media_insight_targets_updated_at
  ON public.social_media_insight_targets;
CREATE TRIGGER update_social_media_insight_targets_updated_at
  BEFORE UPDATE ON public.social_media_insight_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.social_media_insight_targets IS
  'Organic social KPI targets per platform for Social Media Insight Report (monthly/quarterly).';
