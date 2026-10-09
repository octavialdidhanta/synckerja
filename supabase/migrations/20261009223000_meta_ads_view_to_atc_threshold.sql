-- Fixed color threshold for the % View to ATC column. Higher than the cut is green.

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS view_to_atc_rate_threshold numeric NOT NULL DEFAULT 10;

ALTER TABLE public.organization_meta_ads_display_settings
  DROP CONSTRAINT IF EXISTS organization_meta_ads_display_settings_view_atc_positive;

ALTER TABLE public.organization_meta_ads_display_settings
  ADD CONSTRAINT organization_meta_ads_display_settings_view_atc_positive
  CHECK (view_to_atc_rate_threshold > 0);

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS view_to_atc_color_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organization_meta_ads_display_settings.view_to_atc_rate_threshold IS
  'Percent. At or above this % View to ATC is green; below it is red.';

COMMENT ON COLUMN public.organization_meta_ads_display_settings.view_to_atc_color_enabled IS
  'When false, the % View to ATC column is not tinted.';
