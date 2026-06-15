# Xendit Sandbox QA Checklist

Use this after applying migrations through `20260725120000_gateway_payout_bank_validation.sql`, setting Supabase secrets, and deploying `xendit-api`.

## 1. Server setup

- [ ] `XENDIT_SECRET_KEY` set (sandbox key from Xendit Dashboard)
- [ ] `XENDIT_WEBHOOK_VERIFICATION_TOKEN` set
- [ ] `XENDIT_ENV=sandbox`
- [ ] `xendit-api` deployed with `--no-verify-jwt` (webhook + API in one function)
- [ ] Delete legacy `xendit-webhook` function in Dashboard if still listed
- [ ] Webhook URL in Xendit → `https://<project>.supabase.co/functions/v1/xendit-api`

## 2. Org opt-in (`/incomes/xendit`)

- [ ] Owner/admin can open `/incomes/xendit` (tab Xendit di Income Management)
- [ ] Toggle **Enable Xendit** → row in `organization_xendit_accounts`
- [ ] **Create sub-account** → `xendit_sub_account_id` populated, `status=active`
- [ ] Bootstrap split rule → see `scripts/xendit-bootstrap-split-rule.md` → `xendit_platform_config.split_rule_id` populated
- [ ] Settings panel shows platform fee read-only + **Otomatis aktif** (no manual Save fee button)

## 3. Piutang VA (`/incomes/piutang`)

Seed data simulasi (SQL Editor): `scripts/xendit-piutang-sandbox-seed.sql`

- [ ] Open unpaid installment → **Generate VA** (choose bank)
- [ ] Row in `xendit_payment_requests` with `status=pending`, `platform_fee_amount=2500`, `split_rule_id` set
- [ ] VA number displayed in drawer; net amount hint shown (gross − platform fee)
- [ ] Pay VA in Xendit sandbox simulator
- [ ] Webhook received → `xendit_webhook_events` + `status=paid`
- [ ] `sales_activity_payments.transfer_verification_status = approved`
- [ ] `income_transactions.amount` = gross − 2500 (e.g. 97500 for Rp 100.000 payment)
- [ ] Org bank with `use_for_xendit_income=true` credited net amount

## 4. Payroll disburse (`/payroll/calculations`)

- [ ] Run in `calculated` status with pending employee payouts
- [ ] **Disburse via Xendit** → `xendit_disbursements` rows, calcs `processing`
- [ ] Webhook completed → calcs `paid`
- [ ] CSV export still available (unchanged)

## 5. Vendor payment (`/expenses/payment-process`)

- [ ] Approved unpaid PR → **Pay via Xendit** with vendor bank details
- [ ] `purchase_requests.payment_status=processing` then `paid` on webhook
- [ ] `vendor_bank_*` columns saved on PR

## 6. Debt disburse (`/expenses/debt`)

- [ ] Record debt payment (existing flow)
- [ ] Payment history card shows **Disburse via Xendit**
- [ ] Submit creditor bank → `debt_payments.xendit_disbursement_id` set
- [ ] Webhook completed → `transaction_reference` updated

## 7. Failure paths

- [ ] Invalid bank account → disbursement `failed`, message stored
- [ ] Duplicate webhook → idempotent `200`, no double settlement
- [ ] Non-admin cannot enable Xendit or create VA
- [ ] Clear `split_rule_id` in DB → sub-account create still OK; generate VA blocked with clear message
- [ ] Payment amount ≤ platform fee → rejected before Xendit API call

## 8. Bank account flag

- [ ] Mark one org bank account `use_for_xendit_income=true`
- [ ] VA settlement credits that account only

## 9. Gateway wallet balance (Income Dashboard)

1. Apply migration `20260615120000_organization_gateway_wallets.sql`.
2. Deploy `xendit-api` with action `getBalance` (`GET /balance` + `for-user-id` header).
3. Org with Xendit enabled + `xendit_sub_account_id` → open `/incomes/dashboard` or call `getBalance` → snapshot in `organization_gateway_wallets` provider `xendit`.
4. Panel **Saldo per Laci Keuangan** shows **Laci Xendit**; **Total Current Balance** includes bank + Xendit usable balance.
5. Period net on drawer row = Σ settled VA − Σ completed disbursements for dashboard filter period.
6. Validation: `scripts/gateway-wallet-balance-validation.sql`.

## 10. Gateway withdrawal (`/incomes/xendit` — Saldo & Penarikan)

Apply migrations through `20260724120000_xendit_withdrawal_platform_fee.sql`.

Org example: **Bisnis baru**, sub-account `6a2ebdf2b4f220d466c8b48a`, payout BCA · 8710178926 · Octa Vialdi.

1. Open `/incomes/xendit` → page title **Saldo & Penarikan**; payout card badge **Rekening tervalidasi** only when Iluma `gateway_payout_validation_status = match`.
2. Note live **Saldo tersedia (CASH)** before withdrawal.
3. Owner/admin: click **Tarik Dana** → modal shows gross input, platform fee (from `withdrawalPlatformFee` / `xendit_platform_config.flat_fee_amount`), net to bank, static Xendit fee info.
4. **Tarik semua** or partial gross (e.g. Rp 5.000.000) → **Proses Penarikan**.
5. Verify:
   - `xendit_gateway_withdrawals`: `amount` = gross, `platform_fee_amount` = 2500 (default), `net_amount` = gross − fee, `bank_snapshot` populated
   - `xendit_disbursements` with `source_type=gateway_withdrawal`, `amount` = **net** (not gross), status `completed`
   - Xendit CASH balance decreased by **gross** after refresh
   - ERP payout `bank_accounts` balance increased by **net_amount**
   - `bank_account_balance_history.transaction_type = gateway_withdrawal`, `amount` = net
   - `bank_statement_lines` credit `origin=erp_gateway_withdrawal`, `amount` = net
   - History table: status **PROSES** / **BERHASIL** / **GAGAL**; admin sees initiator name
6. Negative: gross > CASH → rejected before Xendit API
7. Negative: net < min (Rp 10.000) → rejected (enter gross ≥ min + platform fee)
8. Negative: no payout bank → CTA disabled + message
9. Negative: non-admin → **Tarik Dana** disabled; can still view balance and history
10. One `processing` withdrawal at a time → second attempt blocked

## 11. Gateway payout bank validation (Iluma)

Setup: `scripts/iluma-gateway-payout-setup.md` — migration `20260725120000_gateway_payout_bank_validation.sql`.

- [ ] `ILUMA_API_KEY` set (or `ILUMA_USE_MOCK=true` for local QA only)
- [ ] Iluma callback `NAME_VALIDATOR_REQUEST` → `…/functions/v1/xendit-api`
- [ ] Valid account + matching `account_holder` → `MATCH`, badge **Rekening tervalidasi**, **Tarik Dana** enabled
- [ ] Wrong account number → `FAILED`, withdrawal blocked
- [ ] Wrong holder name → `NOT_MATCH`, withdrawal blocked
- [ ] Similar but unclear holder → `UNCLEAR`, withdrawal blocked (strict policy)
- [ ] Edit account number/holder after MATCH → `stale`, payout disabled, withdrawal blocked until re-validate
- [ ] Existing org backfill → `stale`; admin re-validates via Bank Accounts toggle or **Validasi rekening** on `/incomes/xendit`
- [ ] Row in `gateway_payout_bank_validations` per attempt
- [ ] Direct client `use_for_gateway_payout=true` without MATCH → DB trigger `gateway_payout_not_validated`
- [ ] Create sub-account: Iluma validation runs before Xendit `/v2/accounts`; non-MATCH aborts create
