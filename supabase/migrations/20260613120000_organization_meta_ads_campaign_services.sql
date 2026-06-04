-- Manual mapping Meta Ads campaign → org service (Service column + CPA on metrics table).

CREATE TABLE IF NOT EXISTS public.organization_meta_ads_campaign_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,
  campaign_id text NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_meta_ads_campaign_services_ad_account_id_digits CHECK (
    ad_account_id ~ '^[0-9]+$'
  ),
  CONSTRAINT organization_meta_ads_campaign_services_campaign_id_nonempty CHECK (
    length(trim(campaign_id)) > 0
  ),
  CONSTRAINT organization_meta_ads_campaign_services_unique
    UNIQUE (organization_id, ad_account_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign_services_org_account
  ON public.organization_meta_ads_campaign_services (organization_id, ad_account_id);

CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign_services_service
  ON public.organization_meta_ads_campaign_services (service_id);

COMMENT ON TABLE public.organization_meta_ads_campaign_services IS
  'Maps Meta Ads campaign id to org service for digital marketing reporting (CPA, etc.).';

DROP TRIGGER IF EXISTS update_organization_meta_ads_campaign_services_updated_at
  ON public.organization_meta_ads_campaign_services;
CREATE TRIGGER update_organization_meta_ads_campaign_services_updated_at
  BEFORE UPDATE ON public.organization_meta_ads_campaign_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_meta_ads_campaign_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_meta_ads_campaign_services_select
  ON public.organization_meta_ads_campaign_services;
CREATE POLICY organization_meta_ads_campaign_services_select
  ON public.organization_meta_ads_campaign_services
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

DROP POLICY IF EXISTS organization_meta_ads_campaign_services_insert
  ON public.organization_meta_ads_campaign_services;
CREATE POLICY organization_meta_ads_campaign_services_insert
  ON public.organization_meta_ads_campaign_services
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS organization_meta_ads_campaign_services_update
  ON public.organization_meta_ads_campaign_services;
CREATE POLICY organization_meta_ads_campaign_services_update
  ON public.organization_meta_ads_campaign_services
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  )
  WITH CHECK (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS organization_meta_ads_campaign_services_delete
  ON public.organization_meta_ads_campaign_services;
CREATE POLICY organization_meta_ads_campaign_services_delete
  ON public.organization_meta_ads_campaign_services
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );
