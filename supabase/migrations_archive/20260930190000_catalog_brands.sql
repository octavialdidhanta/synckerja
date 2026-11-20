-- Catalog brands: optional product grouping by manufacturer/label.

CREATE TABLE IF NOT EXISTS public.catalog_brands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_brands_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_brands_name_check CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_brands_org_name
  ON public.catalog_brands (organization_id, lower(btrim(name)))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_catalog_brands_org
  ON public.catalog_brands (organization_id, sort_order, name);

ALTER TABLE public.catalog_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_brands_org_select" ON public.catalog_brands;
CREATE POLICY "catalog_brands_org_select"
  ON public.catalog_brands FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_brands_org_insert" ON public.catalog_brands;
CREATE POLICY "catalog_brands_org_insert"
  ON public.catalog_brands FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_brands_org_update" ON public.catalog_brands;
CREATE POLICY "catalog_brands_org_update"
  ON public.catalog_brands FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_brands_org_delete" ON public.catalog_brands;
CREATE POLICY "catalog_brands_org_delete"
  ON public.catalog_brands FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_brands_updated_at ON public.catalog_brands;
CREATE TRIGGER update_catalog_brands_updated_at
  BEFORE UPDATE ON public.catalog_brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_brands IS
  'Retail product brands. Optional on default_prices; unused for in-house F&B.';

ALTER TABLE public.default_prices
  ADD COLUMN IF NOT EXISTS product_brand_id uuid NULL
    REFERENCES public.catalog_brands (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_default_prices_product_brand_id
  ON public.default_prices (product_brand_id);

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
    '/operations/library/brands',
    'Operations — Library — Brands',
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
  '/operations/library/brands',
  'Operations — Library — Brands',
  p.is_active,
  p.roles_allowed,
  p.job_levels_allowed,
  p.exceptions,
  p.exception_paths
FROM public.permission_configurations p
WHERE p.page_path = '/operations/library/product-list'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations existing
    WHERE existing.organization_id = p.organization_id
      AND existing.page_path = '/operations/library/brands'
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
WHERE d.page_path = '/operations/library/brands'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
