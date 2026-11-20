-- POS employee roles + permissions (Employee Access / Moka-like)

CREATE TABLE IF NOT EXISTS public.pos_employee_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_employee_roles_pkey PRIMARY KEY (id),
  CONSTRAINT pos_employee_roles_org_slug_unique UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pos_employee_roles_org
  ON public.pos_employee_roles (organization_id);

ALTER TABLE public.pos_employee_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_employee_roles_org_select" ON public.pos_employee_roles;
CREATE POLICY "pos_employee_roles_org_select"
  ON public.pos_employee_roles FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_employee_roles_org_insert" ON public.pos_employee_roles;
CREATE POLICY "pos_employee_roles_org_insert"
  ON public.pos_employee_roles FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_employee_roles_org_update" ON public.pos_employee_roles;
CREATE POLICY "pos_employee_roles_org_update"
  ON public.pos_employee_roles FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_employee_roles_org_delete" ON public.pos_employee_roles;
CREATE POLICY "pos_employee_roles_org_delete"
  ON public.pos_employee_roles FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND is_system = false
  );

DROP TRIGGER IF EXISTS update_pos_employee_roles_updated_at ON public.pos_employee_roles;
CREATE TRIGGER update_pos_employee_roles_updated_at
  BEFORE UPDATE ON public.pos_employee_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_employee_role_permissions (
  role_id uuid NOT NULL REFERENCES public.pos_employee_roles (id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_employee_role_permissions_pkey PRIMARY KEY (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_pos_employee_role_permissions_key
  ON public.pos_employee_role_permissions (permission_key);

ALTER TABLE public.pos_employee_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_employee_role_permissions_org_select" ON public.pos_employee_role_permissions;
CREATE POLICY "pos_employee_role_permissions_org_select"
  ON public.pos_employee_role_permissions FOR SELECT TO authenticated
  USING (
    role_id IN (
      SELECT r.id FROM public.pos_employee_roles r
      WHERE r.organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "pos_employee_role_permissions_org_insert" ON public.pos_employee_role_permissions;
CREATE POLICY "pos_employee_role_permissions_org_insert"
  ON public.pos_employee_role_permissions FOR INSERT TO authenticated
  WITH CHECK (
    role_id IN (
      SELECT r.id FROM public.pos_employee_roles r
      WHERE r.organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "pos_employee_role_permissions_org_delete" ON public.pos_employee_role_permissions;
CREATE POLICY "pos_employee_role_permissions_org_delete"
  ON public.pos_employee_role_permissions FOR DELETE TO authenticated
  USING (
    role_id IN (
      SELECT r.id FROM public.pos_employee_roles r
      WHERE r.organization_id IN (SELECT public.user_organization_ids())
    )
  );

ALTER TABLE public.pos_employee_staff
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.pos_employee_roles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pos_employee_staff_role
  ON public.pos_employee_staff (role_id);

-- Default permission keys (must stay in sync with app catalog)
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
    'bo.inventory',
    'bo.inventory.summary',
    'bo.inventory.suppliers',
    'bo.inventory.purchase_orders',
    'bo.inventory.transfer',
    'bo.inventory.adjustments',
    'bo.inventory.sync_logs'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public.pos_default_cashier_permission_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'app.pos.charge',
    'app.pos.manage_open_bills',
    'app.shift.view_print',
    'app.settings.view'
  ]::text[];
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
    SET name = EXCLUDED.name, is_system = true, updated_at = now()
  RETURNING id INTO v_admin_id;

  SELECT id INTO v_admin_id
  FROM public.pos_employee_roles
  WHERE organization_id = p_organization_id AND slug = 'administrator';

  INSERT INTO public.pos_employee_roles (organization_id, name, slug, is_system)
  VALUES (p_organization_id, 'Cashier', 'cashier', true)
  ON CONFLICT (organization_id, slug) DO UPDATE
    SET name = EXCLUDED.name, is_system = true, updated_at = now()
  RETURNING id INTO v_cashier_id;

  SELECT id INTO v_cashier_id
  FROM public.pos_employee_roles
  WHERE organization_id = p_organization_id AND slug = 'cashier';

  -- Only seed permissions if role has none (preserve custom edits)
  IF NOT EXISTS (
    SELECT 1 FROM public.pos_employee_role_permissions WHERE role_id = v_admin_id
  ) THEN
    FOREACH v_key IN ARRAY public.pos_default_admin_permission_keys() LOOP
      INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
      VALUES (v_admin_id, v_key)
      ON CONFLICT DO NOTHING;
    END LOOP;
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

  -- Backfill staff.role_id from legacy pos_role
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

-- Seed defaults for every existing organization
DO $$
DECLARE
  org RECORD;
  v_admin_id uuid;
  v_cashier_id uuid;
  v_key text;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    INSERT INTO public.pos_employee_roles (organization_id, name, slug, is_system)
    VALUES (org.id, 'Administrator', 'administrator', true)
    ON CONFLICT (organization_id, slug) DO NOTHING;

    INSERT INTO public.pos_employee_roles (organization_id, name, slug, is_system)
    VALUES (org.id, 'Cashier', 'cashier', true)
    ON CONFLICT (organization_id, slug) DO NOTHING;

    SELECT id INTO v_admin_id FROM public.pos_employee_roles
    WHERE organization_id = org.id AND slug = 'administrator';

    SELECT id INTO v_cashier_id FROM public.pos_employee_roles
    WHERE organization_id = org.id AND slug = 'cashier';

    IF v_admin_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.pos_employee_role_permissions WHERE role_id = v_admin_id
    ) THEN
      FOREACH v_key IN ARRAY public.pos_default_admin_permission_keys() LOOP
        INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
        VALUES (v_admin_id, v_key) ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    IF v_cashier_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.pos_employee_role_permissions WHERE role_id = v_cashier_id
    ) THEN
      FOREACH v_key IN ARRAY public.pos_default_cashier_permission_keys() LOOP
        INSERT INTO public.pos_employee_role_permissions (role_id, permission_key)
        VALUES (v_cashier_id, v_key) ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    UPDATE public.pos_employee_staff s
    SET role_id = r.id
    FROM public.pos_employee_roles r
    WHERE s.organization_id = org.id
      AND s.role_id IS NULL
      AND r.organization_id = org.id
      AND r.slug = s.pos_role;
  END LOOP;
END $$;
