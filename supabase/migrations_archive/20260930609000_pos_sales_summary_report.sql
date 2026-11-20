-- Sales Summary: discount column + report RPC + Dashboard page permission

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS checkout_discount_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.sales_activities.checkout_discount_amount IS
  'Total line discounts (Rp) applied at Store Checkout; Gross Sales = checkout_subtotal + this.';

CREATE OR REPLACE FUNCTION public.pos_sales_summary_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  gross_sales numeric,
  discounts numeric,
  refunds numeric,
  net_sales numeric,
  gratuity numeric,
  tax numeric,
  rounding numeric,
  total_collected numeric,
  transaction_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net numeric := 0;
  v_discounts numeric := 0;
  v_gratuity numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_count bigint := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(sa.checkout_subtotal, 0)), 0),
    COALESCE(SUM(COALESCE(sa.checkout_discount_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sa.checkout_gratuity_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sa.checkout_tax_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sa.total_paid_amount, sa.total_amount, 0)), 0),
    COUNT(*)::bigint
  INTO v_net, v_discounts, v_gratuity, v_tax, v_total, v_count
  FROM public.sales_activities sa
  WHERE sa.organization_id = p_organization_id
    AND sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
    AND (p_from IS NULL OR sa.created_at >= p_from)
    AND (p_to IS NULL OR sa.created_at < p_to);

  RETURN QUERY
  SELECT
    (v_net + v_discounts)::numeric AS gross_sales,
    v_discounts::numeric AS discounts,
    0::numeric AS refunds,
    v_net::numeric AS net_sales,
    v_gratuity::numeric AS gratuity,
    v_tax::numeric AS tax,
    0::numeric AS rounding,
    v_total::numeric AS total_collected,
    v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_sales_summary_report(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_sales_summary_report(uuid, uuid, timestamptz, timestamptz) TO authenticated;

-- Dashboard page access
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
    '/operations/dashboard',
    'Operations — POS — Dashboard',
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
WHERE d.page_path = '/operations/dashboard'
  AND NOT EXISTS (
    SELECT 1
    FROM public.permission_configurations p
    WHERE p.organization_id = o.id
      AND p.page_path = d.page_path
  );

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
    'bo.dashboard',
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

CREATE OR REPLACE FUNCTION public.pos_default_administrator_permission_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.pos_default_admin_permission_keys();
$$;

INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
SELECT r.id, k.permission_key
FROM public.pos_employee_roles r
CROSS JOIN (
  VALUES
    ('bo.dashboard')
) AS k(permission_key)
WHERE r.slug = 'administrator'
  AND r.is_system = true
ON CONFLICT DO NOTHING;
