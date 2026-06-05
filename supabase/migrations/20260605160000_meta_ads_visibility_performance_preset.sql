-- Global Meta Ads preset: Visibility Performance (Impressions, Clicks, CTR) for campaign tab.

INSERT INTO public.meta_ads_global_column_sets (entity, name, metric_keys)
VALUES (
  'campaign',
  'Visibility Performance',
  '["impressions","clicks","ctr"]'::jsonb
)
ON CONFLICT (entity, name) DO UPDATE
SET metric_keys = EXCLUDED.metric_keys,
    updated_at = now();
