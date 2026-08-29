-- Served By sales report QA (read-only)
-- Supabase SQL Editor: edit values in each `params` CTE, then run one section at a time.

-- =============================================================================
-- 1) Server-level gross / net (expect one row per served_by_user_id, incl. null)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
),
sales AS (
  SELECT
    sa.served_by_user_id,
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
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
),
enriched AS (
  SELECT
    s.served_by_user_id,
    COALESCE(
      NULLIF(btrim(e.full_name), ''),
      NULLIF(btrim(pr.full_name), ''),
      NULLIF(split_part(au.email, '@', 1), ''),
      'Unknown Server'
    ) AS server_name,
    s.bill_net,
    s.discount_amount
  FROM sales s
  LEFT JOIN public.employees e
    ON e.user_id = s.served_by_user_id
   AND e.organization_id = (SELECT organization_id FROM params)
  LEFT JOIN public.profiles pr ON pr.user_id = s.served_by_user_id
  LEFT JOIN auth.users au ON au.id = s.served_by_user_id
)
SELECT
  CASE WHEN served_by_user_id IS NULL THEN 'Unknown Server' ELSE server_name END AS server_name,
  COUNT(*) AS transaction_count,
  SUM(bill_net + discount_amount)::numeric AS gross_sales,
  SUM(bill_net)::numeric AS net_sales
FROM enriched
GROUP BY served_by_user_id, CASE WHEN served_by_user_id IS NULL THEN 'Unknown Server' ELSE server_name END
ORDER BY net_sales DESC;

-- =============================================================================
-- 2) Sales type breakdown per server
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
),
sales AS (
  SELECT
    sa.served_by_user_id,
    sa.catalog_sales_type_id,
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
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
)
SELECT
  s.served_by_user_id,
  COALESCE(NULLIF(btrim(cst.name), ''), 'Unknown') AS sales_type_name,
  COUNT(*) AS transaction_count,
  SUM(s.bill_net + s.discount_amount)::numeric AS gross_sales,
  SUM(s.bill_net)::numeric AS net_sales
FROM sales s
LEFT JOIN public.catalog_sales_types cst ON cst.id = s.catalog_sales_type_id
GROUP BY s.served_by_user_id, s.catalog_sales_type_id, COALESCE(NULLIF(btrim(cst.name), ''), 'Unknown')
ORDER BY s.served_by_user_id NULLS FIRST, sales_type_name;

-- =============================================================================
-- 3) Reconcile sum net/gross vs sales summary
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
),
sales AS (
  SELECT
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
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
)
SELECT
  SUM(bill_net + discount_amount)::numeric AS served_by_gross_total,
  SUM(bill_net)::numeric AS served_by_net_total,
  COUNT(*)::bigint AS transaction_count
FROM sales;

-- Compare with pos_sales_summary_report gross_sales / net_sales for same params (via app or RPC).

-- =============================================================================
-- 4) Backfill coverage: served_by_user_id populated vs total checkouts
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
)
SELECT
  COUNT(*) FILTER (WHERE sa.served_by_user_id IS NOT NULL) AS with_served_by,
  COUNT(*) FILTER (WHERE sa.served_by_user_id IS NULL) AS unknown_server,
  COUNT(*) AS total_checkouts
FROM params p
JOIN public.sales_activities sa ON sa.organization_id = p.organization_id
WHERE sa.activity_type = 'Store Checkout'
  AND sa.status = 'Converted'
  AND COALESCE(sa.refund_status, 'none') = 'none'
  AND sa.created_at >= p.date_from
  AND sa.created_at < p.date_to_exclusive;

-- =============================================================================
-- 5) Backfill detail: session-linked vs no session (after waiter_id + opened_by)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
)
SELECT
  COUNT(*) FILTER (WHERE sa.served_by_user_id IS NOT NULL) AS with_served_by,
  COUNT(*) FILTER (
    WHERE sa.served_by_user_id IS NULL AND pts.id IS NOT NULL
  ) AS unknown_with_session_link,
  COUNT(*) FILTER (
    WHERE sa.served_by_user_id IS NULL AND pts.id IS NULL
  ) AS unknown_no_session_link,
  COUNT(*) AS total_checkouts
FROM params p
JOIN public.sales_activities sa ON sa.organization_id = p.organization_id
LEFT JOIN public.pos_table_sessions pts ON pts.sales_activity_id = sa.id
WHERE sa.activity_type = 'Store Checkout'
  AND sa.status = 'Converted'
  AND COALESCE(sa.refund_status, 'none') = 'none'
  AND sa.created_at >= p.date_from
  AND sa.created_at < p.date_to_exclusive;

-- =============================================================================
-- 6) Heuristic backfill preview (in-session table match; run before/after phase 3)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
),
unknown AS (
  SELECT sa.id, sa.organization_id, sa.pos_table_id, sa.pos_outlet_id, sa.table_number, sa.created_at
  FROM params p
  JOIN public.sales_activities sa ON sa.organization_id = p.organization_id
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND sa.served_by_user_id IS NULL
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
    AND NOT EXISTS (
      SELECT 1 FROM public.pos_table_sessions pts0 WHERE pts0.sales_activity_id = sa.id
    )
),
ranked AS (
  SELECT
    u.id AS activity_id,
    pts.id AS session_id,
    pts.status AS session_status,
    COALESCE(pts.waiter_id, pts.opened_by) AS server_user_id,
    row_number() OVER (PARTITION BY u.id ORDER BY pts.seated_at DESC) AS rn
  FROM unknown u
  JOIN public.pos_table_sessions pts
    ON pts.organization_id = u.organization_id
   AND pts.outlet_id = u.pos_outlet_id
   AND COALESCE(pts.waiter_id, pts.opened_by) IS NOT NULL
   AND pts.status IN ('paid', 'open', 'cancelled')
   AND u.created_at >= pts.seated_at
   AND (pts.closed_at IS NULL OR u.created_at <= pts.closed_at + interval '2 minutes')
   AND (
     (u.pos_table_id IS NOT NULL AND pts.pos_table_id = u.pos_table_id)
     OR (
       u.pos_table_id IS NULL
       AND u.table_number IS NOT NULL
       AND lower(btrim(pts.table_name)) = lower(btrim(u.table_number))
     )
   )
)
SELECT activity_id, session_id, session_status, server_user_id
FROM ranked
WHERE rn = 1
ORDER BY activity_id;
