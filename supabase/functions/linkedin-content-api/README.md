# linkedin-content-api

Consolidates four edge functions into one (saves **3 function slots**):

| Old function | New `action` |
|--------------|----------------|
| `linkedin-content-config` | `getSettings`, `getPendingPages`, `completePageConnect`, `disconnect`, `setDefaultAccount`, `deleteAccount` |
| `linkedin-content-oauth-start` | `oauthStart` |
| `linkedin-content-metrics` | `getMetrics` |
| `linkedin-content-oauth-callback` | **GET** with `?code=&state=` (OAuth redirect) |

## Deploy

```bash
npx supabase functions deploy linkedin-content-api --no-verify-jwt --use-api
```

`verify_jwt` must be **false** on this function: LinkedIn OAuth redirect hits **GET** without an `Authorization` header. POST actions still require a valid user JWT inside the handler.

## After deploy — delete old functions (Dashboard → Edge Functions → Delete)

1. `linkedin-content-config`
2. `linkedin-content-metrics`
3. `linkedin-content-oauth-start`
4. `linkedin-content-oauth-callback`

## LinkedIn Developer App

Update **Redirect URL** to:

```
https://<project-ref>.supabase.co/functions/v1/linkedin-content-api
```

(Or set `LINKEDIN_CONTENT_OAUTH_REDIRECT_URI` secret to the same URL.)

## OAuth redirect migration

If users still have the old callback URL registered, add the new URL in LinkedIn app settings before deleting the old function.

## Troubleshooting `invalid_scope_error`

LinkedIn returns this when the app **does not have Community Management API** (Products tab must show **Added**). Until approval, scopes like `r_organization_social` are rejected as invalid — not a Synckerja bug.

1. [Apply for Community Management API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review) on app **Synckerja Content Insight** (`86ai8f4j1twr9q`).
2. Use that app’s Client ID/Secret in Supabase (`LINKEDIN_CONTENT_CLIENT_ID` / `LINKEDIN_CONTENT_CLIENT_SECRET`).
3. After **Added**, retry Connect. Optional override: secret `LINKEDIN_CONTENT_OAUTH_SCOPES` (space-separated, e.g. `r_organization_social rw_organization_admin`).
