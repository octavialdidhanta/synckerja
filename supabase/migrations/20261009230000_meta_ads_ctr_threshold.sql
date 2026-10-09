-- Fixed color threshold for the CTR column. Higher than the cut is green.

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS ctr_threshold numeric NOT NULL DEFAULT 1;

ALTER TABLE public.organization_meta_ads_display_settings
  DROP CONSTRAINT IF EXISTS organization_meta_ads_display_settings_ctr_positive;

ALTER TABLE public.organization_meta_ads_display_settings
  ADD CONSTRAINT organization_meta_ads_display_settings_ctr_positive
  CHECK (ctr_threshold > 0);

ALTER TABLE public.organization_meta_ads_display_settings
  ADD COLUMN IF NOT EXISTS ctr_color_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organization_meta_ads_display_settings.ctr_threshold IS
  'Percent. At or above this CTR is green; below it is red.';

COMMENT ON COLUMN public.organization_meta_ads_display_settings.ctr_color_enabled IS
  'When false, the CTR column is not tinted.';
