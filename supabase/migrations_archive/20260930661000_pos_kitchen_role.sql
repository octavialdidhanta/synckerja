-- System role Kitchen + app.kitchen_display entitlement.

CREATE OR REPLACE FUNCTION public.pos_default_kitchen_permission_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'app.kitchen_display'
  ]::text[];
$$;

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
    'app.kitchen_display',
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
    'bo.settings.bank_account',
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

CREATE OR REPLACE FUNCTION public.pos_ensure_default_roles(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_cashier_id uuid;
  v_kitchen_id uuid;
  v_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  INSERT INTO public.pos_employee_roles (organization_id, name, slug, is_system)
  VALUES (p_organization_id, 'Administrator', 'administrator', true)
  ON CONFLICT (organization_id, slug) DO UPDATE
    SET name = EXCLUDED.name, is_system = true, updated_at = now();

  SELECT id INTO v_admin_id
  FROM public.pos_employee_roles
  WHERE organization_id = p_organization_id AND slug = 'administrator';

  INSERT INTO public.pos_employee_roles (organization_id, name, slug, is_system)
  VALUES (p_organization_id, 'Cashier', 'cashier', true)
  ON CONFLICT (organization_id, slug) DO UPDATE
    SET name = EXCLUDED.name, is_system = true, updated_at = now();

  SELECT id INTO v_cashier_id
  FROM public.pos_employee_roles
  WHERE organization_id = p_organization_id AND slug = 'cashier';

  INSERT INTO public.pos_employee_roles (organization_id, name, slug, is_system)
  VALUES (p_organization_id, 'Kitchen', 'kitchen', true)
  ON CONFLICT (organization_id, slug) DO UPDATE
    SET name = EXCLUDED.name, is_system = true, updated_at = now();

  SELECT id INTO v_kitchen_id
  FROM public.pos_employee_roles
  WHERE organization_id = p_organization_id AND slug = 'kitchen';

  IF NOT EXISTS (
    SELECT 1 FROM public.pos_employee_role_permissions WHERE role_id = v_admin_id
  ) THEN
    FOREACH v_key IN ARRAY public.pos_default_admin_permission_keys() LOOP
      INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
      VALUES (v_admin_id, v_key)
      ON CONFLICT DO NOTHING;
    END LOOP;
  ELSE
    INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
    VALUES (v_admin_id, 'app.kitchen_display')
    ON CONFLICT DO NOTHING;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pos_employee_role_permissions WHERE role_id = v_cashier_id
  ) THEN
    FOREACH v_key IN ARRAY public.pos_default_cashier_permission_keys() LOOP
      INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
      VALUES (v_cashier_id, v_key)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pos_employee_role_permissions WHERE role_id = v_kitchen_id
  ) THEN
    FOREACH v_key IN ARRAY public.pos_default_kitchen_permission_keys() LOOP
      INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
      VALUES (v_kitchen_id, v_key)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.pos_employee_staff s
  SET role_id = r.id
  FROM public.pos_employee_roles r
  WHERE s.organization_id = p_organization_id
    AND s.role_id IS NULL
    AND r.organization_id = p_organization_id
    AND r.slug = s.pos_role;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_ensure_default_roles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_ensure_default_roles(uuid) TO authenticated;

-- Backfill Kitchen role + admin kitchen_display for every organization
DO $$
DECLARE
  org RECORD;
  v_admin_id uuid;
  v_kitchen_id uuid;
  v_key text;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    INSERT INTO public.pos_employee_roles (organization_id, name, slug, is_system)
    VALUES (org.id, 'Kitchen', 'kitchen', true)
    ON CONFLICT (organization_id, slug) DO UPDATE
      SET name = EXCLUDED.name, is_system = true, updated_at = now();

    SELECT id INTO v_kitchen_id FROM public.pos_employee_roles
    WHERE organization_id = org.id AND slug = 'kitchen';

    SELECT id INTO v_admin_id FROM public.pos_employee_roles
    WHERE organization_id = org.id AND slug = 'administrator';

    IF v_kitchen_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.pos_employee_role_permissions WHERE role_id = v_kitchen_id
    ) THEN
      FOREACH v_key IN ARRAY public.pos_default_kitchen_permission_keys() LOOP
        INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
        VALUES (v_kitchen_id, v_key) ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    IF v_admin_id IS NOT NULL THEN
      INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
      VALUES (v_admin_id, 'app.kitchen_display')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
