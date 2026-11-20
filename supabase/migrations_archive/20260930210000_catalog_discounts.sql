-- Catalog discounts (named POS discounts; POS wiring is a later phase).

CREATE TABLE IF NOT EXISTS public.catalog_discounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  input_configuration text NOT NULL DEFAULT 'fixed',
  amount_unit text,
  amount_value numeric(14, 2),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_discounts_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_discounts_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT catalog_discounts_input_configuration_check
    CHECK (input_configuration IN ('fixed', 'customizable')),
  CONSTRAINT catalog_discounts_amount_unit_check
    CHECK (amount_unit IS NULL OR amount_unit IN ('rp', 'percent')),
  CONSTRAINT catalog_discounts_amount_value_check
    CHECK (amount_value IS NULL OR amount_value >= 0),
  CONSTRAINT catalog_discounts_amount_shape_check CHECK (
    (
      input_configuration = 'fixed'
      AND amount_unit IS NOT NULL
      AND amount_value IS NOT NULL
      AND (
        (amount_unit = 'percent' AND amount_value <= 100)
        OR amount_unit = 'rp'
      )
    )
    OR (
      input_configuration = 'customizable'
      AND amount_unit IS NULL
      AND amount_value IS NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_discounts_org_name
  ON public.catalog_discounts (organization_id, lower(btrim(name)))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_catalog_discounts_org
  ON public.catalog_discounts (organization_id, sort_order, name);

ALTER TABLE public.catalog_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_discounts_org_select" ON public.catalog_discounts;
CREATE POLICY "catalog_discounts_org_select"
  ON public.catalog_discounts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_discounts_org_insert" ON public.catalog_discounts;
CREATE POLICY "catalog_discounts_org_insert"
  ON public.catalog_discounts FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_discounts_org_update" ON public.catalog_discounts;
CREATE POLICY "catalog_discounts_org_update"
  ON public.catalog_discounts FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_discounts_org_delete" ON public.catalog_discounts;
CREATE POLICY "catalog_discounts_org_delete"
  ON public.catalog_discounts FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_discounts_updated_at ON public.catalog_discounts;
CREATE TRIGGER update_catalog_discounts_updated_at
  BEFORE UPDATE ON public.catalog_discounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.catalog_discounts IS
  'Named discounts. fixed locks amount in back office; customizable amount is decided on POS.';

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
  '/operations/library/discounts',
  'Operations — Library — Discounts',
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
  AND d.page_path = '/operations/library/discounts'
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
WHERE d.page_path = '/operations/library/discounts'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );
