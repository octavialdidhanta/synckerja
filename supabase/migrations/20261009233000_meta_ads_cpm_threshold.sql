-- Fixed color threshold for the CPM column. At or below the cut is green.

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS cpm_threshold numeric NOT NULL DEFAULT 10000;

ALTER TABLE public.organization_meta_ads_display_settings
  DROP CONSTRAINT IF EXISTS organization_meta_ads_display_settings_cpm_positive;

ALTER TABLE public.organization_meta_ads_display_settings
  ADD CONSTRAINT organization_meta_ads_display_settings_cpm_positive
  CHECK (cpm_threshold > 0);

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS cpm_color_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organization_meta_ads_display_settings.cpm_threshold IS
  'CPM at or below this amount is green. Above it is red. Same currency as the ad account.';

COMMENT ON COLUMN public.organization_meta_ads_display_settings.cpm_color_enabled IS
  'When false, the CPM column is not tinted.';
