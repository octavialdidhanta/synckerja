-- Allow pos_shift_detail from edge functions (service role: auth.uid() is null).
-- Without this, dispatch-pos-shift-recap fails with forbidden_org and emails stay pending_send.

CREATE OR REPLACE FUNCTION public.pos_shift_detail(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.pos_cashier_shifts;
  v_outlet_name text;
  v_opened_by_name text;
  v_closed_by_name text;
  v_expected numeric;
  v_cash_sales numeric := 0;
  v_cash_refunds numeric := 0;
  v_cash_in numeric := 0;
  v_cash_out numeric := 0;
  v_products_sold_qty numeric := 0;
  v_refunded_products_qty numeric := 0;
  v_sold_lines jsonb := '[]'::jsonb;
  v_cash_movements jsonb := '[]'::jsonb;
  v_payment_methods jsonb := '[]'::jsonb;
  v_difference numeric;
BEGIN
  SELECT * INTO v_shift FROM public.pos_cashier_shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift_not_found';
  END IF;

  IF auth.uid() IS NOT NULL
     AND v_shift.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  SELECT COALESCE(o.name, '—') INTO v_outlet_name
  FROM public.pos_outlets o
  WHERE o.id = v_shift.outlet_id;

  v_opened_by_name := public.pos_shift_cashier_display_name(v_shift.opened_by, v_shift.organization_id);
  v_closed_by_name := public.pos_shift_cashier_display_name(v_shift.closed_by, v_shift.organization_id);
  v_expected := public.pos_shift_expected_cash(p_shift_id);

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

  SELECT COALESCE(SUM(sai.quantity), 0) INTO v_products_sold_qty
  FROM public.sales_activities sa
  INNER JOIN public.sales_activity_items sai ON sai.sales_activity_id = sa.id
  WHERE sa.pos_shift_id = p_shift_id
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none';

  SELECT COALESCE(SUM(sai.quantity), 0) INTO v_refunded_products_qty
  FROM public.sales_activities sa
  INNER JOIN public.sales_activity_items sai ON sai.sales_activity_id = sa.id
  WHERE sa.refund_pos_shift_id = p_shift_id
    AND COALESCE(sa.refund_status, 'none') = 'full';

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'service_name', agg.service_name,
        'sub_service_name', agg.sub_service_name,
        'quantity', agg.qty
      )
      ORDER BY agg.service_name, agg.sub_service_name
    ),
    '[]'::jsonb
  ) INTO v_sold_lines
  FROM (
    SELECT
      sai.service_name,
      sai.sub_service_name,
      SUM(sai.quantity)::numeric AS qty
    FROM public.sales_activities sa
    INNER JOIN public.sales_activity_items sai ON sai.sales_activity_id = sa.id
    WHERE sa.pos_shift_id = p_shift_id
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
    GROUP BY sai.service_name, sai.sub_service_name
  ) agg;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'direction', m.direction,
        'amount', m.amount,
        'description', m.description,
        'created_at', m.created_at
      )
      ORDER BY m.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_cash_movements
  FROM public.pos_cash_movements m
  WHERE m.shift_id = p_shift_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'payment_method', pm.payment_method,
        'total_collected', pm.total_collected
      )
      ORDER BY pm.total_collected DESC
    ),
    '[]'::jsonb
  ) INTO v_payment_methods
  FROM (
    SELECT
      COALESCE(NULLIF(btrim(sa.payment_method), ''), 'unknown') AS payment_method,
      COALESCE(SUM(sa.total_paid_amount), 0)::numeric AS total_collected
    FROM public.sales_activities sa
    WHERE sa.pos_shift_id = p_shift_id
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
    GROUP BY COALESCE(NULLIF(btrim(sa.payment_method), ''), 'unknown')
  ) pm;

  v_difference := CASE
    WHEN v_shift.status = 'closed' AND v_shift.closing_cash IS NOT NULL
      THEN v_shift.closing_cash - v_expected
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'shift_id', v_shift.id,
    'outlet_id', v_shift.outlet_id,
    'outlet_name', v_outlet_name,
    'opened_at', v_shift.opened_at,
    'closed_at', v_shift.closed_at,
    'status', v_shift.status,
    'opened_by_user_id', v_shift.opened_by,
    'opened_by_name', v_opened_by_name,
    'closed_by_user_id', v_shift.closed_by,
    'closed_by_name', v_closed_by_name,
    'opening_cash', v_shift.opening_cash,
    'expected_cash', v_expected,
    'closing_cash', v_shift.closing_cash,
    'cash_difference', v_difference,
    'cash_sales', v_cash_sales,
    'cash_refunds', v_cash_refunds,
    'cash_from_invoices', 0,
    'cash_in', v_cash_in,
    'cash_out', v_cash_out,
    'cash_in_out_net', v_cash_in - v_cash_out,
    'products_sold_qty', v_products_sold_qty,
    'refunded_products_qty', v_refunded_products_qty,
    'sold_lines', v_sold_lines,
    'cash_movements', v_cash_movements,
    'payment_methods', v_payment_methods
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_shift_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_shift_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_shift_detail(uuid) TO service_role;
