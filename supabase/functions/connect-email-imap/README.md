# Email IMAP (Hostinger direct connect)

Connect email without Resend forwarder — Synckerja polls the mailbox via IMAP and sends replies via SMTP.

## Deploy

```bash
supabase functions deploy connect-email-imap --no-verify-jwt
supabase functions deploy email-imap-sync --no-verify-jwt
supabase functions deploy send-email-reply --no-verify-jwt
```

Apply migration `20260831190000_email_imap_connection.sql` in Supabase SQL Editor (or `db push`).

## Secrets

| Secret | Purpose |
|--------|---------|
| `EMAIL_CONNECTION_ENCRYPTION_KEY` | 32-byte key (base64 or 64-char hex) for AES-256-GCM mailbox passwords |
| `EMAIL_IMAP_CRON_SECRET` | Optional header `x-email-imap-cron-secret` for scheduled sync |

Generate key: `openssl rand -hex 32`

## Schedule IMAP sync

Dashboard → Edge Functions → **email-imap-sync** → Schedules: `*/2 * * * *`, POST `{}`, header `x-email-imap-cron-secret`.

## User flow

1. Add email + password + Hostinger (IMAP)
2. Verified immediately after IMAP login succeeds
3. Emails appear in Live Chat after sync
4. Replies use SMTP (smtp.hostinger.com) for IMAP connections
