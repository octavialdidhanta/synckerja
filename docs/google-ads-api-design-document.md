# Synckerja – Google Ads Offline Conversion Integration

**Design Documentation** (Google Ads API Basic Access – Question 7)

| | |
|---|---|
| **Company** | vialdi.id |
| **Date** | May 2026 |
| **Contact** | papadhanta@gmail.com |

> Export this file to PDF (Google Docs / Word) before uploading to the Google Ads API Token Application form.  
> Sample reference: [Google Ads API design doc samples](https://developers.google.com/google-ads/api/docs/developer-token/design-doc-samples)

---

## 1. Purpose

Synckerja is an internal CRM and operations platform used by vialdi.id. When a sales lead’s status is changed to **Converted** in the Leads Management module (`/omnichannel/leads`), the system automatically reports that conversion to **Google Ads** using the **Google Ads API** offline click conversion upload feature.

This allows us to:

- Attribute offline sales/leads to Google Ads clicks (via **gclid** when available)
- Improve measurement using **enhanced conversions for leads** (hashed email and phone)
- Optimize our own Google Ads campaigns for customer **711-398-0725**

The integration was initially built for **vialdi.id’s own Google Ads account**. As of May 2026 (v2), Synckerja supports **per-organization Google Ads connections** on the same platform developer token (see §10).

---

## 2. Users and Access

- **Users:** Internal employees only (sales, marketing, operations)
- **Access:** Authenticated Synckerja web application; no public or client-facing Google Ads API access
- **Google Ads account:** Single customer ID (`7113980725`) configured server-side

---

## 3. High-Level Architecture

```
[Employee] → [Synckerja Web App (React)]
                ↓ (status → Converted)
           [Supabase Edge Function: google-ads-upload-offline-conversion]
                ↓ OAuth 2.0 (refresh token) + Developer Token
           [Google Ads API v24 – uploadClickConversions]
                ↓
           [Google Ads – Offline Conversion action]
```

| Component | Role |
|-----------|------|
| Synckerja frontend | CRM UI; user sets lead status to Converted |
| `createConvertedSalesActivity` | Business logic after conversion (sales activity) |
| Edge Function | Server-side upload to Google; secrets never exposed to browser |
| PostgreSQL | Stores leads (`gclid`, attribution), upload log (`google_ads_conversion_uploads`) |
| Google Ads API | Receives conversion events |

**Related implementation:**

- Edge Function: `supabase/functions/google-ads-upload-offline-conversion/`
- Client trigger: `src/shared/lib/kickGoogleAdsConversionAfterConverted.ts`
- Migration: `supabase/migrations/20260528140000_google_ads_conversion_uploads.sql`

---

## 4. Authentication and Credentials

All credentials are stored as **Supabase Edge Function secrets** (server-side only):

| Secret | Purpose |
|--------|---------|
| `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` | OAuth 2.0 web client |
| `GOOGLE_ADS_REFRESH_TOKEN` | Long-lived token for API access |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token |
| `GOOGLE_ADS_CUSTOMER_ID` | `7113980725` |
| `GOOGLE_ADS_CONVERSION_ACTION_ID` | Offline conversion action ID |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (optional) | MCC manager customer ID |
| `GOOGLE_ADS_API_VERSION` (optional) | Default `v24` |

**Flow:**

1. Edge Function exchanges refresh token for short-lived access token (`https://oauth2.googleapis.com/token`)
2. API calls use headers: `Authorization: Bearer`, `developer-token`, optional `login-customer-id` for MCC

End users never see Google OAuth tokens or the developer token.

---

## 5. API Methods Used

| API | Usage |
|-----|--------|
| `POST .../customers/{customerId}:uploadClickConversions` | Upload one conversion per converted lead |
| `GET .../customers:listAccessibleCustomers` | Diagnostics only (optional, on errors) |
| OAuth 2.0 token endpoint | Refresh access token |

**API version:** v24 (configurable via `GOOGLE_ADS_API_VERSION`)

We do **not** use: campaign management at scale, keyword editing, App Conversion Tracking, or Remarketing API.

---

## 6. Data Sent to Google Ads

Per conversion upload:

| Field | Source |
|-------|--------|
| `gclid` / `gbraid` / `wbraid` | `leads.gclid` or `leads.attribution` JSON |
| `conversionDateTime` | `leads.converted_at` (Asia/Jakarta) |
| `conversionValue` | `sales_activities.total_amount` (currency IDR) |
| `conversionAction` | Configured conversion action resource name |
| `userIdentifiers` (hashed) | Email and phone from `lead_submissions`; normalized and **SHA-256** per Google enhanced conversions spec |

**Not sent:** raw passwords, full payment details, or unrelated PII.

Upload is **idempotent per lead** (one row per `lead_id` in `google_ads_conversion_uploads`).

---

## 7. Trigger and Error Handling

1. User changes lead status to **Converted** (table, WhatsApp livechat, or email channel).
2. After sales activity is created successfully, frontend invokes Edge Function (fire-and-forget).
3. Function validates user JWT and organization access.
4. On success: log `status = success` in database; UI shows **Berhasil**.
5. On failure: log `status = failed` with `error_message`; CRM conversion is **not** rolled back.
6. Skipped when no gclid and no hashable contact: `status = skipped`.

---

## 8. Security and Compliance

- Secrets only on server; HTTPS for all external calls
- RLS on upload log table; writes via service role in Edge Function
- Data used in compliance with Google Ads policies and customer data terms
- Internal tool; no resale of API access

---

## 9. Expected Volume

- Low to moderate: conversions only when leads are manually marked Converted
- Typically **under 1,000 uploads per month** for our account
- One API request per conversion event

---

## 10. Multi-tenant architecture (v2)

| Layer | Responsibility |
|-------|----------------|
| Platform | One `GOOGLE_ADS_DEVELOPER_TOKEN`, one GCP OAuth client, `GOOGLE_ADS_CONFIG_ENCRYPTION_KEY` |
| Per organization | OAuth refresh token (encrypted), optional MCC `login_customer_id`, `is_active` toggle |
| Per brand | Rows in `organization_google_ads_accounts` (customer ID + conversion action ID; one default) |
| Per lead | Optional `google_ads_account_id` override |

**OAuth flow:** Admin opens `/omnichannel/settings/google-ads` → `google-ads-oauth-start` → Google consent → `google-ads-oauth-callback` stores encrypted refresh token → settings UI manages accounts.

**Upload path:** `google-ads-upload-offline-conversion` resolves org connection + account (lead override → default) → `uploadClickConversions` (API v24).

**Tenant isolation:** Edge Functions use service role to read only the requesting org’s token and account rows; no cross-org customer IDs.

**Agency note:** When vialdi.id operates a client org in Synckerja, the client org must complete **Connect with Google** using the **client’s** Google account that has access to the target customer IDs.

---

## 11. Summary

Synckerja uploads **offline click conversions** to Google Ads when CRM leads convert. v2 adds **per-organization OAuth** and **multi-brand accounts** on one platform developer token. The design remains server-side, internal-only, and limited to conversion upload.

---

*End of document*
