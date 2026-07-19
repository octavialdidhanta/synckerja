# Blibli Order Management (Fase 1) — deploy notes

## What this is

Read-only package list via Blibli Seller API:

`POST /proxy/seller/v1/orders/packages/filter`

Grouped by `packageId`. Reuses existing Blibli store connections from Seller Chat.

## Prerequisites

1. Secrets already used by Chat (same):
   - `BLIBLI_API_CLIENT_ID`
   - `BLIBLI_API_CLIENT_KEY`
   - `BLIBLI_CHANNEL_ID`
   - `BLIBLI_SELLER_CONFIG_ENCRYPTION_KEY` (or TikTok encryption key fallback)
2. Migration applied:
   - `supabase/migrations/20260719100000_blibli_orders_page_and_rate_limit.sql`
   - (and earlier) `20260718220000_organization_blibli_seller_chat.sql`

## Deploy

```powershell
cd "D:\Synckerja Office - 11 Juni 2026\synckerja"

$env:SUPABASE_ACCESS_TOKEN = "sbp_YOUR_TOKEN"

npx supabase functions deploy blibli-seller-orders `
  --project-ref wqdzqqshoifwyrltzgvx `
  --no-verify-jwt `
  --use-api
```

Registered in `supabase/config.toml` as `[functions.blibli-seller-orders]` with `verify_jwt = false`.

## App routes

- `/operations/sales/blibli-orders` — Orders
- `/operations/sales/blibli-orders/settings` — Settings (connect panel)

Sidebar: Operations → under TikTok Shop → **Blibli Orders** / **Manajemen Pesanan Blibli**.

## Limits

- Max page size **50** (UI default **20**)
- **100 requests / 30 minutes / store** (enforced via `blibli_seller_order_api_calls`)
- Data up to **1 year** old

## Testing

```bash
npx vitest run src/blibli-orders/lib/blibliOrders.test.ts src/blibli-orders/lib/blibliOrderRateLimit.test.ts
```

## Out of scope (Fase 2)

Create package, print label, cancel, download, fulfillment flows, orders DB cache.
