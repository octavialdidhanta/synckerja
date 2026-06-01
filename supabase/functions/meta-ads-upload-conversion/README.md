# Meta Ads offline conversions (Conversions API)

Synckerja sends Meta Conversions API (CAPI) events when a CRM lead becomes **Converted**. Each organization connects its own Meta account via OAuth; multiple ad accounts (brands) per org are supported.

## Edge Functions

| Function | Purpose |
|----------|---------|
| `meta-ads-upload-conversion` | Upload on lead converted (called from app) |
| `meta-ads-oauth-start` | Start OAuth PKCE (admin settings) |
| `meta-ads-oauth-callback` | OAuth redirect handler (Meta → Supabase → app) |
| `meta-ads-config` | Settings CRUD, list ad accounts/pixels, test |
| `meta-ads-metrics` | Insights API with ~10 min DB cache |

## Deploy

```bash
supabase link
supabase db push   # includes organization_meta_ads_* tables
supabase functions deploy meta-ads-upload-conversion
supabase functions deploy meta-ads-oauth-start
supabase functions deploy meta-ads-oauth-callback
supabase functions deploy meta-ads-config
supabase functions deploy meta-ads-metrics
```

## Platform secrets (Supabase Edge)

| Secret | Purpose |
|--------|---------|
| `META_ADS_APP_ID` / `META_ADS_APP_SECRET` | Synckerja Meta app (falls back to `META_APP_ID` / `META_APP_SECRET`) |
| `META_ADS_CONFIG_ENCRYPTION_KEY` | 32-byte key (base64 or 64-char hex) for per-org access tokens |
| `META_ADS_OAUTH_REDIRECT_URI` | Optional; default `{SUPABASE_URL}/functions/v1/meta-ads-oauth-callback` |
| `META_GRAPH_API_VERSION` | Optional; default `v22.0` |
| `APP_PUBLIC_URL` | App origin for post-OAuth redirect |

Register OAuth redirect URI in Meta Developer Console:

`https://<PROJECT_REF>.supabase.co/functions/v1/meta-ads-oauth-callback`

Required scopes: `ads_read`, `ads_management`, `business_management`.

## Per-org data

- `organization_meta_ads_connections` — `is_active` (uploads enabled), test metadata
- `organization_meta_ads_connection_tokens` — `access_token_enc` (long-lived token; Edge only)
- `organization_meta_ads_accounts` — ad account ID, pixel ID, default CAPI event name
- `leads.fbclid` — Facebook click ID for attribution
- `leads.meta_ads_account_id` — optional per-lead brand override

Settings UI: `/omnichannel/settings/offline-conversion` (Google | Meta tabs).

## Upload invoke (authenticated)

```json
POST meta-ads-upload-conversion
{ "lead_id": "<uuid>", "organization_id": "<uuid>", "sales_activity_id": "<uuid optional>" }
```

Account resolution: `leads.meta_ads_account_id` → org default account → skip `meta_ads_not_configured`.

Skip reasons: `uploads_disabled`, `pixel_not_configured`, `no_fbclid_or_contact`.

## Encryption key

```bash
openssl rand -base64 32
```

Set as `META_ADS_CONFIG_ENCRYPTION_KEY`. **Back up this key** — losing it requires all orgs to reconnect Meta.

Implementation: `supabase/functions/_shared/metaAdsConfigCrypto.ts` (AES-256-GCM).
