# Brick bank mutation edge functions

Deploy the **entire function folder** (not only `index.ts`):

```bash
supabase functions deploy brick-account-link
supabase functions deploy brick-bank-sync
```

Each folder includes local `brickApi.ts` and `brickAuth.ts` (required for Dashboard/CLI bundling).

## Secrets (Supabase Edge Function)

- `BRICK_CLIENT_ID` — Brick API client id
- `BRICK_CLIENT_SECRET` — Brick API client secret
- `BRICK_SANDBOX` — default `true` (use `https://sandbox.onebrick.io/v2`)
- `BRICK_API_BASE_URL` — optional override
- `BRICK_USE_MOCK=true` — dev without credentials (mock ledger rows)

## Functions

- `brick-account-link` — link / unlink bank account via Brick account validation
- `brick-bank-sync` — pull ledger transactions, upsert `bank_statement_lines`, run matching RPC

Rate limit: 1 sync per organization per 2 minutes (`organization_brick_sync_limits`).

## QA

1. Set `BRICK_USE_MOCK=true` on edge functions.
2. Link a bank account from `/incomes/transaction` → Bank Accounts tab.
3. Refresh mutations → mock credit/debit rows appear.
4. Create pending income + unchecked piutang payment with matching amount → suggested match.
5. Confirm match → `deposit_source = brick_mutasi`, piutang approved, ERP balance credited.

Validation SQL: `scripts/brick-bank-mutation-validation.sql`
