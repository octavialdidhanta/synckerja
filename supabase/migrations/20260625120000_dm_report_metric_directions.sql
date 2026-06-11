-- Per-metric progress direction for Digital Marketing Report KPI targets.
-- higher_is_better = naik lebih baik (asc), lower_is_better = turun lebih baik (desc).

ALTER TABLE public.digital_marketing_report_target_period_settings
  ADD COLUMN IF NOT EXISTS metric_directions jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.digital_marketing_report_target_period_settings.metric_directions IS
  'Per-metric OKR/progress direction, e.g. {"cpc":"lower_is_better","clicks":"higher_is_better"}';

-- Sensible defaults for existing rows
UPDATE public.digital_marketing_report_target_period_settings
SET metric_directions = jsonb_build_object(
  'cost', 'lower_is_better',
  'cpc', 'lower_is_better',
  'cpa', 'lower_is_better',
  'converted_leads', 'higher_is_better',
  'impressions', 'higher_is_better',
  'ctr', 'higher_is_better',
  'clicks', 'higher_is_better'
)
WHERE metric_directions = '{}'::jsonb
  AND (
    cardinality(selected_metrics) > 0
    OR selected_metrics_by_channel <> '{}'::jsonb
  );
