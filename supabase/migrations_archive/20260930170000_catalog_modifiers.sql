-- Catalog modifiers: groups, options, product assignment.

CREATE TABLE IF NOT EXISTS public.catalog_modifier_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  limit_enabled boolean NOT NULL DEFAULT false,
  is_required boolean NOT NULL DEFAULT false,
  max_selected integer NOT NULL DEFAULT 1,
  stock_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_modifier_groups_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_modifier_groups_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT catalog_modifier_groups_max_selected_check CHECK (max_selected >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_modifier_groups_org_name
  ON public.catalog_modifier_groups (organization_id, lower(btrim(name)))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_catalog_modifier_groups_org
  ON public.catalog_modifier_groups (organization_id, sort_order, name);

ALTER TABLE public.catalog_modifier_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_modifier_groups_org_select" ON public.catalog_modifier_groups;
CREATE POLICY "catalog_modifier_groups_org_select"
  ON public.catalog_modifier_groups FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_modifier_groups_org_insert" ON public.catalog_modifier_groups;
CREATE POLICY "catalog_modifier_groups_org_insert"
  ON public.catalog_modifier_groups FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_modifier_groups_org_update" ON public.catalog_modifier_groups;
CREATE POLICY "catalog_modifier_groups_org_update"
  ON public.catalog_modifier_groups FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_modifier_groups_org_delete" ON public.catalog_modifier_groups;
CREATE POLICY "catalog_modifier_groups_org_delete"
  ON public.catalog_modifier_groups FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_modifier_groups_updated_at ON public.catalog_modifier_groups;
CREATE TRIGGER update_catalog_modifier_groups_updated_at
  BEFORE UPDATE ON public.catalog_modifier_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_modifier_groups IS
  'POS/online modifier groups (toppings, sugar level). Assigned to catalog products.';

CREATE TABLE IF NOT EXISTS public.catalog_modifier_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.catalog_modifier_groups (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  extra_price numeric(14, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  inventory_sku_id uuid NULL REFERENCES public.inventory_skus (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_modifier_options_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_modifier_options_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT catalog_modifier_options_extra_price_check CHECK (extra_price >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_modifier_options_group_name
  ON public.catalog_modifier_options (group_id, lower(btrim(name)))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_catalog_modifier_options_group
  ON public.catalog_modifier_options (group_id, sort_order, name);

ALTER TABLE public.catalog_modifier_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_modifier_options_org_select" ON public.catalog_modifier_options;
CREATE POLICY "catalog_modifier_options_org_select"
  ON public.catalog_modifier_options FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_modifier_options_org_insert" ON public.catalog_modifier_options;
CREATE POLICY "catalog_modifier_options_org_insert"
  ON public.catalog_modifier_options FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_modifier_options_org_update" ON public.catalog_modifier_options;
CREATE POLICY "catalog_modifier_options_org_update"
  ON public.catalog_modifier_options FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_modifier_options_org_delete" ON public.catalog_modifier_options;
CREATE POLICY "catalog_modifier_options_org_delete"
  ON public.catalog_modifier_options FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_modifier_options_updated_at ON public.catalog_modifier_options;
CREATE TRIGGER update_catalog_modifier_options_updated_at
  BEFORE UPDATE ON public.catalog_modifier_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.catalog_product_modifiers (
  product_id uuid NOT NULL REFERENCES public.default_prices (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.catalog_modifier_groups (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_product_modifiers_pkey PRIMARY KEY (product_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_product_modifiers_group
  ON public.catalog_product_modifiers (group_id);

CREATE INDEX IF NOT EXISTS idx_catalog_product_modifiers_org
  ON public.catalog_product_modifiers (organization_id);

ALTER TABLE public.catalog_product_modifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_product_modifiers_org_select" ON public.catalog_product_modifiers;
CREATE POLICY "catalog_product_modifiers_org_select"
  ON public.catalog_product_modifiers FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_modifiers_org_insert" ON public.catalog_product_modifiers;
CREATE POLICY "catalog_product_modifiers_org_insert"
  ON public.catalog_product_modifiers FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_modifiers_org_update" ON public.catalog_product_modifiers;
CREATE POLICY "catalog_product_modifiers_org_update"
  ON public.catalog_product_modifiers FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_modifiers_org_delete" ON public.catalog_product_modifiers;
CREATE POLICY "catalog_product_modifiers_org_delete"
  ON public.catalog_product_modifiers FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- Page access
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
    '/operations/library/modifiers',
    'Operations — Library — Modifiers',
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
  '/operations/library/modifiers',
  'Operations — Library — Modifiers',
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
      AND existing.page_path = '/operations/library/modifiers'
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
WHERE d.page_path = '/operations/library/modifiers'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
