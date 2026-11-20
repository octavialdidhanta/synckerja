-- Fixed color threshold for the % ATC to Purchase column. Higher than the cut is green.

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS atc_to_purchase_rate_threshold numeric NOT NULL DEFAULT 20;

ALTER TABLE public.organization_meta_ads_display_settings
  DROP CONSTRAINT IF EXISTS organization_meta_ads_display_settings_atc_rate_positive;

ALTER TABLE public.organization_meta_ads_display_settings
  ADD CONSTRAINT organization_meta_ads_display_settings_atc_rate_positive
  CHECK (atc_to_purchase_rate_threshold > 0);

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS atc_to_purchase_color_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organization_meta_ads_display_settings.atc_to_purchase_rate_threshold IS
  'Percent. At or above this % ATC to Purchase is green; below it is red.';

COMMENT ON COLUMN public.organization_meta_ads_display_settings.atc_to_purchase_color_enabled IS
  'When false, the % ATC to Purchase column is not tinted.';
