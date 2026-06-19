-- =============================================================================
-- Payroll Paid → Escrow → THP Expense — SQL verification (self-contained)
-- Setiap SECTION = satu query lengkap. Copy-paste & Run (tanpa temp table).
-- Edit org_id / focus_run_id di CTE "p" di awal setiap section.
-- PASS / FAIL / WARN / N/A = assert logika bisnis.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1 — Settings escrow + expense
-- -----------------------------------------------------------------------------
WITH p AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS org_id,
    'f1361125-02af-4c14-a67b-0f8444e9b368'::uuid AS focus_run_id
)
SELECT
  p.org_id,
  COALESCE(es.is_enabled, false) AS escrow_enabled,
  es.escrow_sub_account_row_id,
  COALESCE(xs.is_enabled, false) AS expense_post_enabled,
  COALESCE(xs.expense_type_name, 'Fixed Expenses') AS expense_type_name,
  COALESCE(xs.expense_category_name, 'Gaji Karyawan Tetap') AS expense_category_name
FROM p
LEFT JOIN organization_payroll_escrow_settings es ON es.organization_id = p.org_id
LEFT JOIN organization_payroll_expense_settings xs ON xs.organization_id = p.org_id;


-- -----------------------------------------------------------------------------
-- SECTION 2 — Master expense classification
-- -----------------------------------------------------------------------------
WITH p AS (
  SELECT '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS org_id
)
SELECT 'expense_type' AS check_kind, et.id, et.name, et.organization_id, et.is_active
FROM expense_types et
CROSS JOIN p
WHERE lower(trim(et.name)) = 'fixed expenses'
  AND (et.organization_id = p.org_id OR et.organization_id IS NULL)
  AND COALESCE(et.is_active, true)
UNION ALL
SELECT 'expense_category', ec.id, ec.name, ec.organization_id, ec.is_active
FROM expense_categories ec
CROSS JOIN p
WHERE lower(trim(ec.name)) = 'gaji karyawan tetap'
  AND (ec.organization_id = p.org_id OR ec.organization_id IS NULL)
  AND COALESCE(ec.is_active, true);


