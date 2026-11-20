-- Cost/Purchase color threshold, stored per organization next to the ROAS threshold.

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS cost_per_purchase_threshold numeric NOT NULL DEFAULT 50000;

ALTER TABLE public.organization_meta_ads_display_settings
  DROP CONSTRAINT IF EXISTS organization_meta_ads_display_settings_cost_positive;

ALTER TABLE public.organization_meta_ads_display_settings
  ADD CONSTRAINT organization_meta_ads_display_settings_cost_positive
  CHECK (cost_per_purchase_threshold > 0);

COMMENT ON COLUMN public.organization_meta_ads_display_settings.cost_per_purchase_threshold IS
  'Cost per purchase at or below this value is green. Above it is red. Same currency as the ad account.';
