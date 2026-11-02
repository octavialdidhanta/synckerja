# AI Employee — Laporan progres MVP

Tanggal laporan: 2 November 2026.

MVP ini adalah karyawan AI pertama, **Naya**, content planner otomatis. Naya diperlakukan seperti karyawan: punya SOP, KPI individu, masuk OKR, menerima daily task untuk pekerjaan dadakan, dan kinerjanya bisa dievaluasi. Pekerjaan rutin terjadwal tidak masuk daily task; cukup tercatat di log run.

## Posisi sekarang

Pengerjaan berhenti di **step 4a (migration fase 1)**, selesai direvisi pada 1 November 2026 pukul 20:55 WIB. Step 4b dan seterusnya belum dimulai. Tidak ada baris Naya, profil, SOP, objective, atau seed di database.

| | |
| --- | --- |
| Branch kerja | `feat/ai-employee-phase1-migrations` (lokal, belum di-push, belum di-merge) |
| Commit | `561ac615` schema + pintu runner, lalu `f778ec6d` revisi tiket brief |
| Basis | `main` di `28bb788a` |
| Checkout saat laporan ini ditulis | `fix/revoke-anon-wave1` (`df94780b`) |

Dokumen audit, definisi, desain, dan laporan migration **tidak ada di branch yang sedang terbuka**. Semuanya ada di branch AI Employee di atas. Folder `docs/ai-employee/` di working tree saat ini baru berisi laporan ini.

Branch keamanan `fix/revoke-anon-wave1` berangkat dari `main` yang sama, lalu menambah satu commit berisi pencabutan `EXECUTE` anon, pembungkus RPC, dan default privilege fungsi baru. Dua branch itu belum digabung. Migration AI Employee belum melihat perubahan keamanan 2 November.

## Roadmap

| Step | Isi | Status |
| --- | --- | --- |
| 1 | Audit modul, karyawan, OKR, konten, MCP | Selesai. `docs/ai-employee/01-audit.md` |
| 2 | SOP, KPI, tanggung jawab Naya dalam OKR | Selesai, v1.1, pertanyaan terbuka terjawab. `docs/ai-employee/02-definisi.md` |
| 3 | Desain integrasi OKR, kapasitas, dan run | Selesai, v1.1. `docs/ai-employee/03-desain-teknis.md` |
| 4a | Migration skema fase 1 (tanpa antrean job dan cron) | File ada, tes belum dijalankan |
| 4b | Data Naya: karyawan, profil, SOP, objective | Belum |
| 4 UI | UI OKR, KPI, jadwal, kapasitas | Belum |
| 5 | Satu cron Supabase + `ai_employee_jobs` / `ai_employee_dispatch` | Belum. Sengaja dilewati di 4a |
| 6 | Antrean, pemroses, uji JWT role `ai_employee_runner` | Belum |
| 7 | AI runtime, prompt KPI, jalur model | Belum |
| 8 | Tool lewat otorisasi SQL, bukan connector manusia | Belum |
| 9 | Tugas dadakan jadi daily task; rutin hanya log run | Aturan ada di definisi. Runtime belum |
| 10 | Dashboard KPI, kapasitas, evaluasi, kuota | Belum |
| 11 | Uji end-to-end dan rilis | Belum |

## Yang sudah dikunci

1. Mesin hybrid. Rutin tanpa penalaran tidak memanggil model. Model hanya untuk menyusun ide atau plan dan untuk tugas dadakan, lewat jalur `generate-script-ai` serta kuota organisasi.
2. Naya adalah satu baris `employees` per organisasi. `user_id` boleh kosong. Dua organisasi berarti dua baris. Kunci tugas dan OKR adalah `employees.id`.
3. Naya tidak login lewat connector MCP manusia. Tulisan hanya lewat fungsi `ai_employee_perform`.
4. KPI memakai `individual_objectives` dan `key_results` yang sudah ada. Tidak ada objek KPI baru.
5. Departemen: digital marketing yang sudah ada. Tidak dibuat departemen baru.
6. Reviewer dan pemilik company objective: owner organisasi.
7. SOP 1: Jumat 15:00 Asia/Jakarta, jendela Senin–Minggu berikutnya, batas serah Jumat 17:00.
8. KR3 (sebaran pillar, tidak ada pillar di atas 40% dalam 4 minggu) berstatus `unrated` sampai ada minimal 5 plan Naya dan 3 pillar aktif.
9. SLA KR4: 4 jam kerja untuk Urgent, 1 hari kerja untuk Normal. Waktu menunggu izin reviewer saat Masa pembinaan tidak dihitung. Urgent boleh di luar jam kerja, termasuk akhir pekan. Scheduled dan Normal tetap Senin–Jumat 08:00–17:00.
10. Batas panggilan model Naya: 15 per hari (8 saat Masa pembinaan), dihitung pada tanggal Asia/Jakarta. `thinking.execution.check` masuk hitungan itu. Sisa kuota organisasi tetap tanggal UTC seperti `generate-script-ai`.
11. Target KR2: 50% pada 4 minggu pertama, lalu 70%. KR2 dan hitung otomatis KR4 menunggu fase 2.
12. CRM dan ads ditutup di MVP.
13. Status kinerja fase 1 diisi manual oleh owner.
14. Pintu tulis memakai role database `ai_employee_runner` (JWT kustom). `service_role` adalah cadangan, belum diberi `EXECUTE`, menunggu uji di step 6.

