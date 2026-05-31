# attendance-auto-checkout

Menjalankan **`apply_attendance_auto_checkout`** untuk organisasi dengan `auto_checkout_enabled = true`. Mencari record hari ini yang sudah check-in tapi belum check-out; jika waktu lokal org ≥ `auto_checkout_time`, set check-out otomatis (idempotent).

## Deploy

```bash
npm run supabase:functions:deploy:attendance-auto-checkout
# atau
npx supabase functions deploy attendance-auto-checkout --no-verify-jwt
```

## Cron

- **pg_cron** job `attendance-auto-checkout-sql` — setiap **15 menit** memanggil `apply_attendance_auto_checkout(NULL)` (migration `20260607141000`).
- **Edge function** tersedia untuk trigger manual / org tunggal via POST.

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/attendance-auto-checkout" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

Opsional body: `{ "organization_id": "<uuid>" }` untuk satu org saja.

## UI

Aktifkan **Auto Check-out** + atur jam di **Attendance Settings → Attendance Rules** setelah cron/job terpasang.

## Response

- `200`: `{ "ok": true, "result": { "updated": N } }`
- `500`: RPC error
