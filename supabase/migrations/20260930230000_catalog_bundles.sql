-- Catalog bundle packages (combo products). POS sale and component stock cuts are a later phase.

CREATE TABLE IF NOT EXISTS public.catalog_bundles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_path text,
  bundle_price numeric(14, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_bundles_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_bundles_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT catalog_bundles_price_check CHECK (bundle_price >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_bundles_org_name
  ON public.catalog_bundles (organization_id, lower(btrim(name)))
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_catalog_bundles_org
  ON public.catalog_bundles (organization_id, sort_order, name)
  WHERE is_deleted = false;

ALTER TABLE public.catalog_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_bundles_org_select" ON public.catalog_bundles;
CREATE POLICY "catalog_bundles_org_select"
  ON public.catalog_bundles FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundles_org_insert" ON public.catalog_bundles;
CREATE POLICY "catalog_bundles_org_insert"
  ON public.catalog_bundles FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundles_org_update" ON public.catalog_bundles;
CREATE POLICY "catalog_bundles_org_update"
  ON public.catalog_bundles FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundles_org_delete" ON public.catalog_bundles;
CREATE POLICY "catalog_bundles_org_delete"
  ON public.catalog_bundles FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_bundles_updated_at ON public.catalog_bundles;
CREATE TRIGGER update_catalog_bundles_updated_at
  BEFORE UPDATE ON public.catalog_bundles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_bundles IS
  'Combo / bundle packages of Item Library products. POS sale and component stock cuts are a later phase.';

CREATE TABLE IF NOT EXISTS public.catalog_bundle_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.catalog_bundles (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.default_prices (id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_bundle_items_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_bundle_items_quantity_check CHECK (quantity >= 1),
  CONSTRAINT catalog_bundle_items_unique UNIQUE (bundle_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_bundle_items_bundle
  ON public.catalog_bundle_items (bundle_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_catalog_bundle_items_org
  ON public.catalog_bundle_items (organization_id);

ALTER TABLE public.catalog_bundle_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_bundle_items_org_select" ON public.catalog_bundle_items;
CREATE POLICY "catalog_bundle_items_org_select"
  ON public.catalog_bundle_items FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundle_items_org_insert" ON public.catalog_bundle_items;
CREATE POLICY "catalog_bundle_items_org_insert"
  ON public.catalog_bundle_items FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundle_items_org_update" ON public.catalog_bundle_items;
CREATE POLICY "catalog_bundle_items_org_update"
  ON public.catalog_bundle_items FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundle_items_org_delete" ON public.catalog_bundle_items;
CREATE POLICY "catalog_bundle_items_org_delete"
  ON public.catalog_bundle_items FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

INSERT INTO public.permission_configuration_defaults (
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
VALUES (
  '/operations/library/bundles',
  'Operations — Library — Bundles',
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
  AND d.page_path = '/operations/library/bundles'
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
WHERE d.page_path = '/operations/library/bundles'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
