-- Employee assignment + OKR key_result link for Social Media Insight KPI targets.

ALTER TABLE public.social_media_insight_targets
  ADD COLUMN IF NOT EXISTS key_result_id uuid NULL REFERENCES public.key_results(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.social_media_insight_targets.key_result_id IS
  'Linked OKR key_result synced from this insight target row.';

CREATE INDEX IF NOT EXISTS social_media_insight_targets_key_result_idx
  ON public.social_media_insight_targets (key_result_id)
  WHERE key_result_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.social_media_insight_target_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'youtube', 'linkedin')),
  account_id text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly')),
  year int NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month int CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  quarter int CHECK (quarter IS NULL OR (quarter >= 1 AND quarter <= 4)),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  individual_objective_id uuid NULL REFERENCES public.individual_objectives(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smita_period_shape CHECK (
    (period_type = 'monthly' AND month IS NOT NULL AND quarter IS NULL) OR
    (period_type = 'quarterly' AND quarter IS NOT NULL AND month IS NULL)
  )
);

CREATE UNIQUE INDEX social_media_insight_target_assignments_unique_monthly
  ON public.social_media_insight_target_assignments (organization_id, platform, account_id, year, month)
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX social_media_insight_target_assignments_unique_quarterly
  ON public.social_media_insight_target_assignments (organization_id, platform, account_id, year, quarter)
  WHERE period_type = 'quarterly';

CREATE INDEX social_media_insight_target_assignments_org_period_idx
  ON public.social_media_insight_target_assignments (organization_id, period_type, year, month, quarter);

CREATE INDEX social_media_insight_target_assignments_employee_idx
  ON public.social_media_insight_target_assignments (organization_id, employee_id);

COMMENT ON TABLE public.social_media_insight_target_assignments IS
  'Per-account employee PIC for Social Media Insight KPI targets (one assignee per account per period).';

ALTER TABLE public.social_media_insight_target_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_media_insight_target_assignments_select
  ON public.social_media_insight_target_assignments;
CREATE POLICY social_media_insight_target_assignments_select
  ON public.social_media_insight_target_assignments
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS social_media_insight_target_assignments_insert
  ON public.social_media_insight_target_assignments;
CREATE POLICY social_media_insight_target_assignments_insert
  ON public.social_media_insight_target_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS social_media_insight_target_assignments_update
  ON public.social_media_insight_target_assignments;
CREATE POLICY social_media_insight_target_assignments_update
  ON public.social_media_insight_target_assignments
  FOR UPDATE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP POLICY IF EXISTS social_media_insight_target_assignments_delete
  ON public.social_media_insight_target_assignments;
CREATE POLICY social_media_insight_target_assignments_delete
  ON public.social_media_insight_target_assignments
  FOR DELETE
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id));

DROP TRIGGER IF EXISTS update_social_media_insight_target_assignments_updated_at
  ON public.social_media_insight_target_assignments;
CREATE TRIGGER update_social_media_insight_target_assignments_updated_at
  BEFORE UPDATE ON public.social_media_insight_target_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
