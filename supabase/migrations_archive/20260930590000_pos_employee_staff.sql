-- POS employee staff (slots / access / PIN) — separate from HR attendance shifts

CREATE TABLE IF NOT EXISTS public.pos_employee_staff (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  pos_role text NOT NULL DEFAULT 'cashier'
    CHECK (pos_role IN ('administrator', 'cashier')),
  pin_hash text,
  pin_enabled boolean NOT NULL DEFAULT false,
  allow_pin_for_permissions boolean NOT NULL DEFAULT true,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  invited_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_employee_staff_pkey PRIMARY KEY (id),
  CONSTRAINT pos_employee_staff_org_employee_unique UNIQUE (organization_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_employee_staff_org
  ON public.pos_employee_staff (organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_pos_employee_staff_employee
  ON public.pos_employee_staff (employee_id);

ALTER TABLE public.pos_employee_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_employee_staff_org_select" ON public.pos_employee_staff;
CREATE POLICY "pos_employee_staff_org_select"
  ON public.pos_employee_staff FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_employee_staff_org_insert" ON public.pos_employee_staff;
CREATE POLICY "pos_employee_staff_org_insert"
  ON public.pos_employee_staff FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_employee_staff_org_update" ON public.pos_employee_staff;
CREATE POLICY "pos_employee_staff_org_update"
  ON public.pos_employee_staff FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_employee_staff_org_delete" ON public.pos_employee_staff;
CREATE POLICY "pos_employee_staff_org_delete"
  ON public.pos_employee_staff FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_pos_employee_staff_updated_at ON public.pos_employee_staff;
CREATE TRIGGER update_pos_employee_staff_updated_at
  BEFORE UPDATE ON public.pos_employee_staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pos_employee_staff_outlets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.pos_employee_staff (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_employee_staff_outlets_pkey PRIMARY KEY (id),
  CONSTRAINT pos_employee_staff_outlets_unique UNIQUE (staff_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_employee_staff_outlets_staff
  ON public.pos_employee_staff_outlets (staff_id);

CREATE INDEX IF NOT EXISTS idx_pos_employee_staff_outlets_org
  ON public.pos_employee_staff_outlets (organization_id);

ALTER TABLE public.pos_employee_staff_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_employee_staff_outlets_org_select" ON public.pos_employee_staff_outlets;
CREATE POLICY "pos_employee_staff_outlets_org_select"
  ON public.pos_employee_staff_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_employee_staff_outlets_org_insert" ON public.pos_employee_staff_outlets;
CREATE POLICY "pos_employee_staff_outlets_org_insert"
  ON public.pos_employee_staff_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_employee_staff_outlets_org_delete" ON public.pos_employee_staff_outlets;
CREATE POLICY "pos_employee_staff_outlets_org_delete"
  ON public.pos_employee_staff_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- Org-level light PIN policy flags (single row per org)
CREATE TABLE IF NOT EXISTS public.pos_pin_access_settings (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  require_pin_for_void boolean NOT NULL DEFAULT false,
  require_pin_for_refund boolean NOT NULL DEFAULT false,
  require_pin_for_discount boolean NOT NULL DEFAULT false,
  require_pin_for_cash_drawer boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_pin_access_settings_pkey PRIMARY KEY (organization_id)
);

ALTER TABLE public.pos_pin_access_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_pin_access_settings_org_select" ON public.pos_pin_access_settings;
CREATE POLICY "pos_pin_access_settings_org_select"
  ON public.pos_pin_access_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_pin_access_settings_org_upsert" ON public.pos_pin_access_settings;
DROP POLICY IF EXISTS "pos_pin_access_settings_org_insert" ON public.pos_pin_access_settings;
CREATE POLICY "pos_pin_access_settings_org_insert"
  ON public.pos_pin_access_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_pin_access_settings_org_update" ON public.pos_pin_access_settings;
CREATE POLICY "pos_pin_access_settings_org_update"
  ON public.pos_pin_access_settings FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_pos_pin_access_settings_updated_at ON public.pos_pin_access_settings;
CREATE TRIGGER update_pos_pin_access_settings_updated_at
  BEFORE UPDATE ON public.pos_pin_access_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Set PIN (bcrypt via pgcrypto extensions if available; fallback crypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.pos_staff_set_pin(
  p_staff_id uuid,
  p_pin text
)
RETURNS public.pos_employee_staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_employee_staff;
  v_pin text := trim(COALESCE(p_pin, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF length(v_pin) < 4 OR length(v_pin) > 8 OR v_pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  SELECT * INTO v_row FROM public.pos_employee_staff WHERE id = p_staff_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff_not_found';
  END IF;
  IF v_row.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  UPDATE public.pos_employee_staff
  SET
    pin_hash = crypt(v_pin, gen_salt('bf')),
    pin_enabled = true,
    updated_at = now()
  WHERE id = p_staff_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_staff_set_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_staff_set_pin(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_staff_clear_pin(p_staff_id uuid)
RETURNS public.pos_employee_staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_employee_staff;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_row FROM public.pos_employee_staff WHERE id = p_staff_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff_not_found';
  END IF;
  IF v_row.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  UPDATE public.pos_employee_staff
  SET
    pin_hash = NULL,
    pin_enabled = false,
    updated_at = now()
  WHERE id = p_staff_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_staff_clear_pin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_staff_clear_pin(uuid) TO authenticated;

-- Replace outlet assignments for a staff row
CREATE OR REPLACE FUNCTION public.pos_staff_set_outlets(
  p_staff_id uuid,
  p_outlet_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_staff public.pos_employee_staff;
  v_outlet uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_staff FROM public.pos_employee_staff WHERE id = p_staff_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff_not_found';
  END IF;
  IF v_staff.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  DELETE FROM public.pos_employee_staff_outlets WHERE staff_id = p_staff_id;

  IF p_outlet_ids IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_outlet IN ARRAY p_outlet_ids LOOP
    IF EXISTS (
      SELECT 1 FROM public.pos_outlets o
      WHERE o.id = v_outlet
        AND o.organization_id = v_staff.organization_id
        AND COALESCE(o.is_deleted, false) = false
    ) THEN
      INSERT INTO public.pos_employee_staff_outlets (organization_id, staff_id, outlet_id)
      VALUES (v_staff.organization_id, p_staff_id, v_outlet)
      ON CONFLICT (staff_id, outlet_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_staff_set_outlets(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_staff_set_outlets(uuid, uuid[]) TO authenticated;
