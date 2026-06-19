# xendit-api

Authenticated action router for Xendit xenPlatform (Synckerja multi-tenant ERP).

Deploy with JWT verification **off** at the gateway; auth is enforced inside via Bearer token + org membership + role gate (`owner` / `admin`).

**Webhook:** Xendit callbacks are handled by the same function when header `x-callback-token` is present (no JWT). Register this URL in Xendit Dashboard:

```
https://<project-ref>.supabase.co/functions/v1/xendit-api
```

After migration from `xendit-webhook`, delete the old `xendit-webhook` function in Supabase Dashboard to free edge function quota.

```bash
supabase functions deploy xendit-api --no-verify-jwt
```

## Environment (Supabase secrets)

| Secret | Required | Description |
|--------|----------|-------------|
| `XENDIT_SECRET_KEY` | Yes | Master API key (server only) |
| `XENDIT_PUBLIC_KEY` | No | Optional public key reference |
| `XENDIT_WEBHOOK_VERIFICATION_TOKEN` | Yes (prod) | `x-callback-token` for webhooks |
| `XENDIT_ENV` | No | `sandbox` (default) or `production` |
| `XENDIT_PLATFORM_FLAT_FEE` | No | Override flat fee (default `2500` IDR) |
| `XENDIT_MIN_DISBURSEMENT_AMOUNT` | No | Minimum gateway withdrawal / disburse amount (default `10000` IDR) |
| `XENDIT_WEBHOOK_SKIP_VERIFY` | No | `true` for local dev only |
| `XENDIT_INTERNAL_ORG_IDS` | No | Comma-separated org UUIDs that skip JIT KYC and use `OWNED` sub-accounts (Synckerja internal) |

Apply migration `20260817120000_xendit_jit_kyc_multi_subaccount.sql` before using multi sub-account + KYC flows.

## Request shape

All actions are `POST` with JSON body:

```json
{
  "action": "<action>",
  "organization_id": "<uuid>"
}
```

Include `Authorization: Bearer <supabase_jwt>`.

## Actions

| Action | Role | Description |
|--------|------|-------------|
| `getSettings` | member | Sub-account list, primary sub-account, KYC row, platform fee |
| `enableXendit` | admin | Opt-in flag per org (`organization_xendit_settings`) |
| `requestSubAccount` | admin | JIT gate: `{ require_kyc, can_create, account_type }` |
| `submitKycAndCreate` | admin | Save KYC + create MANAGED sub-account + upload docs to Xendit (incl. service agreement) |
| `createTenantSubAccount` | admin | Create sub-account (OWNED internal / MANAGED external); MANAGED auto-uploads org KYC docs |
| `updateKycAndRetryDocuments` | admin | Update org KYC row + retry document upload for a sub-account row |
| `retrySubAccountDocuments` | admin | Retry failed Xendit document upload (requires complete org KYC including service agreement) |
| `setPrimarySubAccount` | admin | Set default sub-account for VA / payroll / withdrawal |
| `listSubAccounts` | member | List + reconcile all sub-accounts for org |
| `createTenantInvoiceVA` | admin | Closed VA for `sales_activity_payments` (piutang) |
| `listVaBanks` | member | Supported sandbox VA banks |
| `executeTenantDisbursement` | admin | Payroll run batch, vendor PR, or debt payment |
| `executeGatewayWithdrawal` | admin | Withdraw sub-account CASH to registered payout bank (real `POST /disbursements`) |
| `listGatewayWithdrawals` | member | Recent gateway withdrawal history |
| `ensureSplitRule` | admin | Bootstrap Xendit split rule (flat platform fee → master account); also auto-runs on first VA |

### createTenantInvoiceVA

```json
{
  "action": "createTenantInvoiceVA",
  "organization_id": "...",
  "sales_activity_payment_id": "...",
  "bank_code": "BCA",
  "name": "Customer name"
}
```

`external_id` format: `synckerja:{orgId}:sap:{paymentId}`

VA creation attaches header `with-split-rule` (platform flat fee routed to master account). ERP settlement credits **net** amount (`payment_amount - platform_fee_amount`).

### Bootstrap platform split rule (run once per environment)

After deploy, call `ensureSplitRule` once so `xendit_platform_config.split_rule_id` is populated before tenants generate VA:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/xendit-api" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"ensureSplitRule","organization_id":"YOUR_ORG_ID"}'
```

Or rely on self-heal: first `createTenantInvoiceVA` also calls `ensureSplitRule` internally.

See also: `scripts/xendit-bootstrap-split-rule.md`

### executeGatewayWithdrawal

Withdraw xenPlatform sub-account **CASH** to the org's `use_for_gateway_payout` bank account via Xendit Disbursements API (`for-user-id` header). On `completed`: credits ERP payout bank balance + syncs `organization_gateway_wallets`.

```json
{
  "action": "executeGatewayWithdrawal",
  "organization_id": "...",
  "amount": 100000
}
```

`external_id` format: `synckerja:{orgId}:gateway_withdrawal:{withdrawalId}`

### executeTenantDisbursement

Payroll batch:

```json
{
  "action": "executeTenantDisbursement",
  "organization_id": "...",
  "source_type": "payroll_run",
  "payroll_run_id": "..."
}
```

Vendor:

```json
{
  "action": "executeTenantDisbursement",
  "organization_id": "...",
  "source_type": "purchase_request",
  "source_id": "...",
  "bank_code": "BCA",
  "account_number": "...",
  "account_holder_name": "...",
  "amount": 1500000
}
```

Debt:

```json
{
  "action": "executeTenantDisbursement",
  "organization_id": "...",
  "source_type": "debt_payment",
  "source_id": "...",
  "bank_code": "BCA",
  "account_number": "...",
  "account_holder_name": "...",
  "amount": 500000
}
```

## Sandbox curl example

```bash
curl -X POST "$SUPABASE_URL/functions/v1/xendit-api" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"getSettings","organization_id":"YOUR_ORG_ID"}'
```
