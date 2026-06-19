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
- [ ] **Disburse via Xendit** — preview batch (nama, bank, THP), saldo CASH vs total, **OTP 2FA inline** di dialog setelah confirm
- [ ] Owner/admin tanpa MFA enrolled → tombol Disburse disabled; HR tidak melihat tombol
- [ ] Brick disburse **tidak** tampil di payroll calculations
- [ ] Saldo CASH < total THP pending → tombol confirm disabled
- [ ] Calc `processing` → Mark as Paid terkunci; banner disbursing
- [ ] Webhook/poll selesai → calc `paid`; semua paid → run `paid` otomatis
- [ ] Calc `failed` → Retry per baris; run tetap `calculated` jika ada gagal
- [ ] Preflight process: rekening kosong → warning (boleh process); disburse gate di preview
- [ ] Mark as Paid manual — payment_status paid, run status paid (saat tidak ada processing)
- [ ] Audit log: calculated, export_bank, marked_paid, xendit_disburse_batch, **payslip_notified**

## Payroll statutory escrow (Xendit)

Apply migration `20260826120000_payroll_xendit_escrow.sql`.

- [ ] Default OFF — tenant tanpa settings tidak terpengaruh
- [ ] Payroll sidebar: toggle escrow + picker sub-account (non-primary, active)
- [ ] Save settings → Owner/Admin + MFA; `organization_payroll_escrow_settings` updated
- [ ] Escrow ON → **Mark as Paid** hidden; copy hint di settings
- [ ] Disburse preview: saldo **CASH Operasional (Utama)** vs THP (bukan aggregate escrow)
- [ ] Subtext reserved escrow muncul jika saldo escrow > 0
- [ ] All calcs paid → run `paid` → auto transfer PPh21 + BPJS ke escrow sub-account
- [ ] `payroll_xendit_escrow_transfers` satu row per run; `completed` on success
- [ ] Jumlah escrow ≈ sum PPh/BPJS dari `payroll_items` (bukan total potongan termasuk pinjaman)
- [ ] Insufficient primary CASH setelah THP → transfer `failed`, run tetap `paid`, banner + retry
- [ ] Retry transfer → MFA → `completed` setelah top-up
- [ ] Idempotency: webhook/finalize duplikat tidak double transfer
- [ ] Audit: `payroll_escrow_transfer`, `_failed`, `_skipped`
- [ ] History panel + banner di Payroll Calculations untuk run terpilih
- [ ] Tenant B escrow OFF → zero side effects

See `docs/payroll-escrow-runbook.md`.

## Payroll THP → Expense Dashboard (Xendit)

Apply migration `20260827120000_payroll_thp_expense.sql`.

- [ ] Default OFF — tenant tanpa settings tidak terpengaruh
- [ ] Payroll sidebar: toggle **Post THP ke Expense** + save (Owner/Admin + MFA)
- [ ] Org punya tipe **Fixed Expenses** + kategori **Gaji Karyawan Tetap**
- [ ] Disburse run via Xendit → all paid → expense muncul di `/expenses/dashboard`
- [ ] Amount ≈ SUM THP paid calcs; department Finance; withdrawal = Xendit
- [ ] Filter chip **Payroll** + badge pada baris; link ke `/payroll/calculations?run={id}`
- [ ] Edit/delete diblok untuk baris payroll (UI + DB trigger)
- [ ] Idempotency: finalize/webhook duplikat tidak double expense
- [ ] Settings OFF → zero side effects
- [ ] Missing category → audit `payroll_expense_post_failed`, banner merah, run tetap paid
- [ ] Gateway wallet tidak double-debit (skip trigger saat disburse completed)

See `docs/payroll-thp-expense-runbook.md`.

## Payroll paid notifications

- [ ] Webhook calc `paid` → email Resend (jika ada email) + audit `payslip_notified`
- [ ] Home banner emerald di bawah greeting 24 jam; dismissable; tanpa nominal THP di banner
- [ ] Mark as Paid manual → `notify-payroll-paid-batch` → notifikasi sama per karyawan paid
- [ ] Karyawan tanpa email → banner in-app tetap muncul (jika punya user_id)
- [ ] Webhook duplikat → tidak double email (idempotency audit)

## Payslip

- [ ] HR download PDF dari detail (paid only)
- [ ] Karyawan `/profile/payslips` — hanya paid, tidak lihat pending
- [ ] payout_snapshot di slip = rekening saat calc

## THR

- [ ] Periode `is_bonus_period` + komponen THR manual → masuk gross
- [ ] THR otomatis (org mode proportional/full) pada bonus period tanpa komponen THR

## Unit tests

- [ ] `npm run test -- src/shared/lib/payroll` — all pass (≥25 tests)
