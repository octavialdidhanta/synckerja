# Brick Account Aggregation OAuth — QA (Sandbox)

## Prerequisites

1. Apply migration `20260713120000_brick_financial_aggregation.sql`
2. Supabase secrets:
   - `BRICK_CLIENT_ID`, `BRICK_CLIENT_SECRET`
   - `BRICK_TOKEN_ENCRYPTION_KEY` (64-char hex) — **wajib di production** (`BRICK_SANDBOX=false`); di sandbox default boleh kosong (pakai dev key internal)
   - Optional: `BRICK_AGGREGATION_CALLBACK_URL`, `APP_PUBLIC_ORIGIN` (production deploy URL)
   - Optional production widget: `BRICK_WIDGET_URL` dengan placeholder `{accessToken}`, `{redirect_url}`, `{state}`
3. Deploy edge functions:
   ```bash
   npx supabase functions deploy brick-bank-api --no-verify-jwt
   npx supabase functions deploy brick-oauth-start --no-verify-jwt
   npx supabase functions deploy brick-oauth-callback --no-verify-jwt
   ```

## Bank account (`/incomes/transaction` → Bank Accounts)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click link icon on active bank account | Redirect ke `/finance/brick-oauth/connect?state=...` (bukan `sandbox.onebrick.io/v1/index`) |
| 2 | Klik **Lanjutkan koneksi sandbox** | Redirect ke `brick-oauth-callback` lalu `/incomes/transaction?brick_oauth=success` |
| 3 | Wait for auto sync | `bank_statement_lines` rows; `bank_accounts.brick_link_status = linked` |
| 4 | Refresh mutations | New lines without duplicate `external_id` |
| 5 | Unlink | `brick_link_status = unlinked`, token connection `revoked` |

**Mock mode:** token `sandbox-mock-user-access-token` dari halaman connect otomatis memakai mock aggregation (tanpa `BRICK_AGGREGATION_USE_MOCK`). Opsional: set `BRICK_AGGREGATION_USE_MOCK=true` untuk mock eksplisit.

**Dev localhost:** `brick-oauth-start` menerima `app_origin` dari browser — tidak wajib set `APP_PUBLIC_ORIGIN` saat dev lokal.

## Credit card (`/expenses/debt`)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Configure **Impor otomatis Brick** — expense type + category | `organization_brick_import_settings` row saved |
| 2 | Create debt `Kartu Kredit`, link via Brick column | `debts.brick_link_status = linked` |
| 3 | Sync or post-OAuth auto sync | `debt_statement_lines` debit rows |
| 4 | Check expenses | `expenses.withdrawal_from_balance = debt_id`, `brick_debt_statement_line_id` set |
| 5 | Check plafon | `available_limit` decreased via expense trigger |
| 6 | Re-sync | No duplicate expenses (unique on `brick_debt_statement_line_id`) |

## Re-link after v1 validation

Accounts previously linked via GS account-validation are reset to `unlinked` with message to re-link via widget.

## Payment Process outgoing (`/expenses/payment-process` → Bank Mutations)

Apply migration `20260715120000_expense_bank_statement_outgoing.sql` (and run `scripts/expense-bank-statement-backfill.sql` for existing paid rows).

| Step | Action | Expected |
|------|--------|----------|
| 1 | Approve sandbox PR (`[APPROVALS_SANDBOX_v2]`) | Status `approved` on `/expenses/payment-process` |
| 2 | Process Payment — bank account funding | Debit row in Bank Mutations immediately (`origin = erp_expense`, description `Payment Process — …`) |
| 3 | Process Payment — Brick drawer or Xendit drawer | Debit row with gateway sublabel (`Brick drawer` / `Xendit drawer`) |
| 4 | Refresh all account mutations | Brick debits reconciled via `run_bank_expense_mutation_match_for_org`; ERP row kept (dedup hides duplicate Brick line) |
| 5 | Debit with linked expense | **Expense recorded** badge in Suggestion column (no confirm needed) |

```sql
-- Outgoing payment process lines
SELECT e.expense_name, e.amount, e.gateway_wallet_provider,
       bsl.direction, bsl.amount, bsl.origin, bsl.description
FROM expenses e
LEFT JOIN bank_statement_lines bsl ON bsl.expense_id = e.id
WHERE e.purchase_request_id IS NOT NULL
ORDER BY e.created_at DESC
LIMIT 20;
```

**Note:** Mock aggregation still injects a generic `Mock Outgoing Payment` (Rp 500.000) per linked bank account — this is separate from Payment Process amounts.

## SQL checks (org test)

```sql
-- Linked bank accounts (OAuth)
SELECT id, name, brick_link_status, brick_connection_id, brick_aggregated_account_id
FROM bank_accounts
WHERE organization_id = '<org-id>' AND brick_link_status = 'linked';

-- CC debt lines + imported expenses
SELECT dsl.*, e.id AS expense_id, e.expense_name, e.amount
FROM debt_statement_lines dsl
LEFT JOIN expenses e ON e.brick_debt_statement_line_id = dsl.id
WHERE dsl.organization_id = '<org-id>'
ORDER BY dsl.transaction_date DESC
LIMIT 20;
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `no Route matched` di `sandbox.onebrick.io/v1/index` | Sudah diganti app connect page; redeploy `brick-oauth-start` + refresh frontend |
| `BRICK_TOKEN_ENCRYPTION_KEY is not configured` | Set encryption key or enable mock flags |
| `failed_missing_settings` on CC import | Save default expense type/category on Debt page |
| `failed_insufficient_limit` | Increase plafon or reduce mock transaction amount |
| Brick balance still `—` | Ensure OAuth linked (`brick_connection_id` not null) and run sync |
