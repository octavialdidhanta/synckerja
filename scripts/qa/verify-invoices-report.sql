-- Invoices report QA (read-only)
-- Supabase SQL Editor: edit values in each `params` CTE, then run one section at a time.
-- NOTE: Do NOT call pos_invoices_report RPC here — it requires auth.uid() / JWT context.

-- =============================================================================
-- 1) Status counts (mirrors pos_invoices_report eligible + display_status)
-- =============================================================================
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id
),
eligible AS (
  SELECT
    sa.id,
    sa.invoice_cancelled_at,
    sa.invoice_due_date,
    sa.payment_status,
    COALESCE(sa.total_amount, 0)::numeric AS total_amount,
    COALESCE(sa.total_paid_amount, 0)::numeric AS total_paid_amount
  FROM public.sales_activities sa
  CROSS JOIN params p
  WHERE sa.organization_id = p.organization_id
    AND lower(btrim(sa.activity_type)) <> 'store checkout'
    AND COALESCE(sa.total_amount, 0) > 0
    AND sa.invoice_number IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.sales_activity_items sai WHERE sai.sales_activity_id = sa.id
    )
),
enriched AS (
  SELECT
    e.*,
    public.pos_invoice_display_status(
      e.invoice_cancelled_at,
      e.invoice_due_date,
      e.payment_status,
      e.total_amount,
      e.total_paid_amount
    ) AS display_status
  FROM eligible e
)
SELECT
  COUNT(*) AS invoice_count,
  COUNT(*) FILTER (WHERE display_status = 'unpaid') AS unpaid_count,
  COUNT(*) FILTER (WHERE display_status = 'partial') AS partial_count,
  COUNT(*) FILTER (WHERE display_status = 'paid') AS paid_count,
  COUNT(*) FILTER (WHERE display_status = 'overdue') AS overdue_count,
  COUNT(*) FILTER (WHERE display_status = 'cancelled') AS cancelled_count
FROM enriched;

-- =============================================================================
-- 2) Payment reconcile: sum payments vs total_paid_amount
-- =============================================================================
WITH params AS (
  SELECT '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id
),
eligible AS (
  SELECT sa.id, COALESCE(sa.total_paid_amount, 0)::numeric AS total_paid_amount
  FROM public.sales_activities sa
  CROSS JOIN params p
  WHERE sa.organization_id = p.organization_id
    AND lower(btrim(sa.activity_type)) <> 'store checkout'
    AND COALESCE(sa.total_amount, 0) > 0
    AND sa.invoice_number IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.sales_activity_items sai WHERE sai.sales_activity_id = sa.id
    )
),
pay_sums AS (
  SELECT
    sap.sales_activity_id,
    SUM(COALESCE(sap.payment_amount, 0))::numeric AS sum_payments
  FROM public.sales_activity_payments sap
  INNER JOIN eligible e ON e.id = sap.sales_activity_id
  GROUP BY sap.sales_activity_id
)
SELECT
  COUNT(*) AS activities_checked,
  SUM(ABS(e.total_paid_amount - COALESCE(p.sum_payments, 0))) AS total_paid_delta
FROM eligible e
LEFT JOIN pay_sums p ON p.sales_activity_id = e.id;

-- =============================================================================
-- 3) Sample overdue invoices
-- =============================================================================
WITH params AS (
  SELECT '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS organization_id
)
SELECT
  sa.invoice_number,
  sa.client_name,
  sa.invoice_due_date,
  sa.total_amount,
  sa.total_paid_amount,
  public.pos_invoice_display_status(
    sa.invoice_cancelled_at,
    sa.invoice_due_date,
    sa.payment_status,
    COALESCE(sa.total_amount, 0),
    COALESCE(sa.total_paid_amount, 0)
  ) AS display_status
FROM public.sales_activities sa
CROSS JOIN params p
WHERE sa.organization_id = p.organization_id
  AND sa.invoice_number IS NOT NULL
  AND public.pos_invoice_display_status(
    sa.invoice_cancelled_at,
    sa.invoice_due_date,
    sa.payment_status,
    COALESCE(sa.total_amount, 0),
    COALESCE(sa.total_paid_amount, 0)
  ) = 'overdue'
ORDER BY sa.invoice_due_date ASC
LIMIT 20;
