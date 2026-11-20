-- Catalog taxes and org checkout flags (tax/gratuity application).

CREATE TABLE IF NOT EXISTS public.catalog_taxes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  amount_percent numeric(5, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_taxes_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_taxes_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT catalog_taxes_amount_percent_check CHECK (amount_percent >= 0 AND amount_percent <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_taxes_org_name
  ON public.catalog_taxes (organization_id, lower(btrim(name)))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_catalog_taxes_org
  ON public.catalog_taxes (organization_id, sort_order, name);

ALTER TABLE public.catalog_taxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_taxes_org_select" ON public.catalog_taxes;
CREATE POLICY "catalog_taxes_org_select"
  ON public.catalog_taxes FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_taxes_org_insert" ON public.catalog_taxes;
CREATE POLICY "catalog_taxes_org_insert"
  ON public.catalog_taxes FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_taxes_org_update" ON public.catalog_taxes;
CREATE POLICY "catalog_taxes_org_update"
  ON public.catalog_taxes FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_taxes_org_delete" ON public.catalog_taxes;
CREATE POLICY "catalog_taxes_org_delete"
  ON public.catalog_taxes FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_taxes_updated_at ON public.catalog_taxes;
CREATE TRIGGER update_catalog_taxes_updated_at
  BEFORE UPDATE ON public.catalog_taxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_taxes IS
  'Named tax rates (PPN, PB1). Enable Tax on checkout settings applies all active rows.';

CREATE TABLE IF NOT EXISTS public.catalog_checkout_settings (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  tax_enabled boolean NOT NULL DEFAULT false,
  gratuity_enabled boolean NOT NULL DEFAULT false,
  application_method text NOT NULL DEFAULT 'add',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_checkout_settings_pkey PRIMARY KEY (organization_id),
  CONSTRAINT catalog_checkout_settings_application_method_check
    CHECK (application_method IN ('add', 'include'))
);

ALTER TABLE public.catalog_checkout_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_checkout_settings_org_select" ON public.catalog_checkout_settings;
CREATE POLICY "catalog_checkout_settings_org_select"
  ON public.catalog_checkout_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_checkout_settings_org_insert" ON public.catalog_checkout_settings;
CREATE POLICY "catalog_checkout_settings_org_insert"
  ON public.catalog_checkout_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_checkout_settings_org_update" ON public.catalog_checkout_settings;
CREATE POLICY "catalog_checkout_settings_org_update"
  ON public.catalog_checkout_settings FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_checkout_settings_org_delete" ON public.catalog_checkout_settings;
CREATE POLICY "catalog_checkout_settings_org_delete"
  ON public.catalog_checkout_settings FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_checkout_settings_updated_at ON public.catalog_checkout_settings;
CREATE TRIGGER update_catalog_checkout_settings_updated_at
  BEFORE UPDATE ON public.catalog_checkout_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_checkout_settings IS
  'Org checkout flags. application_method add=exclusive, include=inclusive.';

INSERT INTO public.permission_configuration_defaults (
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
VALUES
  (
    '/operations/library/taxes',
    'Operations — Library — Taxes',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/operations/library/checkout',
    'Operations — Library — Checkout',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  )
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  job_levels_allowed = EXCLUDED.job_levels_allowed,
  exceptions = EXCLUDED.exceptions,
  exception_paths = EXCLUDED.exception_paths,
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id,
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
SELECT
  p.organization_id,
  d.page_path,
  d.page_title,
  p.is_active,
  p.roles_allowed,
  p.job_levels_allowed,
  p.exceptions,
  p.exception_paths
FROM public.permission_configurations p
CROSS JOIN public.permission_configuration_defaults d
WHERE p.page_path = '/operations/library/product-list'
  AND d.page_path IN ('/operations/library/taxes', '/operations/library/checkout')
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations existing
    WHERE existing.organization_id = p.organization_id
      AND existing.page_path = d.page_path
  );

INSERT INTO public.permission_configurations (
  organization_id,
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
SELECT
  o.id,
  d.page_path,
  d.page_title,
  d.is_active,
  d.roles_allowed,
  d.job_levels_allowed,
  d.exceptions,
  d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path IN ('/operations/library/taxes', '/operations/library/checkout')
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
