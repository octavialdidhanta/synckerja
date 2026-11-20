-- Catalog gratuity (service charge %) and sales types.

CREATE TABLE IF NOT EXISTS public.catalog_gratuities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  amount_percent numeric(5, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_gratuities_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_gratuities_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT catalog_gratuities_amount_percent_check CHECK (amount_percent >= 0 AND amount_percent <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_gratuities_org_name
  ON public.catalog_gratuities (organization_id, lower(btrim(name)))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_catalog_gratuities_org
  ON public.catalog_gratuities (organization_id, sort_order, name);

ALTER TABLE public.catalog_gratuities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_gratuities_org_select" ON public.catalog_gratuities;
CREATE POLICY "catalog_gratuities_org_select"
  ON public.catalog_gratuities FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_gratuities_org_insert" ON public.catalog_gratuities;
CREATE POLICY "catalog_gratuities_org_insert"
  ON public.catalog_gratuities FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_gratuities_org_update" ON public.catalog_gratuities;
CREATE POLICY "catalog_gratuities_org_update"
  ON public.catalog_gratuities FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_gratuities_org_delete" ON public.catalog_gratuities;
CREATE POLICY "catalog_gratuities_org_delete"
  ON public.catalog_gratuities FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_gratuities_updated_at ON public.catalog_gratuities;
CREATE TRIGGER update_catalog_gratuities_updated_at
  BEFORE UPDATE ON public.catalog_gratuities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_gratuities IS
  'Service charge / tip percent rules. Assigned to catalog sales types.';

CREATE TABLE IF NOT EXISTS public.catalog_sales_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_sales_types_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_sales_types_name_check CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_sales_types_org_name
  ON public.catalog_sales_types (organization_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_catalog_sales_types_org
  ON public.catalog_sales_types (organization_id, sort_order, name);

ALTER TABLE public.catalog_sales_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_sales_types_org_select" ON public.catalog_sales_types;
CREATE POLICY "catalog_sales_types_org_select"
  ON public.catalog_sales_types FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_sales_types_org_insert" ON public.catalog_sales_types;
CREATE POLICY "catalog_sales_types_org_insert"
  ON public.catalog_sales_types FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_sales_types_org_update" ON public.catalog_sales_types;
CREATE POLICY "catalog_sales_types_org_update"
  ON public.catalog_sales_types FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_sales_types_org_delete" ON public.catalog_sales_types;
CREATE POLICY "catalog_sales_types_org_delete"
  ON public.catalog_sales_types FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_sales_types_updated_at ON public.catalog_sales_types;
CREATE TRIGGER update_catalog_sales_types_updated_at
  BEFORE UPDATE ON public.catalog_sales_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_sales_types IS
  'POS sales channels (Dine In, Takeaway). is_active is Status, not a soft-delete flag.';

CREATE TABLE IF NOT EXISTS public.catalog_sales_type_gratuities (
  sales_type_id uuid NOT NULL REFERENCES public.catalog_sales_types (id) ON DELETE CASCADE,
  gratuity_id uuid NOT NULL REFERENCES public.catalog_gratuities (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_sales_type_gratuities_pkey PRIMARY KEY (sales_type_id, gratuity_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_sales_type_gratuities_gratuity
  ON public.catalog_sales_type_gratuities (gratuity_id);

CREATE INDEX IF NOT EXISTS idx_catalog_sales_type_gratuities_org
  ON public.catalog_sales_type_gratuities (organization_id);

ALTER TABLE public.catalog_sales_type_gratuities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_sales_type_gratuities_org_select" ON public.catalog_sales_type_gratuities;
CREATE POLICY "catalog_sales_type_gratuities_org_select"
  ON public.catalog_sales_type_gratuities FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_sales_type_gratuities_org_insert" ON public.catalog_sales_type_gratuities;
CREATE POLICY "catalog_sales_type_gratuities_org_insert"
  ON public.catalog_sales_type_gratuities FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_sales_type_gratuities_org_update" ON public.catalog_sales_type_gratuities;
CREATE POLICY "catalog_sales_type_gratuities_org_update"
  ON public.catalog_sales_type_gratuities FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_sales_type_gratuities_org_delete" ON public.catalog_sales_type_gratuities;
CREATE POLICY "catalog_sales_type_gratuities_org_delete"
  ON public.catalog_sales_type_gratuities FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- Page access: gratuity + sales-types, copied from product-list like categories.
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
    '/operations/library/gratuity',
    'Operations — Library — Gratuity',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/operations/library/sales-types',
    'Operations — Library — Sales Type',
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
  AND d.page_path IN ('/operations/library/gratuity', '/operations/library/sales-types')
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
WHERE d.page_path IN ('/operations/library/gratuity', '/operations/library/sales-types')
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
