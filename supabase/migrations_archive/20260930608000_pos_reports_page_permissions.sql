-- POS Reports back-office pages + administrator ACL keys

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
    '/operations/reports/sales/summary',
    'Operations — POS — Reports — Sales',
    true,
    ARRAY['owner', 'admin', 'hr']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/operations/reports/transactions',
    'Operations — POS — Reports — Transactions',
    true,
    ARRAY['owner', 'admin', 'hr']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/operations/reports/invoices',
    'Operations — POS — Reports — Invoices',
    true,
    ARRAY['owner', 'admin', 'hr']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  ),
  (
    '/operations/reports/shift',
    'Operations — POS — Reports — Shift',
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
  '/operations/reports/sales/summary',
  '/operations/reports/transactions',
  '/operations/reports/invoices',
  '/operations/reports/shift'
)
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );

-- Keep default admin keys in sync (also backfill table management keys missed earlier)
CREATE OR REPLACE FUNCTION public.pos_default_admin_permission_keys()
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
    'bo.reports',
    'bo.reports.sales',
    'bo.reports.transactions',
    'bo.reports.invoices',
    'bo.reports.shift',
    'bo.inventory',
    'bo.inventory.summary',
    'bo.inventory.suppliers',
    'bo.inventory.purchase_orders',
    'bo.inventory.transfer',
    'bo.inventory.adjustments',
    'bo.inventory.sync_logs'
  ]::text[];
$$;

-- Alias kept for any callers of the misnamed function from table-management migration
CREATE OR REPLACE FUNCTION public.pos_default_administrator_permission_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.pos_default_admin_permission_keys();
$$;

-- Grant new report keys to existing system Administrator roles
INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
SELECT r.id, k.permission_key
FROM public.pos_employee_roles r
CROSS JOIN (
  VALUES
    ('bo.reports'),
    ('bo.reports.sales'),
    ('bo.reports.transactions'),
    ('bo.reports.invoices'),
    ('bo.reports.shift'),
    ('bo.table_management'),
    ('bo.table_management.group'),
    ('bo.table_management.map'),
    ('bo.table_management.report')
) AS k(permission_key)
WHERE r.slug = 'administrator'
  AND r.is_system = true
ON CONFLICT DO NOTHING;
