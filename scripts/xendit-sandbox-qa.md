# Xendit Sandbox QA Checklist

Use this after applying migrations through `20260821120000_xendit_kyc_business_profile.sql`, setting Supabase secrets, and deploying `xendit-api`.

## 1. Server setup

- [ ] `XENDIT_SECRET_KEY` set (sandbox key from Xendit Dashboard)
- [ ] `XENDIT_WEBHOOK_VERIFICATION_TOKEN` set
- [ ] `XENDIT_ENV=sandbox`
- [ ] `XENDIT_INTERNAL_ORG_IDS` set for Synckerja internal org (sandbox UUID from seed script)
- [ ] `xendit-api` deployed with `--no-verify-jwt` (webhook + API in one function)
- [ ] Delete legacy `xendit-webhook` function in Dashboard if still listed
- [ ] Webhook URL in Xendit → `https://<project>.supabase.co/functions/v1/xendit-api`

## 2. Org opt-in (`/xendit/connect`)

- [ ] Owner/admin can open `/xendit/connect`
- [ ] Toggle **Enable Xendit** → row in `organization_xendit_settings`
- [ ] **Internal org** (in `XENDIT_INTERNAL_ORG_IDS`): **Tambah sub-account** → OWNED, no KYC modal
- [ ] **External tenant (first sub-account)**: **Tambah sub-account** → KYC modal → MANAGED + `organization_kyc_documents` PENDING
- [ ] KYC modal: wizard 3 langkah (Profil → Dokumen legal → Bisnis & payout)
- [ ] KYC modal: pilih tipe entitas (Perorangan, PT/CV/PMA, PP, Yayasan, Koperasi)
- [ ] Badan usaha: wajib NIB + NPWP perusahaan + NPWP direktur + dokumen sesuai entitas (Akta/SK Menkeh, TDY, PSE, dll.)
- [ ] Badan usaha: wajib alamat bisnis + website **atau** bukti usaha (invoice/foto toko)
- [ ] KYC modal: panduan 3 langkah Service Agreement + tombol **Unduh template** (`/templates/xendit-service-agreement-id.pdf`)
- [ ] Unduh template → file `xendit-service-agreement-indonesia.pdf`; ganti placeholder di `public/templates/` dengan PDF resmi Xendit (lihat `scripts/xendit-service-agreement-template.md`)
- [ ] KYC modal requires **Service Agreement PDF** (signed) + KTP; payload includes `service_agreement_document` + `business_registration_documents` (ID_NIB, ID_COMPANY_NPWP, ID_AKTA, ID_SKMENKEH, dll.) in Xendit verification
- [ ] **KYC lama** (hanya NIB/NPWP): `kycDocumentsComplete` = false → tombol **Lengkapi dokumen** meminta Akta, SK Menkeh, NPWP direktur, alamat, bukti usaha
- [ ] Sub-account row in `xendit_sub_accounts` with `document_upload_status` pending/completed/failed
- [ ] **Second sub-account** (different email): create dialog only, no KYC re-upload; auto-upload org KYC docs to Xendit after create
- [ ] **Lengkapi dokumen** on failed/incomplete rows opens KYC edit modal → `updateKycAndRetryDocuments`
- [ ] **Retry upload** button when `document_upload_status=failed` and org KYC documents complete
- [ ] **Jadikan utama** sets `is_primary` on one row per org
- [ ] Bootstrap split rule → see `scripts/xendit-bootstrap-split-rule.md` → `xendit_platform_config.split_rule_id` populated

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

- [ ] Primary sub-account `status=pending` → **Disburse via Xendit** disabled with tooltip
- [ ] After Xendit verifies sub-account (`status=active`) → disburse enabled
- [ ] Run in `calculated` status with pending employee payouts
- [ ] **Disburse via Xendit** opens preview: employee list, bank, THP, invalid rows highlighted
- [ ] Preview shows **CASH balance** vs **total pending THP**; confirm blocked if insufficient
- [ ] Confirm → MFA step-up → disburse batch (`xendit_disbursements`, calcs `processing`)
- [ ] Brick **Disburse via Brick** hidden on payroll (Brick still for balance/mutations elsewhere)
- [ ] While any calc `processing`: **Mark as Paid** hidden; full re-disburse disabled
- [ ] Webhook completed → calcs `paid`; all paid → run auto `paid` (`maybe_finalize_payroll_run`)
- [ ] Failed calc → banner + per-row **Retry** (`payroll_calculation` source)
- [ ] After batch: gateway wallet snapshot refreshed + `payroll_audit_log` `xendit_disburse_batch`
- [ ] Process payroll: missing bank → warning only (not block); disburse preview blocks invalid rows
- [ ] CSV export still available (unchanged)

