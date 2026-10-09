-- Fixed color threshold for the AOV column. Higher than the cut is green.

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS aov_threshold numeric NOT NULL DEFAULT 150000;

ALTER TABLE public.organization_meta_ads_display_settings
  DROP CONSTRAINT IF EXISTS organization_meta_ads_display_settings_aov_positive;

ALTER TABLE public.organization_meta_ads_display_settings
  ADD CONSTRAINT organization_meta_ads_display_settings_aov_positive
  CHECK (aov_threshold > 0);

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS aov_color_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organization_meta_ads_display_settings.aov_threshold IS
  'Average order value at or above this amount is green. Below it is red. Same currency as the ad account.';

COMMENT ON COLUMN public.organization_meta_ads_display_settings.aov_color_enabled IS
  'When false, the AOV column is not tinted.';
