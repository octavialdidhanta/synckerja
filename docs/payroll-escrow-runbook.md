# Payroll Statutory Escrow — Runbook

Auto-transfer PPh21 + BPJS karyawan dari sub-account **Utama** ke sub-account **Escrow** setelah payroll run fully paid via Xendit disburse.

## Prerequisites

1. Org Xendit enabled with at least **two active sub-accounts**: one **primary** (Utama) and one non-primary **escrow** target.
2. Migration `20260826120000_payroll_xendit_escrow.sql` applied.
3. Edge function `xendit-api` deployed with actions `getPayrollEscrowSettings`, `updatePayrollEscrowSettings`, `retryPayrollEscrowTransfer`.
4. Shared services deployed: `createXenditTransfer`, `executePayrollEscrowTransfer`, hook in `finalizePayrollDisbursement`.

## Enable escrow (per org)

1. Open **Payroll → Calculations** sidebar.
2. Toggle **Escrow PPh/BPJS** ON.
3. Select an **active non-primary** sub-account as escrow destination.
4. Save (requires Owner/Admin + MFA).
5. Confirm **Mark as Paid** is hidden for calculated runs.

Default: escrow **OFF** for all tenants until explicitly enabled.

## Happy path (sandbox)

1. Create/process a payroll run with PPh21 and BPJS line items on calculations.
2. Ensure primary CASH ≥ total pending THP **plus** statutory escrow amount (PPh + BPJS only, not internal recoveries).
3. **Disburse via Xendit** → MFA → wait for all calcs `paid`.
4. Run auto-finalizes to `paid` → escrow transfer triggers once.
5. Verify:
   - `payroll_xendit_escrow_transfers` row: `status = completed`, one row per run.
   - `payroll_audit_log`: `payroll_escrow_transfer`.
   - Primary CASH decreased; escrow sub-account CASH increased (after wallet sync).
   - UI: green banner + history panel breakdown on Payroll Calculations.

## Amount calculation

RPC `get_payroll_statutory_escrow_amounts(run_id)` sums from `payroll_items`:

- `item_type = 'tax'` OR `item_category IN ('pph21', 'bpjs_kesehatan', 'bpjs_pensiun')`
- Excludes pinjaman, seragam, training, penalty, etc.

## Failure: insufficient primary CASH

After THP disburse, primary CASH may be too low for escrow transfer.

- Run stays **`paid`** (THP already sent).
- Transfer row: `status = failed` with message.
- Audit: `payroll_escrow_transfer_failed`.
- UI: red/amber banner with **Retry transfer** (Owner/Admin + MFA).

**Recovery:** Top up primary CASH → click **Coba transfer lagi** on the run.

## Idempotency

- One transfer per `payroll_run_id` (unique constraint).
- Reference: `synckerja:{orgId}:payroll_escrow:{runId}`.
- Duplicate finalize/webhook does not double-transfer.

## Manual Mark as Paid

Blocked when escrow enabled (`require_xendit_disburse = true`):

- RPC `mark_payroll_run_paid` raises `payroll_escrow_requires_xendit_disburse`.
- UI hides Mark as Paid button.

## SQL checks

```sql
-- Settings
SELECT * FROM organization_payroll_escrow_settings WHERE organization_id = '<org_id>';

-- Transfer for run
SELECT * FROM payroll_xendit_escrow_transfers WHERE payroll_run_id = '<run_id>';

-- Preview amounts
SELECT get_payroll_statutory_escrow_amounts('<run_id>'::uuid);

-- Audit trail
SELECT action, metadata, created_at
FROM payroll_audit_log
WHERE payroll_run_id = '<run_id>'
  AND action LIKE 'payroll_escrow%'
ORDER BY created_at DESC;
```

## Out of scope (v1)

- Unpark / transfer back to primary
- Expense posting for THP or statutory items
- Employer BPJS share
- Brick payroll escrow path
- Auto-remittance to DJP/BPJS from escrow
