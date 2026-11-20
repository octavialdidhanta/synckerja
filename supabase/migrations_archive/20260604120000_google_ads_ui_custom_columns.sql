-- Google Ads UI "Custom columns" (formula) names — not available via Google Ads API; mirrored per org/account/entity.

CREATE TABLE IF NOT EXISTS public.organization_google_ads_ui_custom_columns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  entity text NOT NULL,
  name text NOT NULL,
  formula_text text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_google_ads_ui_custom_columns_entity_check CHECK (
    entity = ANY (
      ARRAY[
        'campaign'::text,
        'ad_group'::text,
        'ad'::text,
        'keyword'::text
      ]
    )
  ),
  CONSTRAINT organization_google_ads_ui_custom_columns_customer_id_digits CHECK (
    customer_id ~ '^\d{10}$'
  ),
  CONSTRAINT organization_google_ads_ui_custom_columns_unique
    UNIQUE (organization_id, customer_id, entity, name)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_ui_custom_columns_org_customer_entity
  ON public.organization_google_ads_ui_custom_columns (organization_id, customer_id, entity);

COMMENT ON TABLE public.organization_google_ads_ui_custom_columns IS
  'Mirrors Google Ads UI Custom column (formula) names per customer account. Values are not provided by Google Ads API.';

ALTER TABLE public.organization_google_ads_ui_custom_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_google_ads_ui_custom_columns_select
  ON public.organization_google_ads_ui_custom_columns;
CREATE POLICY organization_google_ads_ui_custom_columns_select
  ON public.organization_google_ads_ui_custom_columns
  FOR SELECT
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

DROP POLICY IF EXISTS organization_google_ads_ui_custom_columns_insert
  ON public.organization_google_ads_ui_custom_columns;
CREATE POLICY organization_google_ads_ui_custom_columns_insert
  ON public.organization_google_ads_ui_custom_columns
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

DROP POLICY IF EXISTS organization_google_ads_ui_custom_columns_update
  ON public.organization_google_ads_ui_custom_columns;
CREATE POLICY organization_google_ads_ui_custom_columns_update
  ON public.organization_google_ads_ui_custom_columns
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

DROP POLICY IF EXISTS organization_google_ads_ui_custom_columns_delete
  ON public.organization_google_ads_ui_custom_columns;
CREATE POLICY organization_google_ads_ui_custom_columns_delete
  ON public.organization_google_ads_ui_custom_columns
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

DROP TRIGGER IF EXISTS update_organization_google_ads_ui_custom_columns_updated_at
  ON public.organization_google_ads_ui_custom_columns;
CREATE TRIGGER update_organization_google_ads_ui_custom_columns_updated_at
  BEFORE UPDATE ON public.organization_google_ads_ui_custom_columns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
