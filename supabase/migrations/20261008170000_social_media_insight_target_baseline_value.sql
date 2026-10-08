-- Optional previous-period baseline ("before") on the same scale as target_value.
ALTER TABLE public.social_media_insight_targets
  ADD COLUMN IF NOT EXISTS baseline_value numeric;

COMMENT ON COLUMN public.social_media_insight_targets.baseline_value IS
  'Optional override of the previous period actual. Null means use that actual live.';
