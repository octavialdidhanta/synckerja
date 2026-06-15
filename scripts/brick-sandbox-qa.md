# Brick VA v2 — Sandbox QA checklist

## Prerequisites

1. Migration `20260629120000_brick_va_webhook_core.sql` applied.
2. Secrets: `BRICK_CLIENT_ID`, `BRICK_CLIENT_SECRET`, `BRICK_CALLBACK_SECRET`.
3. Brick Dashboard: Virtual Account Callback URL → `https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/brick-bank-api`.
4. At least one bank account linked (`brick_link_status = linked`) for Mandiri or BRI.

## Disbursement (Send Money)

1. Link bank account + set omnichannel income source if needed.
2. Brick Dashboard: **Disbursement Callback URL** = same URL as VA (`brick-bank-api`).
3. Vendor payment / debt / payroll: use **Pay via Brick** / **Disburse via Brick** buttons.
4. Callback `data.type = disbursement` → updates `brick_disbursements`, source ERP rows, debit mutasi.
5. Sync (`Refresh mutasi`) polls pending disbursements before ledger pull.
6. QA: `scripts/brick-disbursement-sandbox-seed.sql`, `brick-disbursement-e2e-validation.sql`, `brick-disbursement-force-complete-qa.sql`, `brick-disbursement-sandbox-qa.md`.

## E2E flow (Synckerja VA)

1. Open Piutang → Koleksi via VA drawer.
2. Generate **Brick VA** (Mandiri) for an unpaid installment.
3. Pay VA in Brick sandbox (or wait for callback after manual payment).
4. **Without manual refresh**: webhook should insert `bank_statement_lines` and run match.
5. On `completed`: piutang `transfer_verification_status = approved`, income `deposit_source = brick_va`.

## Fallback when webhook delayed

1. Click **Refresh mutasi** on bank accounts / mutations panel (sync polls pending VA).
2. Or in drawer: **Cek status pembayaran** (`getVaStatus` with `processUpdate`).

## Simulate API (optional — often 502 in sandbox)

```powershell
# See scripts/brick-simulate-va-completed.ps1
```

Prefer webhook + status poll over simulate.

## Validation SQL

Run `scripts/brick-e2e-validation.sql` and new sections in `scripts/brick-bank-mutation-validation.sql`.

## Gateway wallet balance (Income Dashboard)

1. Apply migration `20260615120000_organization_gateway_wallets.sql`.
2. Deploy `brick-bank-api` with action `getBalance`.
3. Test API langsung: `scripts/brick-get-balance-test.ps1` (butuh `BRICK_CLIENT_ID` / `BRICK_CLIENT_SECRET` Testing).
4. Org with `brick_link_status = linked` → **Refresh mutasi** or **Sync saldo** on dashboard triggers wallet sync.
4. Row in `organization_gateway_wallets` provider `brick` with `usable_balance` from Brick `GET /payments/gs`.
5. Income dashboard → panel **Saldo per Laci Keuangan** shows **Laci Brick** with platform hint; **Total Current Balance** includes bank + Brick.
6. Brick sandbox upstream errors → last snapshot + `sync_error` badge; retry via Refresh mutasi.
7. Top up disbursement wallet: Brick Dashboard → **Add Test Balance** (separate from ERP mutasi / `bank_statement_balance`).
8. Validation: `scripts/gateway-wallet-balance-validation.sql`.

## External VA (unlinked)

1. Create VA manually in Brick dashboard (not from Synckerja).
2. Callback should insert mutasi + suggest match only.
3. Confirm deposit manually → `deposit_source = brick_mutasi` (not `brick_va`).
