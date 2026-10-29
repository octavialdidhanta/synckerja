CREATE TABLE IF NOT EXISTS public.organization_meta_ads_name_templates (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  campaign_template jsonb NOT NULL DEFAULT '{"tokens":[],"fieldSeparator":"|","itemSeparator":""}'::jsonb,
  adset_template jsonb NOT NULL DEFAULT '{"tokens":[],"fieldSeparator":"|","itemSeparator":""}'::jsonb,
  use_campaign_template boolean NOT NULL DEFAULT false,
  use_adset_template boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_meta_ads_name_templates IS
  'Per-organization Meta Ads campaign and ad set naming templates. Shared across ad accounts in the org.';

ALTER TABLE public.organization_meta_ads_name_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_meta_ads_name_templates_select_org
  ON public.organization_meta_ads_name_templates;
CREATE POLICY organization_meta_ads_name_templates_select_org
  ON public.organization_meta_ads_name_templates
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

DROP POLICY IF EXISTS organization_meta_ads_name_templates_admin_write
  ON public.organization_meta_ads_name_templates;
CREATE POLICY organization_meta_ads_name_templates_admin_write
  ON public.organization_meta_ads_name_templates
  FOR ALL
  TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

DROP TRIGGER IF EXISTS update_organization_meta_ads_name_templates_updated_at
  ON public.organization_meta_ads_name_templates;
CREATE TRIGGER update_organization_meta_ads_name_templates_updated_at
  BEFORE UPDATE ON public.organization_meta_ads_name_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_meta_ads_name_templates TO authenticated;
