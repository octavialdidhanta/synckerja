# Google Ads offline conversions (per-tenant)

Synckerja uploads offline click conversions when a CRM lead becomes **Converted**. Each organization connects its own Google Ads account via OAuth; multiple customer IDs (brands) per org are supported.

## Edge Functions

| Function | Purpose |
|----------|---------|
| `google-ads-upload-pending-conversions` | **Batch upload** pending queue (pg_cron hourly) |
| `google-ads-upload-offline-conversion` | Legacy single-lead (service role ops/debug only) |
| `google-ads-oauth-start` | Start OAuth (admin settings) |
| `google-ads-oauth-callback` | OAuth redirect handler (Google → Supabase → app) |
| `google-ads-config` | Settings CRUD, list customers/actions, test |

## Deploy

```bash
supabase link
supabase db push   # includes organization_google_ads_* tables
supabase functions deploy google-ads-upload-pending-conversions
supabase functions deploy google-ads-upload-offline-conversion
supabase functions deploy google-ads-oauth-start
supabase functions deploy google-ads-oauth-callback
supabase functions deploy google-ads-config
```

## Platform secrets (Supabase Edge)

| Secret | Purpose |
|--------|---------|
| `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` | Single Synckerja GCP OAuth client |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Platform developer token |
| `GOOGLE_ADS_CONFIG_ENCRYPTION_KEY` | 32-byte key (base64 or 64-char hex) for per-org refresh tokens |
| `GOOGLE_ADS_OAUTH_REDIRECT_URI` | Optional; default `{SUPABASE_URL}/functions/v1/google-ads-oauth-callback` |
| `APP_PUBLIC_URL` | App origin for post-OAuth redirect (e.g. `https://app.synckerja.com`) |
| `GOOGLE_ADS_API_VERSION` | Optional; default `v24` |

**Legacy transition (optional, remove after seed):**

| Secret | Purpose |
|--------|---------|
| `GOOGLE_ADS_REFRESH_TOKEN` | Global refresh token (fallback upload only) |
| `GOOGLE_ADS_CUSTOMER_ID` / `GOOGLE_ADS_CONVERSION_ACTION_ID` | Legacy customer + action |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Legacy MCC |
| `GOOGLE_ADS_LEGACY_GLOBAL_FALLBACK` | Set `true` to allow fallback for seed org only |

Register OAuth redirect URI in Google Cloud Console:

`https://<PROJECT_REF>.supabase.co/functions/v1/google-ads-oauth-callback`

## Per-org data

- `organization_google_ads_connections` — MCC, `is_active`, test metadata (no refresh token)
- `organization_google_ads_connection_tokens` — `refresh_token_enc` (service role / Edge only)
- `organization_google_ads_accounts` — customer ID, conversion action, default brand
- `leads.google_ads_account_id` — optional per-lead brand override

Settings UI: `/omnichannel/settings/google-ads` (org owner or omnichannel admin).

## Seed org from legacy global secrets

One-time for org `663c9336-8cb6-4a36-9ad9-313126e70a1a` (vialdi):

1. Ensure global `GOOGLE_ADS_*` secrets are still set on the project.
2. As org admin, call `google-ads-config`:

```json
POST { "action": "importLegacyEnvSecrets", "organization_id": "663c9336-8cb6-4a36-9ad9-313126e70a1a" }
```

3. Enable uploads in settings; disable `GOOGLE_ADS_LEGACY_GLOBAL_FALLBACK` after verification.

## Encryption key

Generate a 32-byte key:

```bash
openssl rand -base64 32
```

Set as `GOOGLE_ADS_CONFIG_ENCRYPTION_KEY`. **Back up this key** — losing it requires all orgs to reconnect Google.

Implementation: `supabase/functions/_shared/googleAdsConfigCrypto.ts` (AES-256-GCM).

## Upload invoke (deferred)

Leads are enqueued via RPC `enqueue_google_ads_conversion_pending` when payment is recorded (CRM / public API). Batch upload runs hourly via pg_cron.

See [`../google-ads-upload-pending-conversions/README.md`](../google-ads-upload-pending-conversions/README.md).

**Legacy single-lead (service role / secret key only):**

Use `Authorization: Bearer` + `apikey` with `sb_secret_...` or legacy service_role JWT.

```json
POST google-ads-upload-offline-conversion
{ "lead_id": "<uuid>", "organization_id": "<uuid>", "sales_activity_id": "<uuid optional>" }
```

Account resolution: `leads.google_ads_account_id` → org default account → skip `google_ads_not_configured`.

## Troubleshooting

- **Sync column hidden:** `is_google_ads_integration_enabled(org)` must be true (OAuth + active uploads + ≥1 account).
- **CUSTOMER_NOT_FOUND:** Use settings **Test connection**; pick customer from **Load accessible customers**.
- **MCC:** Set manager customer ID in settings (maps to `login-customer-id` header).

## Docs

- Design doc (update for multi-tenant): [`docs/google-ads-api-design-document.md`](../../../docs/google-ads-api-design-document.md)
- Compliance addendum draft: [`docs/google-ads-api-compliance-addendum.md`](../../../docs/google-ads-api-compliance-addendum.md)
