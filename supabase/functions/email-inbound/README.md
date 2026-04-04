# Email Inbound (Resend webhook)

Receives Resend `email.received` webhooks when an inbound email is delivered to your domain.

## Deploy

From project root (with Supabase CLI):

```bash
npx supabase functions deploy email-inbound --no-verify-jwt --project-ref <YOUR_PROJECT_REF>
```

Or after `supabase link`: `npx supabase functions deploy email-inbound --no-verify-jwt`.  
`--no-verify-jwt` is required so Resend can POST to the webhook without a JWT.

## Setup

1. In Resend Dashboard → Inbound → add your domain and set **Webhook URL** to:
   `https://<project-ref>.supabase.co/functions/v1/email-inbound`

2. Ensure `organization_email_connections.inbound_address` matches the recipient address Resend sends in `data.to[]` (e.g. `inbound-xxx@chat.yourdomain.com`).

3. When Gmail sends a verification email to that address, this function:
   - Finds the connection by `inbound_address`
   - Creates or reuses an `email_conversation`
   - Inserts an `email_message` with from, to, subject, body
   - Extracts confirmation code from body/subject (e.g. "Kode konfirmasi: 106074202") and stores it on the message and on `organization_email_connections.confirmation_code`

4. Users see the message (and confirmation code) in Live Chat and paste the code into Gmail → Settings → Forwarding and POP/IMAP → Verifikasi.

## Environment

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: set by Supabase; required for DB access.

## Payload

Resend sends `type: "email.received"` and `data`: `email_id`, `from`, `to` (array), `subject`, and optionally `text`/`html` body. If body is not in the webhook, you can call Resend Receiving API with `email_id` to fetch content (not implemented here).
