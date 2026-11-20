-- Per-organization Meta Ads table display options. One row per tenant.

CREATE TABLE IF NOT EXISTS public.organization_meta_ads_display_settings (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  purchase_roas_threshold numeric NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_meta_ads_display_settings_roas_positive
    CHECK (purchase_roas_threshold > 0)
);

COMMENT ON TABLE public.organization_meta_ads_display_settings IS
  'Per-organization Meta Ads table display options. Not shared across tenants.';

COMMENT ON COLUMN public.organization_meta_ads_display_settings.purchase_roas_threshold IS
  'Purchase ROAS at or above this value is green. Below it is red.';

ALTER TABLE public.organization_meta_ads_display_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_meta_ads_display_settings_select_org
  ON public.organization_meta_ads_display_settings;
CREATE POLICY organization_meta_ads_display_settings_select_org
  ON public.organization_meta_ads_display_settings
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_meta_ads_display_settings_admin_write
  ON public.organization_meta_ads_display_settings;
CREATE POLICY organization_meta_ads_display_settings_admin_write
  ON public.organization_meta_ads_display_settings
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));
