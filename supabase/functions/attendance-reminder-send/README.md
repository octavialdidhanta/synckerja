# attendance-reminder-send

Membaca **attendance_reminder_queue** yang `scheduled_at <= now()` dan `sent_at IS NULL`, mengirim FCM push ke token context `general`, lalu update `sent_at`. Dipanggil dari **cron eksternal** setiap 5–10 menit.

## Perilaku

- Query queue: `scheduled_at <= now()`, `sent_at IS NULL`, limit 200.
- Untuk setiap baris: ambil FCM token (`fcm_tokens`, context `general`), ambil nama dari `employees.full_name`, bangun pesan dari template (before = pengingat absen, after = belum absen) dengan variabel userName, scheduleName, startTime.
- Kirim FCM (title "Pengingat Absen", data `openNotifications: "true"`, `url: "/"` agar tap buka app ke home/absen).
- Update `sent_at`; jika FCM return 404/400, hapus token dari `fcm_tokens`.

## Deploy

```bash
supabase functions deploy attendance-reminder-send --no-verify-jwt
```

## Secrets

Set di Edge Function (sama seperti `app-notifications-send-push`):

- **FCM_SERVICE_ACCOUNT_JSON** (wajib): Firebase service account JSON string.
- **FCM_PROJECT_ID** (opsional): Override project ID jika tidak ada di JSON.

## Pemanggilan (cron eksternal)

Panggil dengan **Service Role Key** sebagai Bearer token. Setiap **5–10 menit**:

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/attendance-reminder-send" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

Atau GET:

```bash
curl "https://<PROJECT_REF>.supabase.co/functions/v1/attendance-reminder-send" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

### Opsi cron

- **cron-job.org** – Buat job dengan URL di atas, schedule setiap 5 atau 10 menit.
- **GitHub Actions** – Workflow scheduled yang curl ke URL di atas (simpan Service Role Key di Secrets).

## Response

- `200`: `{ "ok": true, "sent": N, "processed": P, "removedTokens": M }` – P baris diproses, N notifikasi terkirim, M token invalid dihapus.
- `200`: `{ "ok": true, "sent": 0, "removedTokens": 0 }` – Tidak ada yang perlu dikirim.
- `401`: Missing/Invalid Authorization.
- `500`: FCM_SERVICE_ACCOUNT_JSON tidak set atau error lain.

## Client (Android / app)

Tidak ada perubahan: token FCM tetap disimpan dengan context `general` (useAppNotificationsFCM). Tap push dibuka ke home/absen oleh usePushNotificationHandlers. Pastikan payload memakai `openNotifications: "true"` dan `url: "/"`.
