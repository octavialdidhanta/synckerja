# TikTok Shop CS webhook setup (type 13 + 14)

Push Customer Service events into Synckerja E-Commerce Chat (TikTok tab) without polling.

## Callback URL

Register this endpoint in TikTok Shop Partner Center (Customer Service / webhook settings):

```
https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/tiktok-shop-webhook
```

Subscribe to both events on the **same** callback URL:

| Event | Type | Purpose |
| --- | --- | --- |
| New conversation | `13` | Signal to refresh the left inbox list (`listConversations`) |
| New message | `14` | Persist message + live bubble / unread bump |

- **Method:** `POST` (edge also answers `GET` with `{ ok: true }` for simple health checks)

## Signature / secret

The edge function verifies the `TikTok-Signature` (or `Tiktok-Signature`) header using the official TikTok scheme:

- Header form: `t=<unix_seconds>,s=<hmac_hex>`
- Signed payload: `` `${t}.${rawBody}` ``
- HMAC-SHA256 with **`TIKTOK_SHOP_APP_SECRET`** (same app secret already configured for TikTok Shop OAuth / API signing)

Invalid signatures return **401**. Successful handling returns **200** quickly (including duplicates, unknown shops, and skipped types).

## Deploy

1. Apply migrations:
   - `20260719130000_tiktok_shop_cs_webhook.sql` — `tiktok_shop_cs_webhook_events`, `tiktok_shop_cs_messages`
   - `20260719140000_tiktok_shop_cs_conversations.sql` — `tiktok_shop_cs_conversations` + Realtime
2. Deploy the edge function:

```bash
npx supabase functions deploy tiktok-shop-webhook --no-verify-jwt --project-ref wqdzqqshoifwyrltzgvx
```

Ensure `TIKTOK_SHOP_APP_SECRET` is set in Edge Function secrets for that project.

## Behaviour (product)

- Maps `payload.shop_id` → `organization_tiktok_shop_accounts.shop_id`.
- **Type 13:** upserts `tiktok_shop_cs_conversations`; FE Realtime invalidates `listConversations` so buyer names / unread come from TikTok pull API.
- **Type 14:** persists visible messages (`is_visible !== false`) for all sender roles; FE appends bubbles on the open thread and bumps `unread_count` + `latest_message` for other conversations.
- Conversation list itself still loads from the TikTok pull API (`listConversations`); webhooks only accelerate the live UI.
