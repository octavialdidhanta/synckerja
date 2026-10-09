-- Per-metric switch for Meta Ads column colors. Existing rows stay colored until turned off.

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS purchase_roas_color_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS cost_per_purchase_color_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organization_meta_ads_display_settings.purchase_roas_color_enabled IS
  'When false, the Purchase ROAS column is not tinted.';

COMMENT ON COLUMN public.organization_meta_ads_display_settings.cost_per_purchase_color_enabled IS
  'When false, the Cost/Purchase column is not tinted.';