-- -----------------------------------------------------------------------------
-- SECTION 3 — Assertion matrix (inti logika) — September: set focus_run_id
-- -----------------------------------------------------------------------------
WITH p AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS org_id,
    'f1361125-02af-4c14-a67b-0f8444e9b368'::uuid AS focus_run_id  -- NULL = semua run org
),
org_settings AS (
  SELECT
    p.org_id,
    COALESCE(es.is_enabled, false) AS escrow_enabled,
    COALESCE(xs.is_enabled, false) AS expense_post_enabled
  FROM p
  LEFT JOIN organization_payroll_escrow_settings es ON es.organization_id = p.org_id
  LEFT JOIN organization_payroll_expense_settings xs ON xs.organization_id = p.org_id
),
run_calc AS (
  SELECT
    pr.id AS run_id,
    pr.run_name,
    pr.status AS run_status,
    pr.paid_at,
    COUNT(c.id) AS calc_total,
    COUNT(c.id) FILTER (WHERE c.payment_status = 'paid') AS calc_paid,
    COUNT(c.id) FILTER (WHERE c.payment_status IS DISTINCT FROM 'paid') AS calc_unpaid,
    COALESCE(SUM(c.take_home_pay) FILTER (WHERE c.payment_status = 'paid'), 0) AS thp_paid_sum,
    COALESCE(SUM(c.total_deductions) FILTER (WHERE c.payment_status = 'paid'), 0) AS deductions_paid_sum
  FROM payroll_runs pr
  CROSS JOIN p
  LEFT JOIN employee_payroll_calculations c ON c.payroll_run_id = pr.id
  WHERE pr.organization_id = p.org_id
    AND (p.focus_run_id IS NULL OR pr.id = p.focus_run_id)
  GROUP BY pr.id, pr.run_name, pr.status, pr.paid_at
),
xendit AS (
  SELECT
    c.payroll_run_id AS run_id,
    COUNT(xd.id) FILTER (WHERE xd.status = 'completed') AS xendit_completed,
    COUNT(xd.id) FILTER (WHERE xd.status IN ('pending', 'processing')) AS xendit_inflight,
    COUNT(xd.id) FILTER (WHERE xd.status = 'failed') AS xendit_failed
  FROM employee_payroll_calculations c
  JOIN xendit_disbursements xd
    ON xd.source_type = 'payroll_calculation' AND xd.source_id = c.id
  GROUP BY c.payroll_run_id
),
statutory AS (
  SELECT
    c.payroll_run_id AS run_id,
    COALESCE(SUM(pi.calculated_amount) FILTER (
      WHERE pi.item_type = 'tax' OR lower(COALESCE(pi.item_category, '')) = 'pph21'
    ), 0) AS statutory_pph21,
    COALESCE(SUM(pi.calculated_amount) FILTER (
      WHERE lower(COALESCE(pi.item_category, '')) = 'bpjs_kesehatan'
    ), 0) AS statutory_bpjs_kes,
    COALESCE(SUM(pi.calculated_amount) FILTER (
      WHERE lower(COALESCE(pi.item_category, '')) = 'bpjs_pensiun'
    ), 0) AS statutory_bpjs_pen
  FROM employee_payroll_calculations c
  JOIN payroll_items pi ON pi.payroll_calculation_id = c.id
  GROUP BY c.payroll_run_id
),
escrow AS (
  SELECT
    et.payroll_run_id AS run_id,
    et.id AS escrow_transfer_id,
    et.status AS escrow_status,
    et.amount_total AS escrow_amount,
    et.failure_message AS escrow_failure
  FROM payroll_xendit_escrow_transfers et
),
expense AS (
  SELECT
    e.payroll_run_id AS run_id,
    e.id AS expense_id,
    e.amount AS expense_amount,
    e.department AS expense_department,
    e.gateway_wallet_provider,
    e.transaction_reference
  FROM expenses e
  WHERE e.payroll_run_id IS NOT NULL
),
audit AS (
  SELECT
    pal.payroll_run_id AS run_id,
    MAX(pal.created_at) FILTER (WHERE pal.action = 'payroll_escrow_transfer') AS escrow_ok_at,
    MAX(pal.created_at) FILTER (WHERE pal.action = 'payroll_escrow_transfer_failed') AS escrow_fail_at,
    MAX(pal.created_at) FILTER (WHERE pal.action = 'payroll_escrow_transfer_skipped') AS escrow_skip_at,
    MAX(pal.created_at) FILTER (WHERE pal.action = 'payroll_expense_posted') AS expense_ok_at,
    MAX(pal.created_at) FILTER (WHERE pal.action = 'payroll_expense_post_failed') AS expense_fail_at,
    MAX(pal.created_at) FILTER (WHERE pal.action = 'payroll_expense_post_skipped') AS expense_skip_at,
    MAX(pal.created_at) FILTER (WHERE pal.action = 'xendit_disburse_batch') AS xendit_batch_at,
    MAX(pal.created_at) FILTER (WHERE pal.action = 'marked_paid') AS marked_paid_at
  FROM payroll_audit_log pal
  GROUP BY pal.payroll_run_id
),
joined AS (
  SELECT
    rc.*,
    os.escrow_enabled,
    os.expense_post_enabled,
    COALESCE(x.xendit_completed, 0) AS xendit_completed,
    COALESCE(st.statutory_pph21, 0) + COALESCE(st.statutory_bpjs_kes, 0) + COALESCE(st.statutory_bpjs_pen, 0) AS statutory_total,
    e.escrow_transfer_id,
    e.escrow_status,
    e.escrow_amount,
    ex.expense_id,
    ex.expense_amount,
    ex.expense_department,
    ex.gateway_wallet_provider,
    ex.transaction_reference,
    a.escrow_skip_at,
    a.expense_ok_at,
    a.expense_fail_at,
    a.expense_skip_at,
    a.marked_paid_at,
    os.org_id
  FROM run_calc rc
  CROSS JOIN org_settings os
  LEFT JOIN xendit x ON x.run_id = rc.run_id
  LEFT JOIN statutory st ON st.run_id = rc.run_id
  LEFT JOIN escrow e ON e.run_id = rc.run_id
  LEFT JOIN expense ex ON ex.run_id = rc.run_id
  LEFT JOIN audit a ON a.run_id = rc.run_id
)
SELECT
  run_id,
  run_name,
  run_status,
  escrow_enabled,
  expense_post_enabled,
  thp_paid_sum,
  xendit_completed,
  statutory_total,
  escrow_status,
  escrow_amount,
  expense_id,
  expense_amount,
  CASE WHEN run_status = 'paid' AND calc_unpaid = 0 AND calc_paid > 0 THEN 'PASS'
       WHEN run_status = 'paid' THEN 'FAIL' ELSE 'N/A' END AS assert_run_fully_paid,
  CASE WHEN run_status IS DISTINCT FROM 'paid' THEN 'N/A'
       WHEN xendit_completed > 0 THEN 'PASS'
       WHEN marked_paid_at IS NOT NULL THEN 'WARN_MANUAL_MARK_PAID'
       ELSE 'FAIL_NO_XENDIT' END AS assert_xendit_path,
  CASE WHEN NOT escrow_enabled OR run_status IS DISTINCT FROM 'paid' OR xendit_completed = 0 THEN 'N/A'
       WHEN statutory_total <= 0 AND (escrow_transfer_id IS NULL OR escrow_status = 'skipped') THEN 'PASS'
       WHEN escrow_transfer_id IS NOT NULL OR escrow_skip_at IS NOT NULL THEN 'PASS'
       ELSE 'FAIL_MISSING_ESCROW' END AS assert_escrow_row,
  CASE WHEN escrow_transfer_id IS NULL OR escrow_status IS DISTINCT FROM 'completed' THEN 'N/A'
       WHEN abs(COALESCE(escrow_amount, 0) - statutory_total) <= 1 THEN 'PASS'
       ELSE 'FAIL_ESCROW_AMOUNT' END AS assert_escrow_amount,
  CASE WHEN NOT expense_post_enabled OR run_status IS DISTINCT FROM 'paid' OR xendit_completed = 0 THEN 'N/A'
       WHEN expense_id IS NOT NULL THEN 'PASS'
       WHEN expense_fail_at IS NOT NULL THEN 'FAIL_CLASSIFICATION'
       WHEN expense_skip_at IS NOT NULL THEN 'WARN_SKIPPED'
       WHEN expense_id IS NULL AND expense_ok_at IS NULL THEN 'WARN_NOT_POSTED_YET'
       ELSE 'FAIL_MISSING_EXPENSE' END AS assert_expense_row,
  CASE WHEN expense_id IS NULL THEN 'N/A'
       WHEN abs(expense_amount - thp_paid_sum) <= 1 THEN 'PASS'
       ELSE 'FAIL_THP_MISMATCH' END AS assert_expense_thp_amount,
  CASE WHEN expense_id IS NULL THEN 'N/A'
       WHEN abs(expense_amount - deductions_paid_sum) > 1 THEN 'PASS'
       ELSE 'FAIL_LIKE_DEDUCTIONS' END AS assert_not_deductions,
  CASE WHEN expense_id IS NULL THEN 'N/A'
       WHEN gateway_wallet_provider = 'xendit' AND expense_department = 'Finance'
        AND transaction_reference = format('synckerja:%s:payroll_expense:%s', org_id, run_id) THEN 'PASS'
       ELSE 'FAIL_METADATA' END AS assert_expense_metadata
FROM joined
ORDER BY paid_at DESC NULLS LAST;


-- -----------------------------------------------------------------------------
-- SECTION 4 — Quick check September
-- -----------------------------------------------------------------------------
WITH p AS (
  SELECT 'f1361125-02af-4c14-a67b-0f8444e9b368'::uuid AS run_id
)
SELECT
  pr.run_name,
  e.amount AS expense_amount,
  (SELECT SUM(c.take_home_pay) FROM employee_payroll_calculations c
   WHERE c.payroll_run_id = pr.id AND c.payment_status = 'paid') AS expected_thp,
  CASE WHEN e.id IS NULL THEN 'N/A'
       WHEN abs(e.amount - (SELECT SUM(c.take_home_pay) FROM employee_payroll_calculations c
            WHERE c.payroll_run_id = pr.id AND c.payment_status = 'paid')) <= 1 THEN 'PASS'
       ELSE 'FAIL' END AS thp_match,
  et.status AS escrow_status,
  et.amount_total AS escrow_amount
FROM p
JOIN payroll_runs pr ON pr.id = p.run_id
LEFT JOIN expenses e ON e.payroll_run_id = pr.id
LEFT JOIN payroll_xendit_escrow_transfers et ON et.payroll_run_id = pr.id;
