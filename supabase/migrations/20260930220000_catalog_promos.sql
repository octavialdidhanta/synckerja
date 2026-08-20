-- Catalog promos (automatic conditional promotions). POS auto-apply is a later phase.

CREATE TABLE IF NOT EXISTS public.catalog_promos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  promo_type text NOT NULL,
  sales_type_scope text NOT NULL DEFAULT 'all',
  applies_in_multiple boolean NOT NULL DEFAULT false,
  time_period_enabled boolean NOT NULL DEFAULT false,
  starts_on date,
  ends_on date,
  starts_at_time time,
  ends_at_time time,
  reward_amount_unit text,
  reward_amount_value numeric(14, 2),
  reward_product_id uuid REFERENCES public.default_prices (id) ON DELETE SET NULL,
  reward_quantity integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_promos_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_promos_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT catalog_promos_promo_type_check
    CHECK (promo_type IN ('discount_per_item', 'free_item')),
  CONSTRAINT catalog_promos_sales_type_scope_check
    CHECK (sales_type_scope IN ('all', 'specific')),
  CONSTRAINT catalog_promos_reward_amount_unit_check
    CHECK (reward_amount_unit IS NULL OR reward_amount_unit IN ('rp', 'percent')),
  CONSTRAINT catalog_promos_reward_amount_value_check
    CHECK (reward_amount_value IS NULL OR reward_amount_value >= 0),
  CONSTRAINT catalog_promos_reward_quantity_check CHECK (reward_quantity >= 1),
  CONSTRAINT catalog_promos_period_dates_check CHECK (
    (
      time_period_enabled = false
      AND starts_on IS NULL
      AND ends_on IS NULL
      AND starts_at_time IS NULL
      AND ends_at_time IS NULL
    )
    OR (
      time_period_enabled = true
      AND starts_on IS NOT NULL
      AND ends_on IS NOT NULL
      AND ends_on >= starts_on
    )
  ),
  CONSTRAINT catalog_promos_reward_shape_check CHECK (
    (
      promo_type = 'discount_per_item'
      AND reward_amount_unit IS NOT NULL
      AND reward_amount_value IS NOT NULL
      AND reward_product_id IS NULL
      AND (
        (reward_amount_unit = 'percent' AND reward_amount_value <= 100)
        OR reward_amount_unit = 'rp'
      )
    )
    OR (
      promo_type = 'free_item'
      AND reward_product_id IS NOT NULL
      AND reward_amount_unit IS NULL
      AND reward_amount_value IS NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_promos_org_name
  ON public.catalog_promos (organization_id, lower(btrim(name)))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_catalog_promos_org
  ON public.catalog_promos (organization_id, sort_order, name);

ALTER TABLE public.catalog_promos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_promos_org_select" ON public.catalog_promos;
CREATE POLICY "catalog_promos_org_select"
  ON public.catalog_promos FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promos_org_insert" ON public.catalog_promos;
CREATE POLICY "catalog_promos_org_insert"
  ON public.catalog_promos FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promos_org_update" ON public.catalog_promos;
CREATE POLICY "catalog_promos_org_update"
  ON public.catalog_promos FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promos_org_delete" ON public.catalog_promos;
CREATE POLICY "catalog_promos_org_delete"
  ON public.catalog_promos FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_promos_updated_at ON public.catalog_promos;
CREATE TRIGGER update_catalog_promos_updated_at
  BEFORE UPDATE ON public.catalog_promos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_promos IS
  'Automatic conditional promotions. POS auto-apply is a later phase.';

CREATE TABLE IF NOT EXISTS public.catalog_promo_sales_types (
  promo_id uuid NOT NULL REFERENCES public.catalog_promos (id) ON DELETE CASCADE,
  sales_type_id uuid NOT NULL REFERENCES public.catalog_sales_types (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_promo_sales_types_pkey PRIMARY KEY (promo_id, sales_type_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_promo_sales_types_org
  ON public.catalog_promo_sales_types (organization_id);

ALTER TABLE public.catalog_promo_sales_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_promo_sales_types_org_select" ON public.catalog_promo_sales_types;
CREATE POLICY "catalog_promo_sales_types_org_select"
  ON public.catalog_promo_sales_types FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promo_sales_types_org_insert" ON public.catalog_promo_sales_types;
CREATE POLICY "catalog_promo_sales_types_org_insert"
  ON public.catalog_promo_sales_types FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promo_sales_types_org_update" ON public.catalog_promo_sales_types;
CREATE POLICY "catalog_promo_sales_types_org_update"
  ON public.catalog_promo_sales_types FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promo_sales_types_org_delete" ON public.catalog_promo_sales_types;
CREATE POLICY "catalog_promo_sales_types_org_delete"
  ON public.catalog_promo_sales_types FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE TABLE IF NOT EXISTS public.catalog_promo_requirements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.catalog_promos (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  kind text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  product_id uuid REFERENCES public.default_prices (id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.catalog_product_categories (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_promo_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_promo_requirements_kind_check CHECK (kind IN ('item', 'category')),
  CONSTRAINT catalog_promo_requirements_quantity_check CHECK (quantity >= 1),
  CONSTRAINT catalog_promo_requirements_target_check CHECK (
    (kind = 'item' AND product_id IS NOT NULL AND category_id IS NULL)
    OR (kind = 'category' AND category_id IS NOT NULL AND product_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_promo_requirements_promo
  ON public.catalog_promo_requirements (promo_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_catalog_promo_requirements_org
  ON public.catalog_promo_requirements (organization_id);

ALTER TABLE public.catalog_promo_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_promo_requirements_org_select" ON public.catalog_promo_requirements;
CREATE POLICY "catalog_promo_requirements_org_select"
  ON public.catalog_promo_requirements FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promo_requirements_org_insert" ON public.catalog_promo_requirements;
CREATE POLICY "catalog_promo_requirements_org_insert"
  ON public.catalog_promo_requirements FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promo_requirements_org_update" ON public.catalog_promo_requirements;
CREATE POLICY "catalog_promo_requirements_org_update"
  ON public.catalog_promo_requirements FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_promo_requirements_org_delete" ON public.catalog_promo_requirements;
CREATE POLICY "catalog_promo_requirements_org_delete"
  ON public.catalog_promo_requirements FOR DELETE TO authenticated
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
  '/operations/library/promos',
  'Operations — Library — Promos',
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
  AND d.page_path = '/operations/library/promos'
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
WHERE d.page_path = '/operations/library/promos'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
