# Plan Perbaikan — Attendance Rules

**Status: Implemented (Juni 2026)**

## Ringkasan implementasi

| Fase | Status | Deliverable |
|------|--------|-------------|
| 1 — DB + hook + UI | Done | `attendance_rules_settings`, `useAttendanceRulesSettings`, editable `AttendanceRulesSettings` |
| 2 — RPC + clients | Done | Extended `validate_attendance_comprehensive`, `validate_checkout_comprehensive`, `record_attendance_with_timezone` |
| 3 — Auto checkout | Done | `apply_attendance_auto_checkout()` + edge function `attendance-auto-checkout` |
| 4 — QA + cleanup | Done | `scripts/attendance-rules-verify.sql`, removed misleading badges |

## Keputusan desain (final)

- **Weekend:** hanya via `work_schedule_settings.working_days` (tab Work Schedule)
- **Shift override:** assignment shift aktif → `schedule_valid` meski WSS exclude hari itu
- **Radius:** `COALESCE(office.radius_meters, rules.default_max_radius_meters, 100)`
- **Libur nasional:** toggle `enforce_national_holidays` (default `true`)
- **Foto:** `require_photo_checkin` / `require_photo_checkout` terpisah
- **GPS:** `require_gps_accuracy` + `gps_accuracy_threshold_meters` (default off)
- **Auto checkout:** kolom + cron target `apply_attendance_auto_checkout` / edge function

## Verifikasi

```bash
npm run supabase:db:push:attendance-rules-verify
npm test -- src/shared/lib/attendance/attendanceRulesValidation.test.ts
```

## QA checklist

- [ ] Save Attendance Rules → row persist di `attendance_rules_settings`
- [ ] Libur: `enforce_national_holidays=false` → check-in di hari libur allowed
- [ ] GPS: `require_gps_accuracy=true` + accuracy > threshold → blocked
- [ ] Foto check-in/out enforced saat flag ON
- [ ] Shift Sabtu dengan assignment → `schedule_valid=true`
- [ ] Auto checkout edge function deployed + cron scheduled

## Out of scope

- IP address rules (tab terpisah)
- Face recognition ML threshold
- Backfill auto checkout historis
