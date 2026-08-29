-- Transactions report QA (read-only)
-- Supabase SQL Editor: edit values in each `params` CTE, then run one section at a time.
-- NOTE: Do NOT call pos_transactions_* RPCs here — they require auth.uid() / JWT context.
--       Use direct aggregation below (same filters as the RPCs) for SQL Editor QA.

-- =============================================================================
-- 1) Success orders summary (mirrors pos_transactions_success_orders filters)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    NULL::uuid AS outlet_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
),
filtered AS (
  SELECT
    sa.id,
    sa.created_at,
    sa.pos_outlet_id,
    sa.created_by,
    sa.served_by_user_id,
    COALESCE(sa.total_paid_amount, sa.total_amount, 0)::numeric AS collected,
    public.pos_sales_activity_exclusive_net(
      sa.checkout_subtotal,
      sa.checkout_tax_amount,
      sa.checkout_gratuity_amount,
      COALESCE(sa.total_paid_amount, sa.total_amount, 0),
      sa.checkout_application_method
    ) AS bill_net,
    COALESCE(sa.checkout_discount_amount, 0)::numeric AS discount_amount
  FROM params p
  JOIN public.sales_activities sa ON sa.organization_id = p.organization_id
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND (p.outlet_id IS NULL OR sa.pos_outlet_id = p.outlet_id)
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
)
SELECT
  COUNT(*)::bigint AS summary_txn_count,
  COALESCE(SUM(f.collected), 0)::numeric AS summary_total_collected,
  COALESCE(SUM(f.bill_net), 0)::numeric AS summary_net_sales,
  COALESCE(SUM(f.bill_net + f.discount_amount), 0)::numeric AS summary_gross_sales
FROM filtered f;

-- =============================================================================
-- 2) Success orders sample rows (receipt code + item summary, top 20)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    NULL::uuid AS outlet_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive,
    ''::text AS receipt_prefix  -- set e.g. upper(replace('SC-ABCD1234','SC-','')) for prefix search
),
filtered AS (
  SELECT
    sa.id,
    sa.created_at,
    sa.pos_outlet_id,
    sa.created_by,
    COALESCE(sa.total_paid_amount, sa.total_amount, 0)::numeric AS collected
  FROM params p
  JOIN public.sales_activities sa ON sa.organization_id = p.organization_id
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND (p.outlet_id IS NULL OR sa.pos_outlet_id = p.outlet_id)
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
    AND (
      p.receipt_prefix = ''
      OR upper(replace(sa.id::text, '-', '')) LIKE p.receipt_prefix || '%'
    )
  ORDER BY sa.created_at DESC
  LIMIT 20
)
SELECT
  f.id AS activity_id,
  ('SC-' || upper(substr(replace(f.id::text, '-', ''), 1, 8))) AS receipt_code,
  f.created_at,
  COALESCE(NULLIF(btrim(po.name), ''), '—') AS outlet_name,
  COALESCE(
    NULLIF(btrim(ec.full_name), ''),
    NULLIF(btrim(pc.full_name), ''),
    NULLIF(split_part(auc.email, '@', 1), ''),
    'Unknown Staff'
  ) AS collected_by_name,
  COALESCE(items.item_summary, '') AS item_summary,
  f.collected AS total_collected
FROM filtered f
LEFT JOIN public.pos_outlets po ON po.id = f.pos_outlet_id
LEFT JOIN public.employees ec
  ON ec.user_id = f.created_by
 AND ec.organization_id = (SELECT organization_id FROM params)
LEFT JOIN public.profiles pc ON pc.user_id = f.created_by
LEFT JOIN auth.users auc ON auc.id = f.created_by
LEFT JOIN LATERAL (
  SELECT string_agg(sub.n, ', ' ORDER BY sub.ord) AS item_summary
  FROM (
    SELECT
      COALESCE(NULLIF(btrim(sai.service_name), ''), 'Item') AS n,
      row_number() OVER (ORDER BY sai.created_at) AS ord
    FROM public.sales_activity_items sai
    WHERE sai.sales_activity_id = f.id
    ORDER BY sai.created_at
    LIMIT 3
  ) sub
) items ON true
ORDER BY f.created_at DESC;

