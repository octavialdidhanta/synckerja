# Google Ads deferred pending conversions (batch)

Uploads queued offline conversions via **pg_cron** (hourly). Leads are enqueued when payment (DP/full) is recorded and `gclid` is present; upload runs **≥ 5 hours** after `leads.payment_at`.

## Edge Functions

| Function | Purpose |
|----------|---------|
| `google-ads-upload-pending-conversions` | **Batch upload** (pg_cron, service role / secret key only) |
| `google-ads-upload-offline-conversion` | Legacy single-lead (service role only, ops/debug) |

## Deploy

```bash
npm run supabase:db:push   # payment_at, pending, RPC, cron, apikey header migration
npm run supabase:functions:deploy:google-ads-pending
npm run supabase:functions:deploy:google-ads
```

Full rollout steps: [`docs/google-ads-deferred-rollout-checklist.md`](../../../docs/google-ads-deferred-rollout-checklist.md)

## Vault secrets (pg_cron)

Set in Supabase Dashboard → Vault:

| Secret | Value |
|--------|--------|
| `google_ads_scheduler_project_url` | `https://<PROJECT_REF>.supabase.co` |
| `google_ads_scheduler_service_role_key` | **Secret key** (`sb_secret_...`) from Dashboard → Settings → API |

Projects on Supabase **new API keys** must use `sb_secret_...`, not legacy JWT `eyJ...`, in Vault and manual invokes.

Cron job: `google-ads-pending-conversions` — `0 * * * *` (every hour). RPC sends `Authorization` + `apikey` headers.

## Flow

1. CRM records payment on lead conversion → `enqueue_google_ads_conversion_pending` RPC
2. Sets `leads.payment_at`, audit row `google_ads_conversion_uploads.status = pending`
3. Hourly cron → `google-ads-upload-pending-conversions`
4. Eligible: `gclid`, `payment_at <= now() - 5h`, status `pending`/`failed`, attempts < 5
5. `UploadClickConversions` with hashed email/phone, DP value, conversion action from org settings

## Manual batch invoke

Use **secret key** (`sb_secret_...`) or legacy service_role JWT — both `Authorization` and `apikey`:

```bash
curl -i -X POST "$SUPABASE_URL/functions/v1/google-ads-upload-pending-conversions" \
  -H "Authorization: Bearer $SB_SECRET_KEY" \
  -H "apikey: $SB_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `{"ok":true,"processed":0,...}` when queue is empty.

## Auth

Handler accepts caller token from `Authorization: Bearer` or `apikey` header. Valid keys: `SUPABASE_SERVICE_ROLE_KEY` and entries in `SUPABASE_SECRET_KEYS` (see `_shared/serviceRoleEdgeAuth.ts`).

## Related

- Enqueue RPC: `public.enqueue_google_ads_conversion_pending`
- Batch picker: `public.fetch_google_ads_pending_conversion_batch`
- Shared logic: `supabase/functions/_shared/googleAdsConversionUpload.ts`
- Settings UI: `/omnichannel/settings/offline-conversion`
