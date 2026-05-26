# Google Ads API — Compliance addendum (multi-tenant Synckerja)

**Draft for email to Google Ads API compliance** — send after per-tenant MVP is deployed.

---

**Subject:** Update to Synckerja Google Ads API integration — multi-tenant architecture

Dear Google Ads API Compliance Team,

We previously described our integration as a single Google Ads customer for vialdi.id’s internal CRM. We are writing to clarify the **production architecture** now that Synckerja serves multiple organizations (tenants) on one platform.

## What changed

1. **One developer token** and **one GCP OAuth client** remain platform-wide (operated by vialdi.id / Synckerja).
2. **Each Synckerja organization** connects its **own** Google account via OAuth 2.0 (offline refresh token). Tokens are stored **encrypted** in our database and used only in server-side Edge Functions.
3. **Each organization** configures its own Google Ads **customer ID(s)** and **conversion action ID(s)**. Multiple brands per org are supported; uploads default to one account with optional per-lead override.
4. **No cross-tenant access:** API calls always use the refresh token and customer IDs belonging to the organization that owns the lead. Tenant A cannot upload to tenant B’s Ads account.
5. **End users** of Synckerja are our customers’ employees (agencies and advertisers), not the general public. OAuth consent is shown only to admins connecting their org’s Google Ads.

## What did not change

- Tool purpose: offline conversion upload when CRM leads become **Converted** (enhanced conversions + gclid when present).
- No resale of Google Ads API access as a standalone product.
- Credentials and developer token are not exposed to browsers.

## Agency use (vialdi.id)

When vialdi.id staff manage a **client’s** Synckerja organization, offline conversions for that org must use the **client’s** Google OAuth connection and customer IDs, not vialdi’s personal Ads login, unless the conversion action belongs to vialdi’s own account.

Please let us know if you need an updated design document PDF or a short demo video.

Regards,  
[Contact name]  
vialdi.id / Synckerja
