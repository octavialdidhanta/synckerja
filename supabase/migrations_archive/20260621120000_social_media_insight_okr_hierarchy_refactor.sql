-- Social Media Insight OKR hierarchy: Company Objective → auto Dept Objective → Individual Objectives per metric.

-- 1.1 Period settings: company_objective_id instead of department_objective_id
ALTER TABLE public.social_media_insight_target_period_settings
  DROP CONSTRAINT IF EXISTS social_media_insight_target_period_settin_department_objective_id_fkey;

ALTER TABLE public.social_media_insight_target_period_settings
  ADD COLUMN IF NOT EXISTS company_objective_id uuid NULL REFERENCES public.company_objectives(id) ON DELETE RESTRICT;

ALTER TABLE public.social_media_insight_target_period_settings
  ADD COLUMN IF NOT EXISTS synced_department_objective_id uuid NULL REFERENCES public.department_objectives(id) ON DELETE SET NULL;

-- Migrate is not possible without mapping; new saves will populate company_objective_id.
ALTER TABLE public.social_media_insight_target_period_settings
  DROP COLUMN IF EXISTS department_objective_id;

COMMENT ON COLUMN public.social_media_insight_target_period_settings.company_objective_id IS
  'User-selected Company Objective linking the auto-generated Social Media KPI department objective.';
COMMENT ON COLUMN public.social_media_insight_target_period_settings.synced_department_objective_id IS
  'Cache of auto-created department objective (Social Media KPI — period).';

-- 1.2 Targets: individual_objective_id link (replaces key_result_id)
ALTER TABLE public.social_media_insight_targets
  ADD COLUMN IF NOT EXISTS individual_objective_id uuid NULL REFERENCES public.individual_objectives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS social_media_insight_targets_individual_objective_idx
  ON public.social_media_insight_targets (individual_objective_id)
  WHERE individual_objective_id IS NOT NULL;

COMMENT ON COLUMN public.social_media_insight_targets.individual_objective_id IS
  'Linked OKR individual_objective synced from this insight target row (metric-level).';

-- Drop legacy key_result_id column after app uses individual_objective_id
ALTER TABLE public.social_media_insight_targets
  DROP CONSTRAINT IF EXISTS social_media_insight_targets_key_result_id_fkey;

DROP INDEX IF EXISTS public.social_media_insight_targets_key_result_idx;

ALTER TABLE public.social_media_insight_targets
  DROP COLUMN IF EXISTS key_result_id;
