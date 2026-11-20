-- Fix PIN RPCs: pgcrypto lives in extensions schema (Supabase).
-- Functions with SET search_path = public could not resolve gen_salt/crypt.

CREATE OR REPLACE FUNCTION public.pos_staff_set_pin(
  p_staff_id uuid,
  p_pin text
)
RETURNS public.pos_employee_staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_employee_staff;
  v_pin text := trim(COALESCE(p_pin, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF length(v_pin) <> 4 OR v_pin !~ '^[0-9]+$' THEN
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
    pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf'::text)),
    pin_enabled = true,
    updated_at = now()
  WHERE id = p_staff_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_staff_set_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_staff_set_pin(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_staff_verify_pin(
  p_staff_id uuid,
  p_pin text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_employee_staff;
  v_pin text := trim(COALESCE(p_pin, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF length(v_pin) <> 4 OR v_pin !~ '^[0-9]+$' THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row
  FROM public.pos_employee_staff
  WHERE id = p_staff_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_row.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF NOT v_row.is_active OR NOT v_row.pin_enabled OR v_row.pin_hash IS NULL THEN
    RETURN false;
  END IF;
  IF NOT COALESCE(v_row.allow_pin_for_permissions, false) THEN
    RETURN false;
  END IF;

  RETURN extensions.crypt(v_pin, v_row.pin_hash) = v_row.pin_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_staff_verify_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_staff_verify_pin(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pos_verify_admin_pin_for_outlet(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_pin text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pin text := trim(COALESCE(p_pin, ''));
  v_staff public.pos_employee_staff;
  v_has_outlet boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF length(v_pin) <> 4 OR v_pin !~ '^[0-9]+$' THEN
    RETURN NULL;
  END IF;

  FOR v_staff IN
    SELECT s.*
    FROM public.pos_employee_staff s
    WHERE s.organization_id = p_organization_id
      AND s.is_active = true
      AND s.pin_enabled = true
      AND s.pin_hash IS NOT NULL
      AND COALESCE(s.allow_pin_for_permissions, false) = true
      AND (
        s.pos_role = 'administrator'
        OR EXISTS (
          SELECT 1
          FROM public.pos_employee_roles r
          WHERE r.id = s.role_id
            AND r.slug = 'administrator'
        )
      )
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.pos_employee_staff_outlets o
      WHERE o.staff_id = v_staff.id
        AND o.outlet_id = p_outlet_id
    ) INTO v_has_outlet;

    IF NOT v_has_outlet THEN
      IF EXISTS (
        SELECT 1 FROM public.pos_employee_staff_outlets o WHERE o.staff_id = v_staff.id
      ) THEN
        CONTINUE;
      END IF;
    END IF;

    IF extensions.crypt(v_pin, v_staff.pin_hash) = v_staff.pin_hash THEN
      RETURN v_staff.id;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_verify_admin_pin_for_outlet(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_verify_admin_pin_for_outlet(uuid, uuid, text) TO authenticated;
