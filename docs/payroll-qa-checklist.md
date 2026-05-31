# Payroll QA Checklist

Manual verification after deploy or formula changes.

## Deploy smoke

- [ ] `npm run supabase:db:push:payroll-verify` — all RPCs exist, grants OK
- [ ] UI Process Payroll — no 404 on `process_payroll_run`
- [ ] Parameter RPC: `p_run_id` (bukan `run_id`)

## Process run

- [ ] Preflight blocks employee tanpa basic_salary / PTKP / tax_configuration_id
- [ ] Process run → toast success dengan jumlah calculated
- [ ] Re-process run (non-paid) → idempotent replace
- [ ] Paid calculation tidak terhapus saat re-process
- [ ] Paid run tidak bisa di-process ulang
- [ ] UI THP = DB `take_home_pay` (bukan recalc client)

## Penalties

- [ ] Penalty `active` → `paid` saat **calculation** (bukan saat mark paid disbursement)
- [ ] Penalty amount masuk line items + THP
- [ ] `npm run supabase:db:push:penalty-verify` — OCTA 08:20 → Rp 50.000 (5 menit melewati toleransi 15)
- [ ] Aidah check-in 12:50 (shift 13:00) → tidak ada denda otomatis
- [ ] `enable_automatic_penalties` default off di UI jika belum ada row settings
- [ ] Hanya **satu** aturan `late_arrival` aktif per org (hindari double denda); `npm run supabase:db:push:penalty-rules-dedupe` jika perlu

## Overtime (shift break)

- [ ] `npm run supabase:db:push:shift-verify` — OCTA checkout 18:30 → **30 menit** lembur (end 17:00 + break 60)
- [ ] Aidah checkout 18:30 → 0 menit lembur

## Pro-rata

- [ ] Join mid-month (e.g. 9 Mei) → ratio < 1, THP turun
- [ ] Join 1 Mei → ratio = 1
- [ ] `npm run supabase:db:push:prorate-shift-verify` — karyawan dengan shift assignment pakai hari shift-assigned
- [ ] Karyawan tanpa shift assignment → prorate WSS legacy (tidak regress)

## PPh21 modes

- [ ] Annualized gross — golden OCTA 14.200.090, Aidah 8.024.100
- [ ] TER mode — PPh21 berbeda dari annualized pada gross sama
- [ ] gross_up — tax line employer, THP = target
- [ ] netto — THP mendekati target

## Disbursement

- [ ] Export Bank CSV — kolom lengkap, row count = calculations
- [ ] Mark as Paid — payment_status paid, run status paid
- [ ] Audit log: calculated, export_bank, marked_paid

## Payslip

- [ ] HR download PDF dari detail (paid only)
- [ ] Karyawan `/profile/payslips` — hanya paid, tidak lihat pending
- [ ] payout_snapshot di slip = rekening saat calc

## THR

- [ ] Periode `is_bonus_period` + komponen THR manual → masuk gross
- [ ] THR otomatis (org mode proportional/full) pada bonus period tanpa komponen THR

## Unit tests

- [ ] `npm run test -- src/shared/lib/payroll` — all pass (≥25 tests)
