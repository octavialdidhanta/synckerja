# Operational Email Notifications — deploy notes

Settings UI: `/operations/settings/email-notifications`  
Public verify page: `/verify-operational-email?token=...`

## Prerequisites

1. Personal access token dari [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens) (format `sbp_...`).
2. Secrets di project `wqdzqqshoifwyrltzgvx`:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` (wajib untuk inventory alerts)
3. Migrations applied:
   - `supabase/migrations/20260930500000_operational_email_notifications.sql`
   - `supabase/migrations/20260930652000_operational_inventory_alerts_cron.sql` (daily digest 00:15 WIB)
   - `supabase/migrations/20260930653000_operational_inventory_alert_instant.sql` (instant on stock cross)

## Inventory Alerts behavior

| Mode | When |
|------|------|
| **Instant** | Stock on `catalog_ingredient_outlets` newly enters **low** or **out** → queue job → `dispatch-operational-inventory-alert` |
| **Daily recap** | Cron `operational-inventory-alerts` at **00:15 WIB** → `send-operational-inventory-alerts` |

Toggle **Inventory Alerts** gates both. Instant uses cooldown (1× per ingredient/outlet/status per WIB day). Restock clears cooldown.

## Deploy (PowerShell)

```powershell
cd "D:\Synckerja Office - 11 Juni 2026\synckerja"

$env:SUPABASE_ACCESS_TOKEN = "sbp_PASTE_TOKEN_ANDA_DISINI"

# 0) Link project (sekali saja; db push tidak pakai --project-ref)
npx supabase link --project-ref wqdzqqshoifwyrltzgvx

# 1) Push migration (jika belum di remote)
npx supabase db push

# 2) Deploy edge functions
npx supabase functions deploy send-operational-email-verification `
  --project-ref wqdzqqshoifwyrltzgvx `
  --no-verify-jwt `
  --use-api

npx supabase functions deploy send-operational-inventory-alerts `
  --project-ref wqdzqqshoifwyrltzgvx `
  --no-verify-jwt `
  --use-api

npx supabase functions deploy dispatch-operational-inventory-alert `
  --project-ref wqdzqqshoifwyrltzgvx `
  --no-verify-jwt `
  --use-api
```

Satu baris — **hanya edge function** (setelah project sudah di-link):

```powershell
cd "D:\Synckerja Office - 11 Juni 2026\synckerja"; $env:SUPABASE_ACCESS_TOKEN = "sbp_PASTE_TOKEN_ANDA_DISINI"; npx supabase functions deploy send-operational-email-verification --project-ref wqdzqqshoifwyrltzgvx --no-verify-jwt --use-api
```

> **Catatan CLI:** `supabase db push` **tidak** menerima flag `--project-ref`. Gunakan `supabase link` dulu, lalu `db push` tanpa flag itu.

## Set secrets (jika belum)

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_PASTE_TOKEN_ANDA_DISINI"

npx supabase secrets set RESEND_API_KEY=re_xxxx RESEND_FROM_EMAIL=noreply@domainanda.com `
  --project-ref wqdzqqshoifwyrltzgvx
```

## Post-deploy check

1. Dashboard → **Edge Functions** → `send-operational-email-verification`, `send-operational-inventory-alerts`, `dispatch-operational-inventory-alert` ada & latest deploy sukses.
2. App → **Settings → Email Notification → Add Email Recipient** → email verifikasi terkirim.
3. Klik link di email → `/verify-operational-email?token=...` → status **Verified**.
4. Turunkan stok ingredient ke 0 (atau di bawah alert) → cek `operational_inventory_alert_jobs` status `sent` + inbox (bukan spam).
5. Turunkan lagi hari yang sama → tidak spam (cooldown).
6. QA SQL: `scripts/qa/verify-inventory-alerts-email.sql`

## Catatan

- `verify_jwt = false` terdaftar di `supabase/config.toml` (sama pola dengan `send-confirmation-email`).
- Instant invoke memakai Vault secrets yang sama dengan daily sales (`operational_daily_sales_project_url` / `_service_role_key`).
- Menu recipe OOS hanya di **daily recap**, bukan email instant (phase 1).
