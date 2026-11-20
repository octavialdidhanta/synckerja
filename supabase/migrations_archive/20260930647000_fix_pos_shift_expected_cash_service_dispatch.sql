-- Allow pos_shift_expected_cash from service role (edge function shift recap dispatch).

CREATE OR REPLACE FUNCTION public.pos_shift_expected_cash(p_shift_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.pos_cashier_shifts;
  v_cash_sales numeric := 0;
  v_cash_refunds numeric := 0;
  v_cash_in numeric := 0;
  v_cash_out numeric := 0;
BEGIN
  SELECT * INTO v_shift FROM public.pos_cashier_shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift_not_found';
  END IF;

  IF auth.uid() IS NOT NULL
     AND v_shift.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  SELECT COALESCE(SUM(sa.total_paid_amount), 0) INTO v_cash_sales
  FROM public.sales_activities sa
  WHERE sa.pos_shift_id = p_shift_id
    AND sa.payment_method = 'cash'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none';

  SELECT COALESCE(SUM(sa.refund_amount), 0) INTO v_cash_refunds
  FROM public.sales_activities sa
  WHERE sa.refund_pos_shift_id = p_shift_id
    AND sa.payment_method = 'cash'
    AND COALESCE(sa.refund_status, 'none') = 'full';

  SELECT
    COALESCE(SUM(CASE WHEN m.direction = 'in' THEN m.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.direction = 'out' THEN m.amount ELSE 0 END), 0)
  INTO v_cash_in, v_cash_out
  FROM public.pos_cash_movements m
  WHERE m.shift_id = p_shift_id;

  RETURN v_shift.opening_cash + v_cash_sales - v_cash_refunds + v_cash_in - v_cash_out;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_shift_expected_cash(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_shift_expected_cash(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_shift_expected_cash(uuid) TO service_role;
