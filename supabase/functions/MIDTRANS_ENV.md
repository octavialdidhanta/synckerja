# Midtrans and subscription edge functions

Set these secrets for each function (or project-wide in Supabase Dashboard → Edge Functions → Secrets):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server only) |
| `MIDTRANS_CLIENT_KEY` | Snap client key |
| `MIDTRANS_SERVER_KEY` | Midtrans server key (SB-Mid-* for sandbox) |
| `APP_BASE_URL` | Public app origin, no trailing slash (e.g. `https://yourapp.com` or `http://localhost:5173`) |

Midtrans Dashboard → Settings → **Payment Notification URL** should point to **`midtrans-webhook`** (verifies Midtrans `signature_key`, then forwards to `process-midtrans-payment`):

`https://<project-ref>.supabase.co/functions/v1/midtrans-webhook`

You can still call `process-midtrans-payment` directly for debugging; production traffic should use `midtrans-webhook`.

Optional secret for dashboard/sandbox tests without a valid signature: `MIDTRANS_WEBHOOK_SKIP_SIGNATURE=true` (do not use in production).

Deploy:

```bash
supabase functions deploy get-midtrans-config create-midtrans-payment process-midtrans-payment midtrans-webhook check-midtrans-payment-status calculate-prorate get-midtrans-snap-token cancel-pending-payment
```