### Payroll statutory escrow (optional per org)

Apply migration `20260826120000_payroll_xendit_escrow.sql`.

- [ ] Enable escrow in Payroll sidebar → pick non-primary active sub-account (MFA)
- [ ] Escrow ON → Mark as Paid hidden; disburse still works
- [ ] Disburse card shows **Operational CASH (Primary)**; reserved escrow as subtext
- [ ] After all calcs paid + run finalized → `POST /transfers` primary → escrow
- [ ] Verify `payroll_xendit_escrow_transfers.status = completed` and wallet balances shift
- [ ] Insufficient CASH after THP → `failed` row + banner; retry after top-up (MFA)
- [ ] Org without escrow enabled → no transfer rows, no UI banners

See `docs/payroll-escrow-runbook.md`.

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
7. Drawer row shows **Terakhir sync** with absolute WIB timestamp (`formatGatewaySyncedAt`); Income dashboard still uses **if_stale** (15 min) auto-sync only.
8. `/xendit/balance` forces one **getBalance** sync on page mount and shows the same timestamp on aggregate + primary CASH cards.
9. Payroll disburse preview syncs fresh CASH on dialog open (primary sub-account balance); confirm stays disabled until sync completes.
10. Payroll paid: webhook/manual mark paid → email karyawan + home banner 24h (`employee_payroll_paid_announcements`); inline 2FA on disburse confirm.

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

## 12. Multi sub-account balance & history

Prerequisites: migration `20260822120000_xendit_sub_account_wallets.sql` applied; `xendit-api` deployed with `syncAllOrgXenditWallets`.

Setup: org with **2+ active** sub-accounts (different business emails). Failed/suspended sub-accounts must **not** appear in selectors.

### Balance (`/incomes/xendit/balance` or `/xendit/balance`)

- [ ] **Aggregate card** shows SUM of CASH + HOLDING across all active sub-accounts (matches `organization_gateway_wallets` provider=xendit)
- [ ] **Per-sub-account grid** shows email, business name, CASH/HOLDING per row from `xendit_sub_account_wallets`
- [ ] Primary sub-account badge **Utama** / **Primary**
- [ ] Refresh triggers sync for all active sub-accounts; aggregate updates after sync
- [ ] **Withdraw** section uses **primary only** balance; subtitle shows primary email/label
- [ ] Withdraw still debits primary sub-account CASH only (unchanged behavior)

### History (`/incomes/xendit/history`)

- [ ] Default filter **Semua sub-account** / **All sub-accounts** — shows all withdrawals
- [ ] Filter by one sub-account → only rows with matching `sub_account_id`
- [ ] **Sub-account** column always visible (email / business_name; fallback truncated ID or —)
- [ ] Old rows without label still render (fallback)

### Incomes dashboard

- [ ] Xendit drawer total = **aggregate** (sum all active sub-accounts)
- [ ] Subtitle shows count of active sub-accounts + link to balance page

### Expenses / payment process

- [ ] Gateway picker shows **primary** usable balance as operational amount
- [ ] Footnote shows org aggregate total + sub-account count
- [ ] Disbursement still uses primary sub-account (no sub-account selector)

### Bank mutations

- [ ] `erp_gateway_withdrawal` rows show sub-account label from `raw_payload.sub_account_id`
- [ ] New `erp_expense` Xendit disbursements include `sub_account_id` in payload (primary at disburse time)

### Primary switch & new sub-account

- [ ] Set primary sub-account → resync **all** wallets + aggregate
- [ ] New sub-account becomes `active` → auto-sync wallet row for that account

### Polling fix

- [ ] Pending `xendit_disbursements` poll uses each row's `sub_account_id`, not always primary
