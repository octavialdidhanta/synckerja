-- Gratuity sales checkout QA (read-only)
-- Supabase SQL Editor: edit values in each `params` CTE below, then run one section at a time.

-- =============================================================================
-- 1) Sales type ↔ gratuity links (expect Dine in → Service Fee)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id
)
SELECT
  st.name AS sales_type_name,
  cg.name AS gratuity_name,
  cg.amount_percent,
  cstg.created_at AS linked_at
FROM params p
JOIN public.catalog_sales_type_gratuities cstg ON TRUE
JOIN public.catalog_sales_types st ON st.id = cstg.sales_type_id
JOIN public.catalog_gratuities cg ON cg.id = cstg.gratuity_id
WHERE st.organization_id = p.organization_id
ORDER BY st.name, cg.name;

-- =============================================================================
-- 2) Live checkout gratuity rows (expect is_backfill_estimate = false after new POS checkout)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
)
SELECT
  sa.id AS sales_activity_id,
  sa.created_at,
  po.name AS outlet_name,
  st.name AS sales_type_name,
  sacg.gratuity_name,
  sacg.amount_percent,
  sacg.rate_label,
  sacg.amount_rp,
  sacg.catalog_gratuity_id,
  sacg.is_backfill_estimate
FROM params p
JOIN public.sales_activity_checkout_gratuities sacg
  ON sacg.organization_id = p.organization_id
JOIN public.sales_activities sa ON sa.id = sacg.sales_activity_id
LEFT JOIN public.pos_outlets po ON po.id = sa.pos_outlet_id
LEFT JOIN public.catalog_sales_types st ON st.id = sa.catalog_sales_type_id
WHERE sa.activity_type = 'Store Checkout'
  AND sa.status = 'Converted'
  AND sa.created_at >= p.date_from
  AND sa.created_at < p.date_to_exclusive
ORDER BY sa.created_at DESC;

-- =============================================================================
-- 3) Reconcile breakdown total vs Sales Summary gratuity (no RPC auth required)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
),
summary AS (
  SELECT COALESCE(SUM(sa.checkout_gratuity_amount), 0)::numeric AS total
  FROM params p
  JOIN public.sales_activities sa ON sa.organization_id = p.organization_id
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
    AND COALESCE(sa.checkout_gratuity_amount, 0) > 0
),
breakdown AS (
  SELECT COALESCE(SUM(sacg.amount_rp), 0)::numeric AS total
  FROM params p
  JOIN public.sales_activity_checkout_gratuities sacg
    ON sacg.organization_id = p.organization_id
  JOIN public.sales_activities sa ON sa.id = sacg.sales_activity_id
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND sa.created_at >= p.date_from
    AND sa.created_at < p.date_to_exclusive
)
SELECT
  summary.total AS sales_summary_gratuity_total,
  breakdown.total AS gratuity_breakdown_total,
  summary.total - breakdown.total AS delta
FROM summary, breakdown;

-- =============================================================================
-- 4) Breakdown by gratuity name/rate (expect Service Fee / 10% for new checkouts)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
    timestamptz '2026-01-01' AS date_from,
    timestamptz '2027-01-01' AS date_to_exclusive
)
SELECT
  sacg.gratuity_name,
  sacg.rate_label,
  sacg.is_backfill_estimate,
  COUNT(*) AS checkout_count,
  SUM(sacg.amount_rp)::numeric AS gratuity_collected
FROM params p
JOIN public.sales_activity_checkout_gratuities sacg
  ON sacg.organization_id = p.organization_id
JOIN public.sales_activities sa ON sa.id = sacg.sales_activity_id
WHERE sa.activity_type = 'Store Checkout'
  AND sa.status = 'Converted'
  AND sa.created_at >= p.date_from
  AND sa.created_at < p.date_to_exclusive
GROUP BY sacg.gratuity_name, sacg.rate_label, sacg.is_backfill_estimate
ORDER BY gratuity_collected DESC;

-- =============================================================================
-- Optional: reconcile via pos_gratuity_sales_report RPC (requires authenticated session)
-- Run from app context or replace auth.uid() bypass is not available in SQL Editor.
-- =============================================================================
-- WITH params AS (
--   SELECT
--     '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id,
--     timestamptz '2026-01-01' AS date_from,
--     timestamptz '2026-12-31 23:59:59+07' AS date_to
-- )
-- SELECT COALESCE(SUM(row.gratuity_collected), 0)::numeric AS gratuity_report_total
-- FROM params p
-- CROSS JOIN LATERAL public.pos_gratuity_sales_report(
--   p.organization_id,
--   NULL,
--   p.date_from,
--   p.date_to
-- ) AS row;