## Isi step 4a

Tujuh migration baru, masing-masing punya rollback di `supabase/rollback/ai-employee/`. Tes ada di `supabase/tests/ai_employee_phase1.sql`. Laporan lengkap: `docs/ai-employee/04a-migration-report.md`.

| File | Isi |
| --- | --- |
| `20261101150000_ai_employee_marker.sql` | Kolom `employees.is_ai`. Unique `(id, organization_id)`. `count_active_employees_for_org` melewatkan karyawan AI |
| `20261101151000_ai_employee_profile.sql` | Profil, SOP, langkah SOP, jadwal, izin, tiket status, RLS |
| `20261101152000_ai_employee_runs.sql` | Log run, masukan reviewer, penghitung panggilan model |
| `20261101153000_ai_employee_attribution.sql` | `author_employee_id`, `requested_ai_employee_id`, `ai_revision_count`, `key_results.ai_kr_code` |
| `20261101154000_ai_employee_perform.sql` | Role `ai_employee_runner` dan fungsi pintu, baca, buka/tutup run, kuota, hitung ulang KR |
| `20261101156000_ai_employee_reviewer_notify.sql` | Event antrean push: `run_failed`, `run_late`, `run_deferred`, `revision_returned` |
| `20261101157000_ai_employee_brief_ticket.sql` | Tiket brief sekali pakai. Trigger brief tidak dimatikan |

Yang sengaja tidak dibuat: `ai_employee_jobs`, `ai_employee_dispatch`, dan cron. Itu file 6 desain, dikerjakan di step 5.

Revisi `f778ec6d`:

- `CREATE ROLE` ada di dalam transaksi lewat blok `DO` yang mengecek `pg_roles`. `dblink` tidak dipakai.
- Perubahan brief tidak memakai `DISABLE TRIGGER`. Pintu AI menulis tiket sekali pakai; manusia yang bukan PIC tetap ditolak.

## Tes

Belum dijalankan. Saat step 4a dikerjakan, Docker engine tidak hidup (`//./pipe/docker_engine` tidak ada), jadi `supabase start` dan `supabase db reset` tidak bisa. Tidak ada `db push` dan tidak ada link ke project remote.

Notice yang diharapkan setelah Docker hidup, hanya di database lokal:

```text
AI_EMPLOYEE_PHASE1_OK
```

## Yang belum dibangun

- Baris karyawan Naya, profil, SOP, jadwal, izin, dan tiga objective (company, department, individual).
- UI jadwal, kapasitas, dan KPI.
- Cron Jumat 15:00 dan antrean job.
- Edge function runner dan prompt.
- Perubahan `generate-script-ai` agar menerima karyawan `is_ai` tanpa user manusia.
- Teks push FCM untuk empat event baru. Lonceng di aplikasi bisa memakai `title` dan `body`; edge function push masih teks lama.
- Penyebut KR1 yang benar (minggu yang dijadwalkan). SQL sekarang memakai run SOP1 yang sudah ditutup. Perbaikan direncanakan di step 5.
- Dashboard dan uji end-to-end.

## Fase produk

Fase 1 (MVP): penanda AI, pengecualian kuota kursi, profil dan reviewer owner, izin aksi, SOP 1–3, jadwal Jumat, log run, atribusi, feedback, retry maksimal 2 lalu kembali ke reviewer. KR1, KR3, dan KR5 bisa dihitung setelah log run dan atribusi ada. KR4 saat Masa pembinaan dinilai manual.

Fase 2: status kinerja otomatis, kapasitas yang bisa diubah, penanda pengajuan pertama, eskalasi terstruktur, dan cap waktu izin pembinaan supaya KR2 dan KR4 terhitung otomatis.

## Risiko sebelum lanjut

1. **Cabang terbelah.** Lanjut coding di `feat/ai-employee-phase1-migrations` tanpa menggabungkan `fix/revoke-anon-wave1` berarti migration AI Employee tidak memuat aturan default privilege dan revoke 2 November. Fungsi baru di fase 1 perlu dicek lagi terhadap aturan itu saat digabung.
2. **Tes lokal belum hijau.** Jangan seed Naya dan jangan push sebelum `AI_EMPLOYEE_PHASE1_OK`.
3. **Postgres.** Desain memakai `ON DELETE SET NULL (kolom)`, yang butuh PostgreSQL 15+. Image default CLI yang tercatat adalah Postgres 17. `SELECT version()` pada server lokal belum diambil.
4. **JWT role kustom** pada project hosted belum diuji. Itu step 6.
5. **Nama departemen digital marketing** yang persis masih dicocokkan saat seed, bukan saat migration.

## Langkah berikutnya

1. Hidupkan Docker, checkout `feat/ai-employee-phase1-migrations`, gabungkan perubahan keamanan dari `fix/revoke-anon-wave1`, lalu jalankan tes lokal.
2. Setelah tes lulus: **step 4b**, isi data Naya (karyawan, profil, SOP, objective). Tetap tanpa cron.
3. Setelah data ada: step 5, satu cron dan tabel antrean job.

UI, runtime model, dan dashboard menyusul setelah pintu data dan jadwal itu jalan.
