-- POS table groups (areas/zones per outlet) + page permissions + admin ACL keys

CREATE TABLE IF NOT EXISTS public.pos_table_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_table_groups_pkey PRIMARY KEY (id),
  CONSTRAINT pos_table_groups_name_check CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_table_groups_outlet_name
  ON public.pos_table_groups (outlet_id, lower(btrim(name)))
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_pos_table_groups_org_outlet
  ON public.pos_table_groups (organization_id, outlet_id, name)
  WHERE is_deleted = false;

DROP TRIGGER IF EXISTS update_pos_table_groups_updated_at ON public.pos_table_groups;
CREATE TRIGGER update_pos_table_groups_updated_at
  BEFORE UPDATE ON public.pos_table_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pos_table_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_table_groups_org_select" ON public.pos_table_groups;
CREATE POLICY "pos_table_groups_org_select"
  ON public.pos_table_groups FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_table_groups_org_insert" ON public.pos_table_groups;
CREATE POLICY "pos_table_groups_org_insert"
  ON public.pos_table_groups FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_table_groups_org_update" ON public.pos_table_groups;
CREATE POLICY "pos_table_groups_org_update"
  ON public.pos_table_groups FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_table_groups_org_delete" ON public.pos_table_groups;
CREATE POLICY "pos_table_groups_org_delete"
  ON public.pos_table_groups FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- Page permissions
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
    '/operations/table-management/group',
    'Operations — POS — Table Group',
    true,
    ARRAY['owner', 'admin', 'hr']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/operations/table-management/map',
    'Operations — POS — Table Map',
    true,
    ARRAY['owner', 'admin', 'hr']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/operations/table-management/report',
    'Operations — POS — Table Report',
    true,
    ARRAY['owner', 'admin', 'hr']::text[],
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
WHERE d.page_path IN (
  '/operations/table-management/group',
  '/operations/table-management/map',
  '/operations/table-management/report'
)
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );

-- Extend Administrator default permission keys with table management
CREATE OR REPLACE FUNCTION public.pos_default_administrator_permission_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'app.pos.charge',
    'app.pos.manage_open_bills',
    'app.pos.discounts',
    'app.pos.refunds',
    'app.pos.void_cancel',
    'app.pos.resend_receipt',
    'app.shift.view_print',
    'app.shift.cash_movement',
    'app.settings.view',
    'app.settings.edit',
    'app.customers.edit',
    'app.table_map',
    'app.online_orders',
    'app.inventory',
    'bo.library',
    'bo.library.products',
    'bo.library.bundles',
    'bo.library.categories',
    'bo.library.brands',
    'bo.library.modifiers',
    'bo.library.promos',
    'bo.library.discounts',
    'bo.library.sales_types',
    'bo.library.taxes',
    'bo.library.gratuity',
    'bo.ingredient',
    'bo.ingredient.list',
    'bo.ingredient.categories',
    'bo.ingredient.recipes',
    'bo.settings',
    'bo.settings.outlets',
    'bo.settings.checkout',
    'bo.settings.receipt',
    'bo.settings.email_notifications',
    'bo.settings.inventory',
    'bo.customers',
    'bo.customers.list',
    'bo.customers.feedback',
    'bo.employees',
    'bo.employees.slots',
    'bo.employees.access',
    'bo.employees.pin_access',
    'bo.table_management',
    'bo.table_management.group',
    'bo.table_management.map',
    'bo.table_management.report',
    'bo.inventory',
    'bo.inventory.summary',
    'bo.inventory.suppliers',
    'bo.inventory.purchase_orders',
    'bo.inventory.transfer',
    'bo.inventory.adjustments',
    'bo.inventory.sync_logs'
  ]::text[];
$$;
