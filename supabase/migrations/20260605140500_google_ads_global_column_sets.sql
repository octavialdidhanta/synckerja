-- Global (cross-tenant) named column presets for Google Ads metrics.
-- These presets do NOT belong to any organization and are read-only for clients.

CREATE TABLE IF NOT EXISTS public.google_ads_global_column_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity text NOT NULL,
  name text NOT NULL,
  metric_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_ads_global_column_sets_entity_check CHECK (
    entity = ANY (
      ARRAY[
        'campaign'::text,
        'ad_group'::text,
        'ad'::text,
        'keyword'::text
      ]
    )
  ),
  CONSTRAINT google_ads_global_column_sets_unique UNIQUE (entity, name),
  CONSTRAINT google_ads_global_column_sets_metric_keys_array CHECK (jsonb_typeof(metric_keys) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_google_ads_global_column_sets_entity
  ON public.google_ads_global_column_sets (entity);

COMMENT ON TABLE public.google_ads_global_column_sets IS
  'Global Google Ads metric column presets (ordered metric keys) shared across all tenants.';

ALTER TABLE public.google_ads_global_column_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_ads_global_column_sets_select
  ON public.google_ads_global_column_sets;
CREATE POLICY google_ads_global_column_sets_select
  ON public.google_ads_global_column_sets
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies => read-only for authenticated clients.

DROP TRIGGER IF EXISTS update_google_ads_global_column_sets_updated_at
  ON public.google_ads_global_column_sets;
CREATE TRIGGER update_google_ads_global_column_sets_updated_at
  BEFORE UPDATE ON public.google_ads_global_column_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default presets (campaign tab).
INSERT INTO public.google_ads_global_column_sets (entity, name, metric_keys)
VALUES
  ('campaign', 'Headline & Metadescripton Performance', '["impressions","clicks","ctr"]'::jsonb),
  ('campaign', 'Offering Performance', '["traffic_total_visit_page","leads_total","leads_visit_rate","leads_cost_per_lead"]'::jsonb),
  ('campaign', 'Visibility Performance', '["impressions","top_impr_pct","absolute_top_impr_pct"]'::jsonb),
  ('campaign', 'Web Speed Performance', '["clicks","traffic_total_visit_page","traffic_visit_click_rate"]'::jsonb)
ON CONFLICT (entity, name) DO UPDATE
SET metric_keys = EXCLUDED.metric_keys,
    updated_at = now();

