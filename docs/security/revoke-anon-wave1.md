# Cabut akses anon pada fungsi SECURITY DEFINER

Tanggal: 2 November 2026.

## Celah

Fungsi `SECURITY DEFINER` berjalan sebagai pemilik fungsi dan melewati RLS. Kunci anon ada di aplikasi yang belum login. Selama role `anon` memegang `EXECUTE`, kunci itu bisa memanggil fungsi lewat PostgREST.

`REVOKE EXECUTE FROM PUBLIC` tidak menghapus grant terpisah ke `anon`. Grant itu ikut default privilege saat fungsi dibuat. `CREATE OR REPLACE FUNCTION` tidak mengubah ACL yang sudah ada.

Yang terbuka sebelum penutupan hari ini:

- Perhitungan, pratinjau, dan pelunasan payroll bisa dipanggil tanpa cek role owner, admin, atau HR.
- Banyak fungsi `SECURITY DEFINER` masih bisa dipanggil `anon`, termasuk helper yang menulis data organisasi.
- Pembungkus org belum ada, jadi badan fungsi internal bisa dipanggil langsung bila grant-nya masih terbuka.
- Jam check-in memakai jam perangkat. Jam perangkat yang diubah ikut mengubah keterlambatan.
- Add-on POS bisa diaktifkan dari argumen klien, tanpa mengunci jumlah outlet berbayar ke server.
- Dialog buat payroll run masih memanggil `calculate_payroll_run_totals` sesudah fungsi itu ditutup untuk pengguna aplikasi.

## Perubahan yang diterapkan

- Payroll memakai `user_has_org_role` dengan role owner, admin, atau HR pada proses run, tandai lunas, dan pratinjau yang terkait.
- `EXECUTE` role `anon` dicabut untuk signature di `ops_private.anon_revoke_backup`, plus penutupan gelombang 1 dan 1b.
- 25 fungsi publik dibungkus. Pembungkus menolak pemanggil di luar organisasi. Badan `__impl` hanya untuk `service_role`.
- 119 helper di `ops_private.auth_revoke_backup` hanya untuk `service_role`. `authenticated` ikut dicabut.
- `record_attendance_with_timezone` memakai jam server untuk check-in, bukan `local_checkin_time` dari perangkat.
- `enable_pos_addon_zero_charge` hanya untuk owner atau admin, dan mengabaikan `p_paid_outlet_count`.
- `CreatePayrollRunDialog` tidak lagi memanggil `calculate_payroll_run_totals`. Run baru tetap tersimpan sebagai draft. Total terisi saat run diproses.

## Hasil cek penyalahgunaan

Cek pada 2 November 2026 memakai 4 indikator. Keempatnya 0.

## File

| Peran | File |
| --- | --- |
| Gelombang 1 | `supabase/migrations/20261102100000_revoke_anon_execute_wave1.sql` |
| Gelombang 1b | `supabase/migrations/20261102110000_revoke_anon_execute_wave1b.sql` |
| Catatan pengamanan RPC | `supabase/migrations/20261102140000_security_hardening_rpc.sql` |
| Pembungkus dan helper server | `supabase/migrations/20261102150000_security_hardening_rpc_wave2.sql` |
| Default privilege fungsi baru | `supabase/migrations/20261102160000_default_privileges_functions.sql` |
| Rollback gelombang 1 | `supabase/rollback/security/20261102100000_revoke_anon_execute_wave1.sql` |
| Rollback gelombang 1b | `supabase/rollback/security/20261102110000_revoke_anon_execute_wave1b.sql` |
| Rollback gabungan 2 November | `supabase/rollback/20261102_security_hardening_rollback.sql` |

Bagian di file rollback gabungan bisa dijalankan sendiri-sendiri: kembalikan `anon`, kembalikan `authenticated`, lepas 25 pembungkus, dan kembalikan jam check-in dari `local_checkin_time`.

## Sisa pekerjaan

- Logika payroll: proses ulang saat transfer masih berjalan, dan tandai lunas ikut mengubah transfer yang gagal.
- Jam clock-out masih diambil dari perangkat.
- Fungsi bertanda KUNING belum ditinjau.
- Fungsi bertanda MERAH tanpa parameter organisasi, antara lain `get_traffic_dashboard` dan `get_employee_task_ids`.
- Default privilege role selain `postgres`, termasuk `supabase_admin`, belum diubah.

## Aturan untuk fungsi baru

Fungsi baru yang dibuat role `postgres` tidak otomatis bisa dipanggil `anon` atau `PUBLIC`. `authenticated` dan `service_role` tetap mendapat `EXECUTE` dari aturan default schema `public` yang sudah ada.

Fungsi yang memang harus bisa dipanggil tanpa login, misalnya halaman publik, wajib diberi `GRANT EXECUTE ... TO anon` secara eksplisit di migration-nya.
