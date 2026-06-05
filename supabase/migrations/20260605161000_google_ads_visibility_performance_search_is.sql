-- Extend global Google Ads "Visibility Performance" preset with Search IS metrics.

UPDATE public.google_ads_global_column_sets
SET
  metric_keys = '["impressions","top_impr_pct","absolute_top_impr_pct","search_top_is","search_budget_lost_is","search_lost_top_is_rank"]'::jsonb,
  updated_at = now()
WHERE entity = 'campaign'
  AND name = 'Visibility Performance';

-- Idempotent insert if row missing (e.g. fresh env without prior seed).
INSERT INTO public.google_ads_global_column_sets (entity, name, metric_keys)
VALUES (
  'campaign',
  'Visibility Performance',
  '["impressions","top_impr_pct","absolute_top_impr_pct","search_top_is","search_budget_lost_is","search_lost_top_is_rank"]'::jsonb
)
ON CONFLICT (entity, name) DO UPDATE
SET metric_keys = EXCLUDED.metric_keys,
    updated_at = now();