-- =============================================================================
-- 3) Cancelled orders (mirrors pos_transactions_cancelled_orders filters)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    NULL::uuid AS outlet_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
)
SELECT
  pts.id AS session_id,
  pts.closed_at,
  COALESCE(NULLIF(btrim(po.name), ''), '—') AS outlet_name,
  COALESCE(NULLIF(btrim(pts.table_name), ''), '—') AS table_name,
  COALESCE(
    NULLIF(btrim(e.full_name), ''),
    NULLIF(btrim(pr.full_name), ''),
    NULLIF(split_part(au.email, '@', 1), ''),
    'Unknown Staff'
  ) AS staff_name,
  COALESCE(NULLIF(btrim(pts.cancel_reason), ''), '—') AS cancel_reason,
  jsonb_array_length(COALESCE(pts.cart_snapshot, '[]'::jsonb)) AS cart_line_count
FROM params p
JOIN public.pos_table_sessions pts ON pts.organization_id = p.organization_id
LEFT JOIN public.pos_outlets po ON po.id = pts.outlet_id
LEFT JOIN public.employees e
  ON e.user_id = COALESCE(pts.waiter_id, pts.opened_by)
 AND e.organization_id = p.organization_id
LEFT JOIN public.profiles pr ON pr.user_id = COALESCE(pts.waiter_id, pts.opened_by)
LEFT JOIN auth.users au ON au.id = COALESCE(pts.waiter_id, pts.opened_by)
WHERE pts.status = 'cancelled'
  AND pts.closed_at IS NOT NULL
  AND (p.outlet_id IS NULL OR pts.outlet_id = p.outlet_id)
  AND pts.closed_at >= p.date_from
  AND pts.closed_at < p.date_to_exclusive
ORDER BY pts.closed_at DESC
LIMIT 50;

-- =============================================================================
-- 4) Void items (mirrors pos_transactions_void_items filters)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    NULL::uuid AS outlet_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
)
SELECT
  v.id AS void_id,
  v.created_at,
  COALESCE(NULLIF(btrim(po.name), ''), '—') AS outlet_name,
  COALESCE(NULLIF(btrim(pts.table_name), ''), '—') AS table_name,
  COALESCE(NULLIF(btrim(v.product_name), ''), '—') AS product_name,
  v.quantity::numeric,
  v.unit_price::numeric,
  (v.quantity * v.unit_price)::numeric AS line_total,
  COALESCE(NULLIF(btrim(v.reason), ''), '—') AS reason,
  COALESCE(
    NULLIF(btrim(pr.full_name), ''),
    NULLIF(split_part(au.email, '@', 1), ''),
    'Unknown Staff'
  ) AS voided_by_name
FROM params p
JOIN public.pos_line_voids v ON v.organization_id = p.organization_id
LEFT JOIN public.pos_outlets po ON po.id = v.outlet_id
LEFT JOIN public.pos_table_sessions pts ON pts.id = v.session_id
LEFT JOIN public.profiles pr ON pr.user_id = v.voided_by
LEFT JOIN auth.users au ON au.id = v.voided_by
WHERE (p.outlet_id IS NULL OR v.outlet_id = p.outlet_id)
  AND v.created_at >= p.date_from
  AND v.created_at < p.date_to_exclusive
ORDER BY v.created_at DESC
LIMIT 50;

-- =============================================================================
-- 5) Reconcile success summary vs Sales Summary total_collected (direct only)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    NULL::uuid AS outlet_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
),
txn AS (
  SELECT COALESCE(SUM(COALESCE(sa.total_paid_amount, sa.total_amount, 0)), 0)::numeric AS total_collected
  FROM params p
  JOIN public.sales_activities sa ON sa.organization_id = p.organization_id
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND (p.outlet_id IS NULL OR sa.pos_outlet_id = p.outlet_id)
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
),
sales_summary AS (
  SELECT COALESCE(SUM(COALESCE(sa.total_paid_amount, sa.total_amount, 0)), 0)::numeric AS total_collected
  FROM params p
  JOIN public.sales_activities sa ON sa.organization_id = p.organization_id
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND (p.outlet_id IS NULL OR sa.pos_outlet_id = p.outlet_id)
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
)
SELECT
  t.total_collected AS transactions_total_collected,
  s.total_collected AS sales_summary_total_collected,
  ABS(t.total_collected - s.total_collected) AS collected_delta
FROM txn t, sales_summary s;
