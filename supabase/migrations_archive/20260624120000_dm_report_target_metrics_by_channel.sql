-- Per-channel metric selection for Digital Marketing Report KPI targets.

ALTER TABLE public.digital_marketing_report_target_period_settings
  ADD COLUMN IF NOT EXISTS selected_metrics_by_channel jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.digital_marketing_report_target_period_settings.selected_metrics_by_channel IS
  'Per-channel selected Report metric keys, e.g. {"google":["cost"],"meta":["cost","cpc"],"tiktok":[]}';

-- Copy legacy flat selected_metrics to all channels for existing rows
UPDATE public.digital_marketing_report_target_period_settings
SET selected_metrics_by_channel = jsonb_build_object(
  'google', COALESCE(to_jsonb(selected_metrics), '[]'::jsonb),
  'meta', COALESCE(to_jsonb(selected_metrics), '[]'::jsonb),
  'tiktok', COALESCE(to_jsonb(selected_metrics), '[]'::jsonb)
)
WHERE selected_metrics IS NOT NULL
  AND cardinality(selected_metrics) > 0
  AND (selected_metrics_by_channel = '{}'::jsonb OR selected_metrics_by_channel IS NULL);
