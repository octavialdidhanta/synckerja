# Perbaikan pembuatan payroll run

Tanggal: 2 November 2026.

## Ringkasan

Tombol **Create Payroll Run** tidak lagi memanggil `calculate_payroll_run_totals`. Fungsi itu sekarang hanya boleh dipanggil server. Panggilan dari aplikasi akan ditolak, dan yang tampil hanya peringatan.

Perhitungan gaji tidak dihilangkan. Total diisi saat pengguna menekan tombol proses pada kartu run.

## Yang diubah

File: `src/2-4-payroll/modals/CreatePayrollRunDialog.tsx`

Yang dihapus:

- panggilan `.rpc("calculate_payroll_run_totals")` sesudah run tersimpan
- peringatan "Payroll run dibuat, tetapi totals belum dihitung..."

Yang tetap:

- run baru tersimpan sebagai draft
- toast "Payroll run created successfully"
- daftar run diperbarui

Tampilan kartu run tidak diubah. `src/2-4-payroll/components/overview/PayrollRunsOverview.tsx` sudah menampilkan `null` dan `0` sebagai **Rp 0** pada Gross Pay, Deductions, dan Net Pay.

## Alur sesudah perbaikan

1. Pengguna membuat payroll run. Run tersimpan sebagai draft. Total masih **Rp 0**.
2. Pengguna menekan tombol proses pada kartu run.
3. Aplikasi memanggil `process_payroll_run`. Pengguna yang login masih boleh memanggilnya bila role-nya owner, admin, atau HR di organisasi itu.
4. Server menghitung gaji tiap karyawan, lalu mengisi total run lewat `calculate_payroll_run_totals`.
5. Gross Pay, Deductions, dan Net Pay terisi setelah proses selesai.

## Tes

Perintah:

```powershell
npx vitest run src/2-4-payroll/modals/CreatePayrollRunDialog.test.tsx
```

Hasil: 2 tes lulus, sekitar 1,3 detik.

- Membuat run "Payroll November" tidak memanggil `calculate_payroll_run_totals` dan tidak menampilkan peringatan. Toast sukses tetap muncul.
- Dua kartu run, satu dengan total `null` dan satu dengan total `0`, masing-masing menampilkan **Rp 0** pada Gross Pay, Deductions, dan Net Pay.

Tes dijalankan pada komponen, bukan lewat browser pada database live. Tidak ada payroll run baru yang dibuat di database produksi.

File tes: `src/2-4-payroll/modals/CreatePayrollRunDialog.test.tsx`
