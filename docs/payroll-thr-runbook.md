# Runbook THR (Manual — Fase 5a)

## THR manual via komponen (recommended untuk go-live awal)

1. **Buat periode bonus**
   - `/payroll/calculations` → sidebar Periods → New Period
   - Centang **Periode Bonus / THR**
   - Set tanggal periode Lebaran (e.g. 1–30 Juni)

2. **Set komponen THR per karyawan**
   - `/my-info/payroll?id={employee_id}`
   - Tambah komponen **Tunjangan THR** (allowance, fixed)
   - Set `payroll_period_id` = periode THR (non-recurring) **atau** amount sesuai kebijakan perusahaan

3. **Proses payroll run**
   - Buat run pada periode THR
   - Process Payroll — THR masuk sebagai allowance + PPh21 dihitung atas gross total

## THR otomatis (Fase 5b)

Setting org `payroll_thr_calculation_mode`:

| Mode | Perilaku |
|------|----------|
| `manual_only` | Hanya komponen manual (default aman) |
| `proportional` | THR = basic × (bulan kerja tahun / 12) |
| `full_month_salary` | THR = 1 × gaji pokok |

THR otomatis hanya ditambahkan jika:
- Periode `is_bonus_period = true`
- Belum ada komponen allowance dengan kategori/nama mengandung "thr"

## QA THR

- [ ] Karyawan join mid-year → THR proporsional (mode proportional)
- [ ] Karyawan ≥12 bulan → THR = 1 × pokok (mode full_month_salary)
- [ ] PPh21 TER/annualized tetap apply pada gross + THR
