# Brick Disbursement v1 — Sandbox QA checklist

## Prerequisites

1. Migration `20260629140000_brick_disbursement_core.sql` applied.
2. Secrets: `BRICK_CLIENT_ID`, `BRICK_CLIENT_SECRET`, `BRICK_CALLBACK_SECRET`.
3. Brick Dashboard: **Disbursement Callback URL** = same as VA:
   `https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/brick-bank-api`
4. At least one bank account with `brick_link_status = linked` (prefer omnichannel income flag).

## Seed data

```sql
-- scripts/brick-disbursement-sandbox-seed.sql
```

## Vendor disbursement (purchase_request)

1. Expenses → Payment process → approved vendor request.
2. Click **Pay via Brick** (alongside Xendit).
3. Enter Mandiri/BRI/BCA test account (Brick sandbox docs).
4. Submit → `brick_disbursements.status = processing`.
5. Wait for callback or use **Refresh mutasi** (sync polls disbursements).
6. On `completed`: `purchase_requests.payment_status = paid`, debit `bank_statement_lines`.

## Debt disbursement

1. Debt → payment history → **Disburse via Brick** on unpaid payment row.
2. Same callback / poll / debit mutasi flow.
3. `debt_payments.transaction_reference` set on completed.

## Payroll batch

1. Payroll run status `calculated` → **Disburse via Brick**.
2. Each pending calc gets individual disbursement row.
3. On completed: `employee_payroll_calculations.payment_status = paid`.

## Validation SQL

```sql
-- scripts/brick-disbursement-e2e-validation.sql
```

## Force-complete (callback delayed)

```sql
-- scripts/brick-disbursement-force-complete-qa.sql
```

## Sandbox test accounts

Use Mandiri/BRI/BCA sandbox beneficiary accounts from Brick Disbursement Quick Start.
Account validation runs before every disbursement API call.

## Rate limit

1 disbursement request per organization per 60 seconds (`organization_brick_sync_limits.last_disburse_requested_at`).
