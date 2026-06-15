# Bootstrap Xendit Platform Split Rule

Run **once per Supabase project / Xendit environment** (sandbox vs production have separate split rule IDs).

## Prerequisites

1. Migration `20260720120000_xendit_platform_split_fee.sql` applied.
2. `xendit-api` deployed with `--no-verify-jwt`.
3. Supabase secrets: `XENDIT_SECRET_KEY`, optional `XENDIT_PLATFORM_FLAT_FEE` (default `2500`).

## Option A — API call (recommended before tenant QA)

Use any org where the caller is `owner` or `admin`:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/xendit-api" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"ensureSplitRule","organization_id":"YOUR_ORG_ID"}'
```

Expected response:

```json
{
  "ok": true,
  "flatFeeAmount": 2500,
  "splitRuleId": "splitru_...",
  "ready": true,
  "platformSplitReady": true
}
```

Verify in SQL Editor:

```sql
SELECT flat_fee_amount, split_rule_id, updated_at
FROM public.xendit_platform_config
WHERE id = 1;
```

## Option B — Self-heal on first VA

`createTenantInvoiceVA` calls `ensureSplitRule` internally. The first VA generation for any tenant will create the split rule if missing.

## After bootstrap

- `getSettings` returns `platformSplitReady: true` for all tenants.
- Piutang **Generate VA** is enabled; without split rule, VA creation is blocked with `xendit_platform_split_not_ready`.
- Each paid VA credits tenant ERP **net** (`gross - platform_fee_amount`).

## Webhook (optional audit)

Subscribe to **split.payment** in Xendit Dashboard (same webhook URL as VA/disbursement). Updates `xendit_payment_requests.platform_fee_status`.
