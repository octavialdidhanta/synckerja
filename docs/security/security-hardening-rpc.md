# Laporan pengamanan RPC dan perhitungan payroll

Tanggal: 2 November 2026.

## Ringkasan untuk atasan

Fungsi yang menghitung total payroll, `calculate_payroll_run_totals`, sudah ditutup untuk pengunjung umum dan untuk sesi pengguna aplikasi. Hanya server yang boleh memanggilnya langsung. Penutupan ini sudah hidup di database.

Aplikasi tidak lagi memanggil fungsi itu saat tombol **Create Payroll Run** ditekan. Sebelumnya panggilan itu gagal dan hanya memunculkan peringatan. Run baru tetap tersimpan sebagai draft. Angka Gross Pay, Deductions, dan Net Pay yang belum dihitung tampil **Rp 0**, bukan teks kosong atau error.

Perhitungan gaji tidak dihilangkan. Saat pengguna menekan tombol proses pada kartu run, aplikasi memanggil `process_payroll_run`. Fungsi itu masih boleh dipakai pengguna yang login, dengan syarat role owner, admin, atau HR di organisasi tersebut. Di dalam server, fungsi itu menghitung gaji tiap karyawan lalu mengisi total run lewat `calculate_payroll_run_totals`. Total terisi sesudah run diproses, bukan pada saat run baru dibuat.

## Tes

Perintah: `npx vitest run src/2-4-payroll/modals/CreatePayrollRunDialog.test.tsx`

Hasil: 2 tes lulus, sekitar 1,3 detik. File tes: `src/2-4-payroll/modals/CreatePayrollRunDialog.test.tsx`.

- Membuat run tidak memanggil `calculate_payroll_run_totals` dan tidak menampilkan peringatan. Toast sukses tetap muncul.
- Kartu run dengan total `null` dan total `0` sama-sama menampilkan **Rp 0** pada Gross Pay, Deductions, dan Net Pay.

Tes ini dijalankan di komponen, bukan lewat browser pada database live. Tidak ada payroll run baru yang dibuat di database produksi untuk tes ini.

## Yang masih perlu diperhatikan

Dua fungsi baca payroll masih bisa dipanggil tanpa login: `get_payroll_disburse_preview` dan `get_payroll_statutory_escrow_amounts`. Keduanya menolak pemanggil di luar organisasi, tetapi kunci anon tetap sampai ke badan fungsi.

Versi migration `20261102140000` belum tercatat di riwayat migration remote. `db push` masih bisa mencoba menjalankan ulang file keamanan hari ini.

## Lampiran teknis

Laporan di bawah ini membandingkan file `supabase/migrations/20261102140000_security_hardening_rpc.sql` dengan katalog live pada 2 November 2026. Badan fungsi di file itu disalin dari `pg_get_functiondef`, bukan dari migration lama. Hash MD5 keenam definisi cocok dengan database.

File ini mencatat perubahan yang sudah hidup. Saya tidak menjalankan SQL-nya. Versi `20261102140000` belum ada di `supabase_migrations.schema_migrations`. `supabase migration repair` gagal: token CLI tidak valid, dan `SUPABASE_DB_PASSWORD` tidak ada.

`20261102100000` dan `20261102110000` juga belum ada di tabel riwayat itu. `db push` akan mencoba ketiganya.

Daftar `REVOKE` anon di bawah tidak berasal dari tempelan pesan. Tempelan itu tidak sampai. Enam belas baris itu adalah fungsi yang, saat katalog dibaca, `anon` sudah tidak punya `EXECUTE` sementara `authenticated` masih punya.

## File

| Peran | File |
| --- | --- |
| Catatan perubahan live | `supabase/migrations/20261102140000_security_hardening_rpc.sql` |
| Payroll yang dihapus, tidak dijalankan | `supabase/migrations/20261102130000_payroll_org_role_checks.sql` |
| Gelombang 1c yang dihapus, tidak dijalankan | `supabase/migrations/20261102120000_revoke_anon_execute_wave1c.sql` |

Tidak ada rollback untuk file `20261102140000`. Mengembalikan hak berarti menulis `GRANT` baru, bukan menjalankan ulang file ini.

## Badan fungsi yang dicatat

Empat fungsi payroll memakai `user_has_org_role(..., ARRAY['owner','admin','hr'])` sesudah cek keanggotaan `user_organization_ids()`. `enable_pos_addon_zero_charge` memakai `ARRAY['owner','admin']` dan mengabaikan `p_paid_outlet_count`.

| Fungsi | Byte | MD5 `pg_get_functiondef` |
| --- | --- | --- |
| `public.user_has_org_role(uuid, text[])` | 359 | `7abf95380b76b8fcd646b22ef6000ad4` |
| `public.process_payroll_run(uuid)` | 3114 | `1a2728e3f8f4babe7902238ff151faf5` |
| `public.get_payroll_disburse_preview(uuid)` | 10118 | `70b69a0393106d4530e0eef044cdeb68` |
| `public.mark_payroll_run_paid(uuid, text, text)` | 2574 | `9d4c08ff43603a7fdaa80d955a776aea` |
| `public.get_payroll_statutory_escrow_amounts(uuid)` | 2119 | `ff3c2e90d7f4aaa28e9d1388f3fba5b9` |
| `public.enable_pos_addon_zero_charge(uuid, integer)` | 1422 | `5cc5608bbd25d9ce498314864c5ad6bc` |

