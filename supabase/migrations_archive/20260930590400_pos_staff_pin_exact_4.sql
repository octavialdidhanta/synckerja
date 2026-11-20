-- POS staff PIN: exactly 4 numeric digits (was 4–8).

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
