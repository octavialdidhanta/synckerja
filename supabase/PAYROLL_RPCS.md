# Payroll RPCs

Backend payroll calculation lives in PostgreSQL (SECURITY DEFINER). Frontend calls these via Supabase RPC.

## Deploy checklist

1. `npm run supabase:db:push`
2. `npm run supabase:db:push:payroll-verify`
3. Hard refresh app; test Process Payroll with `p_run_id` parameter

## Public RPCs

### `process_payroll_run(p_run_id uuid) → jsonb`

Processes all eligible employees. Logs `calculated` or `reprocessed` to `payroll_audit_log`.

### `calculate_payroll_run_totals(p_run_id uuid) → void`

Aggregates run totals.

### `mark_payroll_run_paid(p_run_id uuid, p_payment_reference text, p_payment_method text) → jsonb`

Marks all pending calculations paid; sets run `status = paid`. Idempotent if already paid.

### `log_payroll_bank_export(p_run_id uuid, p_row_count integer) → void`

Audit log for CSV bank export from client.

---

## Tax modes

Set `tax_configurations.calculation_mode`:

| Mode | Function |
|------|----------|
| `annualized` | `payroll_calculate_tax_by_method` → progressive annual PPh21 |
| `ter` | `payroll_calculate_pph21_ter_v2` → PP 58/2023 bracket lookup |

TER category mapping (`payroll_ter_category_for_employee`):

- `pegawai_tidak_tetap` / `freelancer` → C
- PTKP TK/0, TK/1 → A
- PTKP TK/2, TK/3, K/0 → B
- Other (K/1, K/2, K/3) → C

---

## THR

Org setting: `organizations.payroll_thr_calculation_mode`

- `manual_only` — use payroll components only
- `proportional` — auto THR on `is_bonus_period` runs
- `full_month_salary` — 1× basic salary

Auto THR skipped if employee already has THR allowance component for the period.

---

## Calculation order (per employee)

```
basic_prorated = basic_salary × prorate_ratio
THR (bonus period, if auto)
allowances     = components + overtime
gross_pay      = basic_prorated + allowances
deductions     = components + BPJS + penalties
tax            = TER or annualized by calculation_mode
take_home_pay  = gross - deductions - tax
payout_snapshot = bank fields at calc time
```

---

## Tables

- `employee_payroll_calculations` — totals, `tax_breakdown`, `calculation_details`, `payout_snapshot`
- `payroll_items` — line items
- `payroll_audit_log` — calculated, reprocessed, marked_paid, export_bank, payslip_generated
- `payroll_ter_brackets` — TER rates by category/year/income range

---

## TypeScript mirror

`src/shared/lib/payroll/` — keep SQL and TS in sync. Tests: `npm run test -- src/shared/lib/payroll`

Manual QA: [docs/payroll-qa-checklist.md](../docs/payroll-qa-checklist.md)

THR runbook: [docs/payroll-thr-runbook.md](../docs/payroll-thr-runbook.md)
