# Absensi: clock-out jam server dan izin tulis — 4 November 2026

Langkah 3 dari task "Sisa hardening keamanan Synckerja (lanjutan 2 Nov 2026)".

- Migration: `supabase/migrations/20261104120000_attendance_server_checkout.sql`
- Rollback: `supabase/rollback/20261104_attendance_server_checkout_rollback.sql`

## Masalah

1. **Clock-out dari jam perangkat.** Tiga tempat menulis check-out langsung ke `attendance_records` memakai `new Date()` dan menghitung `working_hours_minutes` di perangkat: `src/1-home/hooks/useSimpleAttendance.ts`, `src/2-3-employee-attendance/hooks/useAttendanceOperations.ts`, `android-mobile/1-home/pages/Absensi.tsx`. Tidak ada trigger yang menimpa. `payroll_calculate_overtime_pay` membaca `check_out_time`, jadi lembur ikut bisa diatur.
2. **Web menulis `check_out_time` dalam UTC** (`dateToPostgresTimeUtc`), sedangkan `check_in_time` dan perhitungan lembur memakai jam lokal. Contoh data 31 Mei: masuk 11:34 (lokal), pulang tercatat 08:33 (UTC).
3. **Izin tulis terlalu luas.** Satu policy `FOR ALL` "anggota org". Diuji (`BEGIN … ROLLBACK`): karyawan biasa berhasil mengubah `check_out_at` dan `working_hours_minutes` absensi orang lain. Jalur check-in lewat `insert` langsung juga masih terbuka.
4. `useAttendanceOperations` mengirim `updated_at`, kolom yang tidak ada di `attendance_records`, sehingga check-out lewat jalur itu gagal.

## Perbaikan

- RPC `record_attendance_checkout(employee_id, organization_id, photo_path, location_data, attendance_id?)`:
  hanya untuk employee milik user yang login; mencari absensi terbuka hari ini atau kemarin (shift malam); `check_out_at = now()`, `check_out_time` jam lokal sesuai zona jadwal kerja (WIB/WITA/WIT), durasi dihitung server; aturan foto check-out dari `load_attendance_rules`.
- Policy: `SELECT` tetap untuk anggota org; `INSERT`/`UPDATE`/`DELETE` langsung hanya owner/admin/hr lewat helper `user_can_manage_attendance(org)`. Karyawan menulis lewat RPC (`record_attendance_with_timezone`, `record_attendance_checkout`). Fungsi `SECURITY DEFINER` (auto checkout, kunjungan klien) tidak terpengaruh RLS.
- Tiga tempat di aplikasi memanggil RPC baru.

## Uji (`BEGIN … ROLLBACK` di production)

| # | Skenario | Hasil |
|---|---|---|
| T1 | Karyawan mengubah absensi orang lain | 0 baris (ditolak) |
| T2 | Karyawan mengubah absensinya sendiri langsung | 0 baris (ditolak) |
| T3 | Karyawan insert absensi langsung | ditolak RLS |
| T4 | Karyawan melihat absensi org | tetap bisa |
| T5 | Karyawan check-out lewat RPC | 120 menit, jam lokal = jam WIB server |
| T6 | Check-out kedua | ditolak |
| T7 | Check-out untuk karyawan lain | ditolak |
| T8 | Owner mengoreksi absensi karyawan | bisa |
| T9 | Anon melihat absensi | 0 baris |

## Catatan

- Aplikasi Android versi lama di HP karyawan (bukan owner/admin/hr) tidak bisa check-out setelah perubahan ini sampai di-update. Saat ini belum ada karyawan biasa yang login.
- `apply_attendance_auto_checkout` menulis kolom `updated_at` yang tidak ada di `attendance_records`. Belum diubah di sini.
- Validasi lokasi saat check-out belum ada (sama seperti sebelumnya).
