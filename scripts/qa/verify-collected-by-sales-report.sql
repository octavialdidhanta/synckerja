-- Collected By sales report QA (read-only)
-- Supabase SQL Editor: edit values in each `params` CTE, then run one section at a time.

-- =============================================================================
-- 1) Staff-level collections (expect one row per created_by)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
),
sales AS (
  SELECT
    sa.created_by,
    COALESCE(sa.total_paid_amount, sa.total_amount, 0)::numeric AS collected
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
    s.created_by,
    COALESCE(
      NULLIF(btrim(e.full_name), ''),
      NULLIF(btrim(pr.full_name), ''),
      NULLIF(split_part(au.email, '@', 1), ''),
      'Unknown Staff'
    ) AS collector_name,
    s.collected
  FROM sales s
  LEFT JOIN public.employees e
    ON e.user_id = s.created_by
   AND e.organization_id = (SELECT organization_id FROM params)
  LEFT JOIN public.profiles pr ON pr.user_id = s.created_by
  LEFT JOIN auth.users au ON au.id = s.created_by
)
SELECT
  collector_name,
  COUNT(*) AS transaction_count,
  SUM(collected)::numeric AS total_collected
FROM enriched
GROUP BY created_by, collector_name
ORDER BY total_collected DESC;

-- =============================================================================
-- 2) Cash vs non-cash per staff
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
),
sales AS (
  SELECT
    sa.created_by,
    sa.payment_method,
    sa.payment_channel_id,
    COALESCE(sa.total_paid_amount, sa.total_amount, 0)::numeric AS collected
  FROM params p
  JOIN public.sales_activities sa ON sa.organization_id = p.organization_id
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
),
resolved AS (
  SELECT
    s.created_by,
    CASE
      WHEN COALESCE(
        ch.category,
        CASE lower(COALESCE(s.payment_method, ''))
          WHEN 'cash' THEN 'cash'
          ELSE 'other'
        END
      ) = 'cash' THEN 'cash'
      ELSE 'non_cash'
    END AS payment_kind,
    s.collected
  FROM sales s
  LEFT JOIN public.pos_payment_method_channels ch ON ch.id = s.payment_channel_id
)
SELECT
  created_by,
  payment_kind,
  COUNT(*) AS transaction_count,
  SUM(collected)::numeric AS total_collected
FROM resolved
GROUP BY created_by, payment_kind
ORDER BY created_by NULLS FIRST, payment_kind;

-- =============================================================================
-- 3) Reconcile staff grand total vs Sales Summary total_collected
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
),
staff_total AS (
  SELECT COALESCE(SUM(COALESCE(sa.total_paid_amount, sa.total_amount, 0)), 0)::numeric AS total
  FROM params p
  JOIN public.sales_activities sa ON sa.organization_id = p.organization_id
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
),
payment_methods_total AS (
  SELECT COALESCE(SUM(COALESCE(sa.total_paid_amount, sa.total_amount, 0)), 0)::numeric AS total
  FROM params p
  JOIN public.sales_activities sa ON sa.organization_id = p.organization_id
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
)
SELECT
  staff_total.total AS collected_by_grand_total,
  payment_methods_total.total AS payment_methods_grand_total,
  staff_total.total - payment_methods_total.total AS delta
FROM staff_total, payment_methods_total;
