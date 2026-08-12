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

Skip reasons: `uploads_disabled`, `pixel_not_configured`, `no_fbclid_or_contact`, `no_ctwa_or_fbclid_or_contact`.

## Click-to-WhatsApp (CTWA) offline conversions

When a customer opens WhatsApp from a **Click-to-WhatsApp ad**, Meta includes a `referral` object on the **first inbound message** webhook payload:

```json
{
  "messages": [{
    "referral": {
      "source_url": "...",
      "source_id": "...",
      "source_type": "ad",
      "headline": "...",
      "ctwa_clid": "<click-id>"
    }
  }]
}
```

Synckerja captures `ctwa_clid` in `whatsapp-webhook` (first-touch on conversation) and **syncs idempotently** to `leads.ctwa_clid` via `_shared/ctwaLeadSync.ts` (after lead creation, form-lead reconcile, and on Converted self-heal). Migration `20260812140000_ctwa_lead_backfill.sql` backfills historical rows.

When the CRM lead becomes **Converted**, `meta-ads-upload-conversion` sends a Conversions API event. If a prior upload succeeded with only `fbclid` or only `ctwa`, a later kick sends the missing channel and updates `upload_kind` to `both`.

| Field | Value |
|-------|--------|
| Endpoint | `POST /{pixel_id}/events` (same as fbclid CAPI) |
| Token | Meta Ads OAuth token (`organization_meta_ads_connection_tokens`) |
| `action_source` | `business_messaging` |
| `messaging_channel` | `whatsapp` |
| `user_data.ctwa_clid` | captured click ID |
| `user_data.em` / `ph` | SHA-256 hashed (optional boost) |
| `event_id` | `lead_{uuid}:ctwa` (dedupe; fbclid uses `lead_{uuid}`) |

If both `fbclid` and `ctwa_clid` exist on the lead, **two events** are sent in one API call (`upload_kind = both`).

**Prerequisites (customer Business Manager):**

- Meta Ads connected with Pixel configured (same as fbclid CAPI)
- WhatsApp Business account connected in Synckerja
- WABA linked to the ad account / dataset in Meta Business Settings
- App Review: `ads_management` + recommended `whatsapp_business_manage_events`

**Settings:** same toggle `organization_meta_ads_connections.is_active` at `/omnichannel/settings/offline-conversion` (Meta tab).

**Unit tests (CTWA helpers):**

```bash
npm run test:deno:ctwa
# or: deno test supabase/functions/_shared/ctwaReferral.test.ts supabase/functions/_shared/ctwaLeadSync.test.ts
```

## Encryption key

```bash
openssl rand -base64 32
```

Set as `META_ADS_CONFIG_ENCRYPTION_KEY`. **Back up this key** — losing it requires all orgs to reconnect Meta.

Implementation: `supabase/functions/_shared/metaAdsConfigCrypto.ts` (AES-256-GCM).
