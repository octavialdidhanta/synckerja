-- Persist sort column + direction per user/org/entity (with selected_metrics).

ALTER TABLE public.organization_google_ads_metrics_preferences
  ADD COLUMN IF NOT EXISTS sort_field text,
  ADD COLUMN IF NOT EXISTS sort_direction text;

ALTER TABLE public.organization_google_ads_metrics_preferences
  DROP CONSTRAINT IF EXISTS organization_google_ads_metrics_preferences_sort_direction_check;

ALTER TABLE public.organization_google_ads_metrics_preferences
  ADD CONSTRAINT organization_google_ads_metrics_preferences_sort_direction_check
  CHECK (sort_direction IS NULL OR sort_direction IN ('asc', 'desc'));

COMMENT ON COLUMN public.organization_google_ads_metrics_preferences.sort_field IS
  'UI sort column key (identity or metric key) for metrics table.';
COMMENT ON COLUMN public.organization_google_ads_metrics_preferences.sort_direction IS
  'asc or desc — toolbar High→low maps to desc for metrics.';
