-- QA: pos_shift_report + pos_shift_detail + pos_shift_expected_cash (cash refunds)
-- Run in Supabase SQL Editor with a real org/outlet that has shift data.

-- 1) List shifts (replace org id)
-- SELECT * FROM public.pos_shift_report(
--   p_organization_id := 'YOUR_ORG_ID'::uuid,
--   p_outlet_id := NULL,
--   p_from := date_trunc('month', now()),
--   p_to := date_trunc('month', now()) + interval '1 month',
--   p_opened_by := NULL,
--   p_cursor := NULL,
--   p_limit := 20
-- );

-- 2) Detail for one shift
-- SELECT public.pos_shift_detail('YOUR_SHIFT_ID'::uuid);

-- 3) Expected cash sanity (opening + cash sales - refunds + in - out)
-- WITH s AS (
--   SELECT id, opening_cash FROM public.pos_cashier_shifts WHERE id = 'YOUR_SHIFT_ID'::uuid
-- )
-- SELECT
--   public.pos_shift_expected_cash(s.id) AS expected_rpc,
--   s.opening_cash
--     + COALESCE((
--         SELECT SUM(sa.total_paid_amount)
--         FROM public.sales_activities sa
--         WHERE sa.pos_shift_id = s.id AND sa.payment_method = 'cash'
--           AND sa.status = 'Converted' AND COALESCE(sa.refund_status, 'none') = 'none'
--       ), 0)
--     - COALESCE((
--         SELECT SUM(sa.refund_amount)
--         FROM public.sales_activities sa
--         WHERE sa.refund_pos_shift_id = s.id AND sa.payment_method = 'cash'
--           AND COALESCE(sa.refund_status, 'none') = 'full'
--       ), 0)
--     + COALESCE((
--         SELECT SUM(m.amount) FROM public.pos_cash_movements m
--         WHERE m.shift_id = s.id AND m.direction = 'in'
--       ), 0)
--     - COALESCE((
--         SELECT SUM(m.amount) FROM public.pos_cash_movements m
--         WHERE m.shift_id = s.id AND m.direction = 'out'
--       ), 0) AS expected_manual
-- FROM s;

-- 4) Smoke: functions exist
SELECT
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'pos_shift_report'
  ) AS has_list_rpc,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'pos_shift_detail'
  ) AS has_detail_rpc;