`user_has_org_role` membandingkan `lower(role)` dengan isi array apa adanya. Pemanggil di file ini mengirim huruf kecil.

## Hak di katalog live

`anon` di kolom ini sudah memperhitungkan grant `PUBLIC`.

| Fungsi | anon | authenticated | service_role |
| --- | --- | --- | --- |
| `user_has_org_role(uuid, text[])` | ya, lewat `PUBLIC` | ya | ya |
| `process_payroll_run(uuid)` | tidak | ya | ya |
| `mark_payroll_run_paid(uuid, text, text)` | tidak | ya | ya |
| `enable_pos_addon_zero_charge(uuid, integer)` | tidak | ya | ya |
| `get_payroll_disburse_preview(uuid)` | ya | ya | ya |
| `get_payroll_statutory_escrow_amounts(uuid)` | ya | ya | ya |
| `calculate_payroll_run_totals(uuid)` | tidak | tidak | ya |
| `payroll_calculate_employee(uuid, uuid)` | tidak | tidak | ya |
| `payroll_log_audit(uuid, uuid, uuid, text, jsonb)` | tidak | tidak | ya |
| `mark_brick_payment_request_paid(uuid, text)` | tidak | tidak | ya |
| `_lead_merge_execute_cluster(uuid, text, text, uuid, uuid[], uuid)` | tidak | tidak | ya |

Enam belas `REVOKE ... FROM PUBLIC, anon` di file, sebelum blok `DO`, mencakup `process_payroll_run`, `mark_payroll_run_paid`, `enable_pos_addon_zero_charge`, dan tiga belas fungsi lain yang keadaannya sama: `admin_delete_organization`, `apply_meta_session_expired_conversations`, `cancel_social_media_scheduled_posts_for_plan`, `get_or_create_org_api_system_actor`, `pos_finalize_qris_checkout`, `process_due_flow_delay_jobs`, `reconcile_xendit_disbursement_completed`, `recover_stale_publishing_rows`, `refresh_budget_allocation_payout`, `resign_employee`, `run_bank_expense_mutation_match_for_org`, `run_bank_mutation_match_for_org`, `upsert_kol_budget_allocation`.

Blok terakhir mencabut `PUBLIC`, `anon`, dan `authenticated`, lalu memberi `service_role`, untuk `mark_brick_payment_request_paid`, `_lead_merge_execute_cluster`, `payroll_calculate_employee`, `payroll_log_audit`, dan `calculate_payroll_run_totals`.

## Pemanggil di repo

Klien di `src/` adalah `src/shared/lib/supabaseClient.ts`: kunci anon ditambah sesi user yang login, jadi role-nya `authenticated`.

| Fungsi | Pemanggil | Akibat hak live |
| --- | --- | --- |
| `process_payroll_run` | `src/2-4-payroll/components/overview/PayrollRunsOverview.tsx:229` | User login masih bisa memanggil |
| `mark_payroll_run_paid` | `src/2-4-payroll/modals/MarkPayrollRunPaidDialog.tsx:41` | User login masih bisa memanggil |
| `get_payroll_disburse_preview` | `src/2-4-payroll/hooks/usePayrollDisbursePreview.ts:146` | User login bisa. `anon` juga masih bisa |
| `get_payroll_statutory_escrow_amounts` | `src/2-4-payroll/escrow/hooks/usePayrollEscrowTransferStatus.ts:43` dan `admin.rpc` di `supabase/functions/_shared/xendit/services/executePayrollEscrowTransfer.ts:90` | User login dan `service_role` bisa. `anon` juga masih bisa |
| `enable_pos_addon_zero_charge` | `src/10-subscription/plans/useHRISSubscriptionPlansController.ts:888` | User login masih bisa memanggil |
| `calculate_payroll_run_totals` | Tidak lagi dipanggil dari aplikasi. Dulu ada di `CreatePayrollRunDialog.tsx`. Sekarang hanya `PERFORM` di dalam `process_payroll_run` | User login tidak bisa memanggil langsung. Total terisi saat run diproses |
| `payroll_calculate_employee` | `PERFORM` di dalam `process_payroll_run`, dan skrip `scripts/seed-payroll-manual-qa-agustus-2026.sql`, `scripts/seed-payroll-manual-qa-september-2026.sql` | Tidak ada `.rpc` di `src/`. Pemanggil `SECURITY DEFINER` berjalan sebagai pemilik fungsi |
| `payroll_log_audit` | `PERFORM` di dalam `process_payroll_run` dan `mark_payroll_run_paid` | Tidak ada `.rpc` di `src/` |
| `maybe_finalize_payroll_run` | `admin.rpc` di `supabase/functions/_shared/xendit/services/finalizePayrollDisbursement.ts:12` | Tidak ada di file migration ini |

## Yang masih terbuka untuk anon

`get_payroll_disburse_preview` dan `get_payroll_statutory_escrow_amounts` tetap bisa dipanggil `anon`. Keduanya `SECURITY DEFINER` dan menolak pemanggil di luar organisasi, tetapi kunci anon tetap sampai ke badan fungsi.

`user_has_org_role` juga tetap bisa dipanggil `anon` lewat grant `PUBLIC`. Isinya hanya mengembalikan apakah `auth.uid()` punya role di organisasi itu. Tanpa sesi, `auth.uid()` kosong, jadi hasilnya false.

## Perintah yang belum berhasil

```powershell
npx supabase migration repair 20261102140000 --status applied --linked --yes
```
