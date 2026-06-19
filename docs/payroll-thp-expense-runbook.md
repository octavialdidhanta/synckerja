# Payroll THP → Expense Dashboard — Runbook

Auto-post **one expense row per payroll run** (sum of `take_home_pay` for paid calculations) after the run is fully paid via **Xendit disburse**. Rows appear on `/expenses/dashboard` — there is **no** `/expenses/payroll` route.

## Prerequisites

1. Migration `20260827120000_payroll_thp_expense.sql` applied.
2. Org has expense type **Fixed Expenses** and category **Gaji Karyawan Tetap** (org-specific or template).
3. Edge function `xendit-api` deployed with `getPayrollExpenseSettings`, `updatePayrollExpenseSettings`.
4. Shared service `executePayrollThpExpensePost` hooked in `finalizePayrollDisbursement` **after** escrow transfer attempt.

## Enable (per org, default OFF)

1. Open **Payroll → Calculations** sidebar.
2. Toggle **Post THP ke Expense** ON.
3. Save (Owner/Admin + MFA).

## Happy path (sandbox)

1. Enable post THP in payroll sidebar.
2. Process and **Disburse via Xendit** a run until all calculations are `paid`.
3. Run finalizes → escrow (if enabled) → THP expense post runs once.
4. Verify:
   - `expenses` row with `payroll_run_id` = run id, `gateway_wallet_provider = xendit`.
   - `amount` ≈ SUM(`take_home_pay`) for paid calcs (not total deductions).
   - `department` = Finance; `create_date` = period `pay_date`.
   - `transaction_reference` = `synckerja:{orgId}:payroll_expense:{runId}`.
   - `payroll_audit_log`: `payroll_expense_posted`.
   - Expense Dashboard: row visible, **Payroll** chip/filter, link back to payroll run.
   - Gateway wallet **not** double-debited (disburse already moved funds).

## Idempotency

- Unique `expenses.payroll_run_id` — duplicate webhook/finalize does not create a second row.
- RPC returns `{ skipped: true, reason: 'already_posted' }` if expense exists.

## Failure modes

| Symptom | Cause | Mitigation |
|---------|-------|------------|
| No expense, red banner | Missing type/category | Create Fixed Expenses + Gaji Karyawan Tetap in expense settings; fix is forward-only (no retro backfill v1) |
| No expense, no banner | Settings OFF | Enable toggle and disburse future runs |
| No expense | Run not fully paid / no Xendit disburse | Complete disburse; manual mark paid does not post (Xendit only v1) |
| Cannot delete/edit row | By design | Payroll-linked expenses are read-only |

## SQL checks

```sql
SELECT * FROM organization_payroll_expense_settings WHERE organization_id = '<org_id>';
SELECT id, amount, payroll_run_id, gateway_wallet_provider, transaction_reference
FROM expenses WHERE payroll_run_id = '<run_id>';
SELECT action, metadata, created_at FROM payroll_audit_log
WHERE payroll_run_id = '<run_id>' AND action LIKE 'payroll_expense%'
ORDER BY created_at DESC;
```

## Out of scope v1

- Brick payroll expense post
- Per-employee expense rows
- Retroactive backfill
- PPh/BPJS / statutory as separate expenses
- Route `/expenses/payroll`
