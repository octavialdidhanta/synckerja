# Synckerja – Google Ads API Integration

**Design Documentation** (Google Ads API Basic Access – Question 7 · OAuth scope justification)

| | |
|---|---|
| **Product** | Synckerja (multi-tenant B2B operations platform) |
| **App URL** | https://office.synckerja.com |
| **Company** | vialdi.id |
| **Date** | May 2026 |
| **Contact** | papadhanta@gmail.com |

> Export this file to PDF (Google Docs / Word) before uploading to the Google Ads API Token Application form or attaching to OAuth verification.  
> Sample reference: [Google Ads API design doc samples](https://developers.google.com/google-ads/api/docs/developer-token/design-doc-samples)

---

## 1. OAuth scope justification (Google Cloud Console)

Text submitted for `https://www.googleapis.com/auth/adwords` verification:

> Synckerja is a multi-tenant operations platform where each organization runs CRM, marketing, and business workflows in one dashboard. Admins connect Google Ads via OAuth only when they choose "Connect Google Ads."
>
> We use https://www.googleapis.com/auth/adwords to: (1) store an encrypted per-organization refresh token server-side; (2) display Google Ads cost and campaign metrics inside Synckerja so teams can review ad spend without leaving our app; (3) upload offline conversions when CRM leads convert, linking ad spend to outcomes for ROI measurement.
>
> We do not sell data or bulk-manage unrelated ad accounts. This scope is required because the Google Ads API does not offer a narrower OAuth scope for reporting and conversion upload.

The sections below expand on this justification for engineering review, API token application, and security assessment.

---

## 2. Purpose and product overview

Synckerja (https://office.synckerja.com) is a **multi-tenant operations platform** where each organization runs CRM, marketing, and business workflows in **one dashboard** so teams do not need to switch between multiple tools.

Organization administrators connect Google Ads via OAuth **only when they choose “Connect Google Ads”** in settings (`/omnichannel/settings/google-ads`). The connecting Google account must already have access to the target Google Ads customer IDs.

**Scope usage in product:**

1. **Encrypted per-organization refresh token** — stored server-side (Supabase Edge Functions); never exposed in the browser.
2. **Cost and campaign metrics** — displayed at `/digital-marketing/google-ads` for connected accounts.
3. **Offline conversion upload** — when CRM leads are marked **Converted**, linking ad spend to business outcomes for ROI measurement.

We do **not** sell Google Ads data, access unrelated Google services, or bulk-manage unrelated ad accounts (no automated mass campaign/keyword editing).

---

## 3. Users and Access

| Aspect | Detail |
|--------|--------|
| **Tenancy** | One Synckerja deployment; many organizations (tenants) with isolated data |
| **Who connects Google Ads** | Organization administrators via `/omnichannel/settings/google-ads` |
| **Who views metrics** | Authenticated org members with Digital Marketing / Google Ads access |
| **Who triggers conversions** | Sales/marketing users marking leads **Converted** in CRM (`/omnichannel/leads` and related channels) |
| **Access model** | Authenticated web app only; API calls are server-side; no public or resale API access |
| **Google Ads accounts** | Per organization: one OAuth connection, multiple customer IDs (brands) in `organization_google_ads_accounts` |

---

## 4. High-Level Architecture

```
[Org admin] → Connect Google Ads (/omnichannel/settings/google-ads)
                ↓ google-ads-oauth-start → Google consent → google-ads-oauth-callback
           [Encrypted refresh token per organization in PostgreSQL]

[Marketing user] → Google Ads metrics UI (/digital-marketing/google-ads)
                ↓ google-ads-metrics (GAQL, cached)
           [Google Ads API v24 – reporting: cost, clicks, conversions, etc.]

[Sales user] → Lead status → Converted (/omnichannel/leads)
                ↓ google-ads-upload-offline-conversion
           [Google Ads API v24 – uploadClickConversions]
```

| Component | Role |
|-----------|------|
| Synckerja frontend (React) | Settings UI, metrics dashboard, CRM lead conversion |
| `google-ads-oauth-start` / `google-ads-oauth-callback` | OAuth 2.0 + PKCE; store encrypted refresh token |
| `google-ads-config` | Settings CRUD, list customers/conversion actions, sync accessible accounts |
| `google-ads-metrics` | Campaign / ad group / ad / keyword reporting via GAQL |
| `google-ads-upload-offline-conversion` | Offline click conversion upload on lead converted |
| PostgreSQL | Org connections, accounts, metrics cache, conversion upload log |
| Google Ads API | Reporting and conversion events |

**Related implementation:**

| Area | Path |
|------|------|
| Metrics UI | `src/6-0-google-ads/pages/GoogleAdsMetricsPage.tsx` |
| Settings UI | `src/google-ads/settings/GoogleAdsSettingsShell.tsx` |
| Conversion trigger | `enqueue_google_ads_conversion_pending` RPC + `google-ads-upload-pending-conversions` (pg_cron) |
| Edge Functions | `supabase/functions/google-ads-*` |
| Migrations | `organization_google_ads_*`, `google_ads_conversion_uploads`, metrics schema |

---

## 5. Authentication and Credentials

All platform secrets are stored as **Supabase Edge Function secrets** (server-side only):

| Secret | Purpose |
|--------|---------|
| `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` | OAuth 2.0 web client (“Google Ads Offline Conversion”) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Platform Google Ads API developer token |
| `GOOGLE_ADS_CONFIG_ENCRYPTION_KEY` | AES key for per-org refresh tokens (32-byte) |
| `GOOGLE_ADS_OAUTH_REDIRECT_URI` | Optional; default `{SUPABASE_URL}/functions/v1/google-ads-oauth-callback` |
| `APP_PUBLIC_URL` | App origin for post-OAuth redirect (e.g. `https://office.synckerja.com`) |
| `GOOGLE_ADS_API_VERSION` | Optional; default `v24` |

**OAuth flow:**

1. Admin clicks **Connect Google Ads** → `google-ads-oauth-start` returns Google authorize URL (`scope=adwords`, PKCE).
2. Google redirects to `google-ads-oauth-callback` → token exchange → encrypted refresh token stored per organization.
3. Edge Functions exchange refresh token for short-lived access tokens (`https://oauth2.googleapis.com/token`).
4. API calls use headers: `Authorization: Bearer`, `developer-token`, optional `login-customer-id` for MCC.

End users never see OAuth refresh tokens or the developer token.

---

## 6. API Methods Used

| API / endpoint | Usage |
|----------------|--------|
| `POST .../customers/{customerId}:uploadClickConversions` | One conversion per converted CRM lead |
| `POST .../customers/{customerId}/googleAds:searchStream` (GAQL) | Metrics reporting (cost, impressions, clicks, conversions, etc.) |
| `GET .../customers:listAccessibleCustomers` | Sync linked customer IDs after OAuth |
| OAuth 2.0 token endpoint | Refresh access token |

**API version:** v24 (configurable via `GOOGLE_ADS_API_VERSION`)

**Reporting entities:** campaign, ad_group, ad, keyword — with user-selectable metrics (max 50 per request), column presets, and 10-minute server cache.

**We do not use:** bulk automated campaign/keyword management, App Conversion Tracking API, Remarketing API, or resale of API access.

---

## 7. Metrics and ROI Use Case

Authorized users open **Digital Marketing → Google Ads** (`/digital-marketing/google-ads`) to:

- View **cost / spend**, impressions, clicks, conversions, and other GAQL metrics for connected customer IDs
- Filter by date range, campaign, ad group, and status
- Customize columns and save presets per organization

This keeps **advertising cost visible alongside other operational data** in Synckerja. Combined with offline conversion uploads (lead → Converted), teams can relate ad spend to CRM outcomes for ROI analysis.

**Note:** Synckerja does not automatically write Google Ads spend into the Expense module today; cost is read from Google Ads reporting inside the app dashboard.

---

## 8. Offline Conversion Upload

When a sales lead is **Converted** and a **qualifying payment** (down payment or full) is recorded:

| Field | Source |
|-------|--------|
| `gclid` | `leads.gclid` or `leads.attribution` JSON (**required**) |
| `conversionDateTime` | `leads.payment_at` (Asia/Jakarta) |
| `conversionValue` | First `sales_activity_payments.payment_amount` (DP/full), else `sales_activities.down_payment_amount` / `total_amount` |
| `conversionAction` | `organization_google_ads_accounts.conversion_action_id` (UI: `/omnichannel/settings/offline-conversion`) |
| `userIdentifiers` (hashed) | Email and phone from `leads`, `lead_submissions`, or `lead_client_profiles`; SHA-256 per enhanced conversions spec |

**Not sent:** raw passwords, full payment details, or unrelated PII.

Upload is **idempotent per lead** (one row per `lead_id` in `google_ads_conversion_uploads`).

**Deferred trigger flow:**

1. User converts lead with payment (livechat, table, or public API invoice).
2. App calls RPC `enqueue_google_ads_conversion_pending` → sets `leads.payment_at`, audit `status = pending`.
3. **pg_cron** hourly invokes `google-ads-upload-pending-conversions`.
4. Batch uploads when `payment_at` is at least **5 hours** ago (avoids `UNREGISTERED_CLICK`).
5. On success: `status = success`; on API failure: `status = failed` (auto-retry up to 5 attempts).
6. Skipped when no `gclid`: no enqueue / `skip_reason = no_gclid`.
7. Converted **without** payment: not queued for Google Ads upload.

**Scheduler auth (pg_cron + manual invoke):**

- Vault secrets: `google_ads_scheduler_project_url`, `google_ads_scheduler_service_role_key`
- Use **secret key** (`sb_secret_...`) on projects with Supabase new API keys; legacy JWT may not match Edge runtime
- pg_cron RPC sends `Authorization: Bearer` and `apikey` headers to `google-ads-upload-pending-conversions`
- Rollout checklist: [`google-ads-deferred-rollout-checklist.md`](./google-ads-deferred-rollout-checklist.md)

---

## 9. Multi-Tenant Architecture

| Layer | Responsibility |
|-------|----------------|
| Platform | One `GOOGLE_ADS_DEVELOPER_TOKEN`, one GCP OAuth client, `GOOGLE_ADS_CONFIG_ENCRYPTION_KEY` |
| Per organization | OAuth refresh token (encrypted), optional MCC `login_customer_id`, `is_active` toggle |
| Per brand | Rows in `organization_google_ads_accounts` (customer ID + conversion action ID; one default) |
| Per lead | Optional `google_ads_account_id` override |

**Tenant isolation:** Edge Functions use service role to read only the requesting organization’s token and account rows; no cross-org customer IDs.

**Agency note:** When an agency operates a client org in Synckerja, the client org must complete **Connect Google Ads** using the **client’s** Google account that has access to the target customer IDs.

---

## 10. Security and Compliance

- All Google Ads API calls are **server-side only**; HTTPS for external calls
- Per-organization refresh tokens **encrypted at rest**
- RLS on org-scoped tables; Edge Functions validate JWT + org membership
- Data used in compliance with Google Ads API policies, OAuth policies, and customer data terms
- No sale of user or Google Ads data; no third-party ad account access without explicit OAuth by the account owner

---

## 11. Expected Volume

| Activity | Volume |
|----------|--------|
| Conversion uploads | Low to moderate — only when leads are manually marked Converted; typically under 1,000/month platform-wide initially |
| Metrics fetches | Moderate — cached 10 minutes per org/customer/entity/query; user-driven dashboard refreshes |
| OAuth connections | One per organization (plus occasional reconnect) |

---

## 12. Summary

Synckerja is a **multi-tenant operations platform** that integrates Google Ads so each organization can:

- **Connect** its own Google Ads account via OAuth (`adwords` scope)
- **Review ad cost and campaign metrics** in the same dashboard as CRM and operations
- **Upload offline conversions** when CRM leads convert, supporting ROI measurement

All access is admin-initiated, server-side, tenant-isolated, and limited to reporting plus conversion upload — not bulk ad management or data resale.

---

## Appendix. Verification test instructions (for Google reviewers)

### 1) Synckerja test account (app login only)

| Field | Value |
|--------|--------|
| App URL | https://office.synckerja.com |
| Email | akhmadzaenudinnn11@gmail.com |
| Password | 
| Organization | Test |
| Role | owner |

Use this account only to **sign in to Synckerja**. It is not required to be the same Google account used for Google Ads OAuth.

### 2) How to verify Google Ads (`adwords`)

1. Sign in to Synckerja with the test account above.
2. Open **Omnichannel → Settings → Google Ads** (`/omnichannel/settings/google-ads`).
3. Click **Connect Google Ads**.
4. When Google OAuth opens, sign in with **any Google account** that has access to a Google Ads customer ID. Reviewers may use their own Google account; it **does not** need to match the Synckerja login email.
5. After consent, open **Digital Marketing → Google Ads** (`/digital-marketing/google-ads`) and confirm cost/campaign metrics load for a connected customer ID.
6. (Optional) In CRM, mark a test lead **Converted** to exercise offline conversion upload if a conversion action is configured.

**OAuth client:** Google Ads Offline Conversion (web).  
**Redirect URI:** `https://<PROJECT_REF>.supabase.co/functions/v1/google-ads-oauth-callback`

### 3) Demo video

**YouTube (unlisted):** https://youtu.be/ewtFNLaKpQw

Shows the same flow as steps 1–5 above: Synckerja login → Connect Google Ads (OAuth) → Google Ads metrics dashboard.

---

*End of document*
