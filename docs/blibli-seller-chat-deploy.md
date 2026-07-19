# Blibli Seller Chat (OTT + iframe) — deploy notes

## What this is

Synckerja embeds Blibli Seller Center chat via a short-lived OTT (one-time token), not a native message sync API.

Docs: Seller Chat OTT `GET/POST /proxy/seller/v1/chats/tokens`.

## Edge Function secrets

Set these in the Supabase project (Dashboard → Edge Functions → Secrets, or CLI):

| Secret | Required | Notes |
|--------|----------|--------|
| `BLIBLI_API_CLIENT_ID` | yes | Synckerja platform API Client ID (sellers bind this in Seller API Manager) |
| `BLIBLI_API_CLIENT_KEY` | yes | Client key for Basic Auth (`clientId:clientKey`) |
| `BLIBLI_CHANNEL_ID` | recommended | Fixed `channelId` query value (default in code: `Synckerja`) |
| `BLIBLI_SELLER_CONFIG_ENCRYPTION_KEY` | yes* | 32-byte key as base64 or 64-char hex. *Falls back to `TIKTOK_SHOP_CONFIG_ENCRYPTION_KEY` / `TIKTOK_ADS_CONFIG_ENCRYPTION_KEY` if unset |
| `BLIBLI_SELLER_API_BASE` | optional | Default `https://api.blibli.com/v2` (staging override as needed) |
| `BLIBLI_SELLER_CENTER_ORIGIN` | optional | Default `https://seller.blibli.com`; staging e.g. `https://seller-preprod-gcp.gdn-app.com` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform.

## Migration

Apply:

```bash
supabase db push
# or apply file:
# supabase/migrations/20260718220000_organization_blibli_seller_chat.sql
```

Tables:

- `organization_blibli_seller_connections`
- `organization_blibli_seller_connection_tokens` (RLS deny-all for authenticated)
- `blibli_seller_chat_ott_mints` (rate-limit audit; RLS deny-all)

## Deploy functions

```bash
supabase functions deploy blibli-seller-config --no-verify-jwt
supabase functions deploy blibli-seller-chat --no-verify-jwt
```

Both are registered in `supabase/config.toml` with `verify_jwt = false` (JWT checked inside the function).

## Ops checklist

1. Register Synckerja API Client ID with Blibli.
2. Seller binds that Client ID in Blibli Seller API Manager for their store.
3. In app: Operations → E-Commerce Chat → Blibli → connect with store code, username, store ID, Api-Seller-Key (optional Signature Key).
4. Open Blibli tab → backend mints OTT → iframe loads within 1 minute.
5. Session lasts ~8 hours; re-mint on expiry / manual refresh (respect 10 req/hour per store).

## Testing

```bash
# Frontend helpers
npx vitest run src/6-0-ecommerce-chat/lib/blibliSellerChat.test.ts src/6-0-ecommerce-chat/lib/blibliSellerEdgeHelpers.test.ts

# Shared edge helpers (requires Deno)
deno test --allow-env supabase/functions/_shared/blibliSeller/
```

## Limits to respect

- 10 OTT requests per hour per `storeCode`
- Max 10 concurrent valid OTTs per store
- OTT must be used in the iframe within ~1 minute
