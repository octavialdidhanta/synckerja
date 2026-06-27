# Google Ads Deferred Conversion — Rollout Checklist

Project: `wqdzqqshoifwyrltzgvx`  
Full design: [`google-ads-api-design-document.md`](./google-ads-api-design-document.md)

## Status cepat

| Step | Owner | Done |
|------|-------|------|
| Edge functions deployed | Dev | ☐ |
| Manual invoke OK (`ok:true`) | Ops | ☐ |
| Vault secrets | Ops | ☐ |
| Migration apikey header applied | Dev | ☐ |
| Frontend production deploy | Dev | ☐ |
| Org Google Ads settings | Ops | ☐ |
| E2E lead test | Ops | ☐ |

---

## 1. Vault secrets (pg_cron)

Dashboard → **Project Settings → Vault** (Edge Functions → Secrets / Vault UI).

| Secret name | Value |
|-------------|--------|
| `google_ads_scheduler_project_url` | `https://wqdzqqshoifwyrltzgvx.supabase.co` |
| `google_ads_scheduler_service_role_key` | **Secret key** dari **Settings → API → Secret keys** (`sb_secret_...`) |

**Penting:** Jangan pakai legacy JWT `eyJ...` jika test manual hanya sukses dengan `sb_secret_...`.

Alternatif via SQL Editor (ganti placeholder):

```sql
SELECT vault.create_secret(
  'https://wqdzqqshoifwyrltzgvx.supabase.co',
  'google_ads_scheduler_project_url',
  'Google Ads batch scheduler project URL'
);

SELECT vault.create_secret(
  'PASTE_sb_secret_KEY_HERE',
  'google_ads_scheduler_service_role_key',
  'Google Ads batch scheduler secret key'
);
```

Jika secret sudah ada, update via Dashboard Vault UI atau hapus lalu create ulang.

---

## 2. Verifikasi pg_cron

```sql
-- Job harus ada, schedule hourly
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'google-ads-pending-conversions';

-- Test invoke langsung (setelah Vault terisi)
SELECT public.invoke_google_ads_pending_conversions_edge();

-- Cek run history (opsional)
SELECT *
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'google-ads-pending-conversions')
ORDER BY start_time DESC
LIMIT 5;
```

**Edge Functions → Logs** → `google-ads-upload-pending-conversions`: harus **200**, body `{"ok":true,...}`.

Manual invoke (PowerShell):

```powershell
$secret = "sb_secret_..."   # dari Dashboard → API
curl.exe -i -X POST `
  "https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/google-ads-upload-pending-conversions" `
  -H "Authorization: Bearer $secret" `
  -H "apikey: $secret" `
  -H "Content-Type: application/json" `
  -d "{}"
```

Apply migration apikey header:

```bash
npm run supabase:db:push
```

**Jika `db push` gagal** (migration history mismatch), jalankan isi file berikut di SQL Editor:

`supabase/migrations/20260927140000_google_ads_pending_cron_apikey_header.sql`

Redeploy edge functions setelah auth hardening:

```bash
npm run supabase:functions:deploy:google-ads-pending
npm run supabase:functions:deploy:google-ads
```

---

## 3. Deploy frontend production

Enqueue RPC hanya jalan setelah build ter-deploy:

- [`enqueueGoogleAdsConversionPending.ts`](../src/shared/lib/enqueueGoogleAdsConversionPending.ts)
- Dipanggil dari [`sales.ts`](../src/shared/hooks/organized/sales.ts) saat converted + payment

```bash
npm run build
# deploy artefact ke host production (office.synckerja.com)
```

Env build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → project `wqdzqqshoifwyrltzgvx`.

---

## 4. Prasyarat Google Ads (per org test)

`/omnichannel/settings/offline-conversion`:

1. Google Ads OAuth connected
2. **Conversion action ID** di-set (dari Google Ads UI)
3. **Enable offline conversion uploads** ON
4. Customer ID benar

---

## 5. End-to-end test

### Happy path

1. Lead dengan **gclid** (landing/form tracking)
2. Livechat → **Converted** + **payment** (DP/full)
3. Verifikasi DB:

```sql
SELECT l.id, l.gclid, l.payment_at, u.status, u.upload_attempt_count, u.error_message
FROM leads l
LEFT JOIN google_ads_conversion_uploads u ON u.lead_id = l.id
WHERE l.id = '<lead_id>';
-- payment_at NOT NULL, status = pending
```

4. UI `/omnichannel/leads` → kolom **Google Ads Sync** = **Menunggu**
5. Setelah ≥ 5 jam → cron atau manual batch → **success** / **failed**

### Test cepat (dev/staging)

```sql
UPDATE leads SET payment_at = now() - interval '6 hours' WHERE id = '<lead_id>';
```

Lalu invoke manual batch → `processed >= 1`.

### Kasus negatif

| Skenario | Hasil |
|----------|--------|
| Convert tanpa payment | Tidak enqueue |
| Payment tanpa gclid | RPC false, tidak ada audit row |
| Upload success | Cron skip |
| 5x gagal | failed permanen di UI |

---

## 6. Backfill lead converted lama (opsional)

Google Ads settings → aktifkan offline uploads → **Retry upload for converted leads**.

Memanggil [`retryGoogleAdsUploadsForConvertedLeads`](../src/shared/lib/retryGoogleAdsUploadsForConvertedLeads.ts) dengan `p_force_retry=true`. Hanya lead dengan **gclid** + converted; `payment_at` di-set saat enqueue.

---

## 7. Monitoring

```sql
SELECT status, count(*) FROM google_ads_conversion_uploads GROUP BY status;

SELECT * FROM google_ads_conversion_uploads
WHERE status = 'failed' AND upload_attempt_count >= 5
ORDER BY updated_at DESC;
```

Edge logs + `cron.job_run_details` untuk batch hourly.
