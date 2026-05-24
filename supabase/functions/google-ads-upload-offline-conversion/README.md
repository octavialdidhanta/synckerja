# google-ads-upload-offline-conversion

Uploads an offline click conversion to Google Ads when a CRM lead reaches **Converted** (triggered from `createConvertedSalesActivity` via `kickGoogleAdsConversionAfterConverted`).

## Deploy

```bash
supabase link   # if not linked
supabase db push   # applies google_ads_conversion_uploads migration
supabase functions deploy google-ads-upload-offline-conversion
```

## Secrets

- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_CUSTOMER_ID`
- `GOOGLE_ADS_CONVERSION_ACTION_ID`
- Optional: `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (MCC manager)
- Optional: `GOOGLE_ADS_API_VERSION` (default `v24`; **do not use v18** — sunset → 404)

## Invoke (authenticated)

```json
POST { "lead_id": "<uuid>", "organization_id": "<uuid>", "sales_activity_id": "<uuid optional>" }
```

## Troubleshooting `CUSTOMER_NOT_FOUND`

- `GOOGLE_ADS_CUSTOMER_ID` must match a customer the **OAuth refresh-token user** can access (Google Ads UI → ID kanan atas, 10 digit tanpa strip).
- If you use a **Manager (MCC)** account, set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the MCC customer ID.
- Re-authorize OAuth with the same Google account that opens that Ads account in the browser.
- After a failed upload, check `error_message` in `google_ads_conversion_uploads` — it may list **accessible customer IDs** for your token.

## Verify

1. Convert a lead with `gclid` and email/phone on `lead_submissions`.
2. Check `google_ads_conversion_uploads` → `status = success`.
3. Google Ads → Goals → Conversions → Offline Conversion (may take 24–48h to show activity).

## Basic Access application (Q7 design doc)

Export to PDF: [`docs/google-ads-api-design-document.md`](../../../docs/google-ads-api-design-document.md)
