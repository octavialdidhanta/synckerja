# attendance-reminder-fill-queue

Mengisi tabel **attendance_reminder_queue** untuk pengingat absensi FCM. Prioritas: **shift** (employee_shifts + shifts) dulu, kalau tidak ada pakai **work schedule** (work_schedule_settings). Tidak mengisi untuk tanggal yang masuk libur nasional/org (aktif). Dipanggil dari **cron eksternal** (mis. 1x sehari).

## Perilaku

- Mengambil daftar organisasi dari `work_schedule_settings` dan `shifts` (is_active).
- Untuk setiap org, untuk **hari ini** dan **besok** (UTC date):
  - Ambil karyawan yang punya `user_id` (terhubung akun).
  - Cek libur: jika tanggal ada di `national_holidays` (is_active, org atau nasional) → skip seluruh tanggal itu untuk org tersebut.
  - Untuk setiap karyawan: resolve jadwal (shift dulu, lalu work schedule). Jika shift: pakai timezone default Asia/Jakarta. Jika work schedule: cek `working_days` dan timezone jadwal.
  - Hitung 4 slot: before_30m, before_15m, after_15m, after_30m dari `start_time` di timezone yang berlaku. Start 00:00 → before = 23:30/23:45 hari sebelumnya.
  - Insert ke `attendance_reminder_queue` dengan `ON CONFLICT (user_id, effective_date, reminder_type) DO NOTHING` (idempotent).

## Deploy

```bash
supabase functions deploy attendance-reminder-fill-queue --no-verify-jwt
```

Tidak butuh secret FCM; hanya akses DB (SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY dari pemanggil).

## Pemanggilan (cron eksternal)

Panggil dengan **Service Role Key** sebagai Bearer token. Disarankan 1x per hari (mis. 00:15 UTC):

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/attendance-reminder-fill-queue" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

Atau GET:

```bash
curl "https://<PROJECT_REF>.supabase.co/functions/v1/attendance-reminder-fill-queue" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

### Opsi cron

- **cron-job.org** – Buat job dengan URL di atas, schedule harian (mis. 00:15 UTC).
- **GitHub Actions** – Workflow scheduled yang curl ke URL di atas (simpan Service Role Key di Secrets).

## Response

- `200`: `{ "ok": true, "orgs": N, "inserted": M, "errors": [] }` – M baris queue di-insert (idempotent, tidak double).
- `401`: Missing/Invalid Authorization.
- `500`: Error database.

## Migration

Pastikan migration **20260319000000_create_attendance_reminder_queue.sql** sudah dijalankan (tabel `attendance_reminder_queue` + unique constraint + index).
