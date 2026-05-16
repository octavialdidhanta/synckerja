# Customer Survey (WhatsApp) — deploy notes

Single Vite build serves the **main app** and **anonymous survey pages** at `/s/:token` (and `/s/:token/thanks`). Optionally you can still mount a **hostname-only** mini-app via `main.tsx` when `VITE_PUBLIC_SURVEY_HOSTNAME` is set (separate subdomain).

Source lives under `src/customer-survey/` (import as `@/features/customer-survey/...` per existing Vite/tsconfig alias).

## Single domain (recommended for `https://office.example.com`)

1. **Do not set** `VITE_PUBLIC_SURVEY_HOSTNAME` to your primary Office hostname (that would replace the whole app with the survey shell).
2. Set **`VITE_PUBLIC_SURVEY_ORIGIN`** = your production origin, e.g. `https://office.example.com` (no trailing slash).
3. Set Edge secret **`SURVEY_PUBLIC_ORIGIN`** to the **same** origin so WhatsApp links match the SPA routes.
4. SPA hosting must already return `index.html` for deep links — `/s/…` uses the same fallback as other routes.

Survey routes are registered **before** `RequireAuth` in `App.tsx` so customers stay anonymous.

## Optional: survey-only subdomain

1. Point subdomain (e.g. `survey.example.com`) to the **same** static hosting / CDN as the main app.
2. Set **`VITE_PUBLIC_SURVEY_HOSTNAME`** = that hostname so `main.tsx` mounts `SurveyPublicApp` (minimal bundle path).
3. Set **`VITE_PUBLIC_SURVEY_ORIGIN`** (and **`SURVEY_PUBLIC_ORIGIN`**) to **that** origin if links should use the subdomain.

## DNS & hosting

1. **Single domain:** DNS unchanged; ensure `/s/*` → `index.html` like any SPA route.
2. **Subdomain:** `CNAME` to the same CDN/origin as the main app.

## Frontend env (`*.env` / CI)

| Variable | Purpose |
|----------|---------|
| `VITE_PUBLIC_SURVEY_ORIGIN` | Origin used in **settings preview** and should match WhatsApp link base / `SURVEY_PUBLIC_ORIGIN`. Example single-domain: `https://office.example.com`. |
| `VITE_PUBLIC_SURVEY_HOSTNAME` | Optional. If set, `main.tsx` serves **only** `SurveyPublicApp` on this hostname (subdomain deployments). Leave unset for single-domain `/s/*` on the main host. |

## Supabase Edge Function `dispatch-customer-survey-wa`

Deploy with JWT verification **off** (see `supabase/config.toml`):

```bash
supabase functions deploy dispatch-customer-survey-wa --no-verify-jwt
```

### Secrets (project settings)

| Secret | Purpose |
|--------|---------|
| `SURVEY_PUBLIC_ORIGIN` | Base URL for links in outbound WhatsApp text, e.g. `https://survey.example.com` (no trailing slash). |
| `CUSTOMER_SURVEY_DISPATCH_SECRET` | Shared secret for scheduled invokes. |

Default secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available to Edge Functions.

### Schedule (recommended)

Supabase Dashboard → **Edge Functions** → **Schedules**: call `dispatch-customer-survey-wa` every minute with:

- Method: `POST`
- Body: `{}` or `{ "action": "cron_tick" }`
- Header: `x-customer-survey-dispatch-secret: <CUSTOMER_SURVEY_DISPATCH_SECRET>`

This drains `customer_survey_invitations` rows in `pending_send` and sends plain-text messages via **Meta Graph API** (bypasses the agent `send-whatsapp-message` resolve guard).

## Database

Apply migration `20260518100000_customer_survey_wa.sql` (tables, RLS, RPCs, enqueue trigger on `whatsapp_conversations.lead_status_id`).

## Operational checklist

- [ ] WhatsApp account connected per org; conversations have `phone_number_id` + `customer_wa_id`.
- [ ] Organization owner or omnichannel admin enables survey and saves copy under `/omnichannel/settings/survey`.
- [ ] Cron/schedule running so invitations leave `pending_send`.
- [ ] `SURVEY_PUBLIC_ORIGIN` matches the URL customers open (same origin as `VITE_PUBLIC_SURVEY_ORIGIN` for single-domain setups).
