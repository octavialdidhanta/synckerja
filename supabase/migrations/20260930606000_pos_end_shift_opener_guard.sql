-- Restrict pos_end_shift to the shift opener or org owner/admin.

CREATE OR REPLACE FUNCTION public.pos_end_shift(
  p_shift_id uuid,
  p_closing_cash numeric
)
RETURNS public.pos_cashier_shifts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_cashier_shifts;
  v_expected numeric;
  v_closing numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_closing_cash IS NULL OR p_closing_cash < 0 THEN
    RAISE EXCEPTION 'invalid_closing_cash';
  END IF;

  v_closing := ROUND(p_closing_cash::numeric, 2);

  SELECT * INTO v_row FROM public.pos_cashier_shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift_not_found';
  END IF;
  IF v_row.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF v_row.status <> 'open' THEN
    RAISE EXCEPTION 'shift_not_open';
  END IF;

  -- Opener or privileged org role only (client leave-gate mirrors this).
  IF v_row.opened_by IS DISTINCT FROM v_user
     AND NOT public.user_is_org_owner_or_admin(v_row.organization_id) THEN
    RAISE EXCEPTION 'not_shift_opener';
  END IF;

  v_expected := public.pos_shift_expected_cash(p_shift_id);

  UPDATE public.pos_cashier_shifts
  SET
    status = 'closed',
    closed_at = now(),
    closed_by = v_user,
    expected_cash = v_expected,
    closing_cash = v_closing,
    updated_at = now()
  WHERE id = p_shift_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_end_shift(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_end_shift(uuid, numeric) TO authenticated;
