# AI Employee — Step 4a: Laporan migration fase 1

Status: file migration, tes, dan rollback ada di branch `feat/ai-employee-phase1-migrations`. Belum di-merge. Step 4b dan step 5 tidak dikerjakan. Tidak ada baris Naya, profil, SOP, objective, atau seed.

## Versi Postgres dan keputusan ON DELETE

`supabase/config.toml` tidak punya bagian `[db]` dan tidak punya `major_version`.

Supabase CLI yang terpasang adalah 2.108.0. Di dalam binary-nya, kumpulan image default memakai `supabase/postgres:17.6.1.143`. CLI yang sama juga memuat image 15.8.1.085 dan 14.1.0.89 untuk versi mayor yang dipilih lewat config atau `SUPABASE_DB_MAJOR_VERSION`. Karena config tidak mengunci versi, image yang akan dipakai `supabase start` adalah Postgres 17.

`SELECT version()` pada server yang sedang berjalan belum bisa diambil. `npx supabase status` gagal karena pipe Docker `//./pipe/docker_engine` tidak ada. Docker Desktop tidak terpasang di mesin ini, dan Docker tidak dipasang dari langkah ini.

Keputusan yang ditulis di migration memakai sintaks PostgreSQL 15 ke atas:

- `social_media_plans`: `ON DELETE SET NULL (author_employee_id)`
- `daily_tasks`: `ON DELETE SET NULL (requested_ai_employee_id)`
- `ai_employee_profiles`: `ON DELETE SET NULL (department_id)` untuk departemen

`organization_id` tidak masuk daftar kolom yang dikosongkan. Foreign key reviewer (`reviewer_employee_id`, `organization_id`) tidak memakai `ON DELETE`, jadi Postgres menolak penghapusan reviewer selama masih dirujuk. Tabel milik karyawan AI (profil, SOP, langkah SOP, jadwal, izin, run, masukan, penghitung model) memakai `ON DELETE CASCADE` ke pasangan `(employee_id, organization_id)`. Tidak ada foreign key gabungan lain yang memakai `SET NULL` tanpa daftar kolom.

Jika server yang benar-benar hidup ternyata di bawah 15, migration profil dan atribusi akan gagal di `SET NULL (kolom)`. Jangan dipaksa. Dua opsi yang tinggal dipilih saat itu:

1. Trigger `BEFORE DELETE` pada `employees` yang mengosongkan hanya `author_employee_id` atau `requested_ai_employee_id`, lalu foreign key satu kolom.
2. Tetap foreign key gabungan tanpa `ON DELETE`, dan trigger yang sama sebelum baris karyawan dihapus.

## Antrean notifikasi

Sumber skema `daily_task_completion_push_queue` di `supabase/migrations/20260528120000_daily_task_completion_notifications.sql`:

- `daily_task_id uuid NULL`. Tidak ada migration berikutnya yang mengubahnya menjadi `NOT NULL`.
- `event_type` hanya `completed` dan `rejected`.
- `entity_type` hanya `task`, `step`, dan `substep`.
- `recipient_user_id` wajib dan merujuk `auth.users`.

`daily_task_notifications.daily_task_id` juga sudah `NULL`. Tabel lonceng tidak punya CHECK `event_type`.

Kejadian run bisa disimpan tanpa tugas. Opsi (a) pada permintaan, yaitu mengubah `daily_task_id` menjadi nullable, tidak diperlukan karena kolom itu sudah nullable. Opsi (b), antrean terpisah, tidak dipakai.

Yang dikerjakan adalah pelebaran CHECK pada antrean yang sudah ada:

- `event_type`: `completed`, `rejected`, `run_failed`, `run_late`, `run_deferred`, `revision_returned`
- `entity_type`: `task`, `step`, `substep`, `ai_run`

Baris `completed` dan `rejected` tetap lolos. Fungsi `insert_daily_task_completion_notification` tidak diubah, jadi teks lonceng tugas selesai dan ditolak tetap dibuat oleh fungsi lama. Fungsi penutup run menulis lonceng dan antrean sendiri, dengan `daily_task_id` kosong dan `entity_type` `ai_run`.

Edge function `daily-task-completion-send-push` tidak diubah di step ini. Sampai fungsi itu diubah di langkah berikutnya, push untuk event baru masih memakai teks selesai yang lama. Lonceng di aplikasi memakai kolom `title` dan `body`, jadi teks di dalam aplikasi bisa benar.

## Daftar migration

File 6 desain (`ai_employee_jobs`, `ai_employee_dispatch`, cron) tidak dibuat.

| Migration | Isi singkat | Rollback |
| --- | --- | --- |
| `supabase/migrations/20261101150000_ai_employee_marker.sql` | Kolom `employees.is_ai`. Unique `(id, organization_id)` pada `employees` dan `departments`. `count_active_employees_for_org` melewatkan `is_ai`. | `supabase/rollback/ai-employee/20261101150000_ai_employee_marker.sql` |
| `supabase/migrations/20261101151000_ai_employee_profile.sql` | Profil, SOP, langkah SOP, jadwal, izin, tiket status, fungsi owner, trigger penolak, RLS. | `supabase/rollback/ai-employee/20261101151000_ai_employee_profile.sql` |
| `supabase/migrations/20261101152000_ai_employee_runs.sql` | Run, masukan reviewer, penghitung panggilan model per tanggal Jakarta. | `supabase/rollback/ai-employee/20261101152000_ai_employee_runs.sql` |
| `supabase/migrations/20261101153000_ai_employee_attribution.sql` | `author_employee_id`, `requested_ai_employee_id`, `ai_revision_count`, `key_results.ai_kr_code`. Foreign key gabungan dengan `SET NULL` satu kolom. | `supabase/rollback/ai-employee/20261101153000_ai_employee_attribution.sql` |
| `supabase/migrations/20261101154000_ai_employee_perform.sql` | Role `ai_employee_runner` dan fungsi pintu, baca, buka/tutup run, kuota, dan hitung ulang KR. | `supabase/rollback/ai-employee/20261101154000_ai_employee_perform.sql` |
| `supabase/migrations/20261101156000_ai_employee_reviewer_notify.sql` | CHECK antrean push diperlebar. | `supabase/rollback/ai-employee/20261101156000_ai_employee_reviewer_notify.sql` |

Rollback dijalankan dari yang paling baru: 156000, 154000, 153000, 152000, 151000, lalu 150000. `DROP ROLE` di rollback fungsi berada di luar blok `DO`, karena Postgres menolak `DROP ROLE` di dalam transaksi blok itu.

## Fungsi runner dan grant

Role `ai_employee_runner`: `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS`. Role ini di-`GRANT` ke `authenticator` supaya PostgREST bisa `SET ROLE`. Ia punya `USAGE` pada skema `public`. Tidak ada `SELECT`, `INSERT`, `UPDATE`, atau `DELETE` tabel yang diberikan ke role itu.

`CREATE ROLE` dijalankan lewat `dblink` di koneksi terpisah. Migration Supabase membungkus file dalam transaksi, sedangkan `CREATE ROLE` tidak boleh di dalam transaksi.

EXECUTE untuk `ai_employee_runner`, dan dicabut dari `PUBLIC`, `anon`, `authenticated`, serta `service_role`:

- `ai_employee_context(uuid, uuid, text, jsonb)`
- `ai_employee_run_start(uuid, text)`
- `ai_employee_run_finish(uuid, uuid, text, integer, integer, uuid[], text)`
- `ai_employee_reserve_model_call(uuid, uuid, boolean)`
- `ai_employee_refresh_krs(uuid)`
- `ai_employee_perform(uuid, uuid, text, jsonb)`

`ai_employee_set_performance_status(uuid, text)` hanya untuk `authenticated`. Runner, `PUBLIC`, `anon`, dan `service_role` tidak punya EXECUTE. Pemanggil harus `user_roles.role = 'owner'` pada organisasi profil itu.

Fungsi dalam yang tidak di-GRANT ke runner: `ai_employee_require_run`, `ai_employee_assert_task`, `ai_employee_notify_reviewer`, `ai_employee_status_guard`.

Baca lewat `ai_employee_context` hanya saat run milik karyawan itu dan statusnya `running`. Organisasi diambil dari baris `employees`. Lingkup yang dikembalikan: plan milik karyawan itu, kalender pada jendela tanggal, katalog `services` aktif, content pillar aktif, master thought Thinking Lab yang `locked`, masukan yang belum kedaluwarsa dan belum diabaikan, serta tugas yang assignee-nya karyawan itu. Tidak ada baca finance, HR, payroll, CRM, atau ads.

`ai_employee_reserve_model_call` menghitung tanggal pemakaian Naya di Asia/Jakarta. Batas 15, atau 8 saat `performance_status = 'coaching'`. Sisa kuota organisasi dibaca dari `script_ai_daily_usage` pada tanggal UTC dan tidak ditambah.

## Hasil tes

Belum dijalankan. Penyebab: Docker engine tidak hidup di mesin ini.

```text
npx supabase status
failed to inspect container health: ... open //./pipe/docker_engine: The system cannot find the file specified.
```

`supabase/tests/ai_employee_phase1.sql` sudah berisi kasus yang diminta. Repo tidak memakai pgTAP, jadi tes ini SQL biasa yang gagal lewat `RAISE EXCEPTION` dan mengakhiri sukses dengan notice `AI_EMPLOYEE_PHASE1_OK`. Transaksi tes di-rollback.

Kasus di file itu:

- Foreign key gabungan menolak profil, reviewer, plan, dan tugas yang organisasinya tidak sama dengan baris karyawan.
- Menghapus karyawan AI mengosongkan `author_employee_id` dan `requested_ai_employee_id`, sedangkan `organization_id` plan dan tugas tetap.
- `count_active_employees_for_org` menghitung karyawan manusia dan melewatkan `is_ai`.
- Anggota biasa ditolak `ai_employee_set_performance_status`. Owner berhasil. `UPDATE` langsung dan `set_config` dengan token palsu ditolak trigger.
- `ai_employee_perform` menolak run milik karyawan lain, run yang sudah selesai, aksi di luar allowlist, `approved`, `production_approved`, approval `approved`, dan `organization_id` yang berbeda. Plan yang lolos ditulis `author_employee_id` karyawan itu dan `production_status` `Need Review`.
- Role runner tidak punya SELECT pada `employees`, tetapi bisa memanggil `ai_employee_context`.
- Event `completed` dan `rejected` tetap masuk. Event `run_failed`, `run_late`, `run_deferred`, dan `revision_returned` masuk dengan `daily_task_id` kosong. Event yang tidak dikenal ditolak.
- KR1 pada dua run SOP1 Jumat, satu tepat waktu dan satu telat, menjadi 50. KR3 tetap `unrated` saat plan belum cukup, dan tidak menurunkan `individual_objectives.progress_percentage`.

Perintah, setelah Docker hidup. Ini hanya database lokal. Jangan `supabase db push` dan jangan `supabase link`.

```powershell
npx supabase start
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/ai_employee_phase1.sql
```

`db reset` menghapus isi database lokal. Notice yang diharapkan: `AI_EMPLOYEE_PHASE1_OK`.

Rollback, cek skema, pasang lagi, lalu tes lagi. `psql` di sini autocommit, jadi `DROP ROLE` sah. Jangan membungkus file rollback dalam `BEGIN`.

```powershell
$psql = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
$files = @(
  "supabase/rollback/ai-employee/20261101156000_ai_employee_reviewer_notify.sql",
  "supabase/rollback/ai-employee/20261101154000_ai_employee_perform.sql",
  "supabase/rollback/ai-employee/20261101153000_ai_employee_attribution.sql",
  "supabase/rollback/ai-employee/20261101152000_ai_employee_runs.sql",
  "supabase/rollback/ai-employee/20261101151000_ai_employee_profile.sql",
  "supabase/rollback/ai-employee/20261101150000_ai_employee_marker.sql"
)
foreach ($file in $files) { psql $psql -v ON_ERROR_STOP=1 -f $file }
psql $psql -v ON_ERROR_STOP=1 -c "SELECT to_regclass('public.ai_employee_profiles') AS profile, to_regclass('public.ai_employee_runs') AS runs, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'is_ai') AS is_ai, EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_employee_runner') AS runner;"
```

Hasil yang diharapkan: `profile` dan `runs` kosong, `is_ai` false, `runner` false.

Pasang ulang enam file, bukan lewat `migration up`, karena riwayat `schema_migrations` masih menganggap file itu sudah jalan.

```powershell
$up = @(
  "supabase/migrations/20261101150000_ai_employee_marker.sql",
  "supabase/migrations/20261101151000_ai_employee_profile.sql",
  "supabase/migrations/20261101152000_ai_employee_runs.sql",
  "supabase/migrations/20261101153000_ai_employee_attribution.sql",
  "supabase/migrations/20261101154000_ai_employee_perform.sql",
  "supabase/migrations/20261101156000_ai_employee_reviewer_notify.sql"
)
foreach ($file in $up) { psql $psql -v ON_ERROR_STOP=1 -f $file }
psql $psql -v ON_ERROR_STOP=1 -f supabase/tests/ai_employee_phase1.sql
```

## Penyimpangan dari desain 03 v1.1

- Sketsa di desain menulis `ON DELETE SET NULL` tanpa daftar kolom. Migration memakai `ON DELETE SET NULL (kolom karyawan)` supaya `organization_id` tidak ikut kosong.
- Status kinerja tidak hanya mengandalkan GUC. Fungsi owner menulis tiket sekali pakai di `ai_employee_status_tickets`. Trigger menghapus tiket yang cocok. `set_config` dengan token sembarang ditolak. Tabel tiket dicabut dari `PUBLIC`, `anon`, `authenticated`, dan `service_role`.
- `thinking.execution.check` hanya memastikan run, profil, dan izin, lalu mengembalikan `accepted`. SQL tidak memanggil `generate-script-ai`.
- `thinking.plan.save` dan `thinking.plan.direct` menulis baris `social_media_plans` sendiri. Keduanya tidak memanggil `mcp_create_thinking_plan`, karena fungsi itu membutuhkan user manusia dan format brief yang kaku. Template shot Thinking Lab tidak divalidasi di pintu SQL.
- Perubahan brief mematikan trigger `social_media_plans_brief_pic_guard` untuk satu pernyataan. Trigger itu menolak perubahan brief bila `auth.uid()` bukan PIC, sedangkan karyawan AI tidak punya `user_id`. Trigger lain, termasuk foreign key, tetap hidup. `DISABLE TRIGGER` ikut rollback jika transaksi gagal.
- `ai_employee_model_calls` hanya merujuk `employees.id`. Penghitung tidak punya `organization_id`. `employees.id` sudah unik, jadi tidak ada pasangan organisasi yang bisa salah.
- KR1 memakai run `SOP1` yang sudah ditutup sebagai penyebut. Pembilang adalah run `succeeded` yang dimulai pada hari Jumat Asia/Jakarta dan selesai paling lambat pukul 17:00 pada tanggal mulai yang sama. Jadwal di tabel belum menjadi instance minggu.
- Rantai Thinking Lab yang dibaca hanya `thinking_master_thoughts.status = 'locked'`. Status `audited` tidak ikut.
- Teks push FCM untuk event baru belum diubah. Fungsi edge tetap seperti sekarang.
- Antrean job dan cron tidak dibuat. Itu file 6, step 5.
- `service_role` tidak menerima EXECUTE. Cadangan itu menunggu uji JWT di step 6.

## Hal yang belum pasti

- Versi Postgres yang benar-benar menjawab `SELECT version()` di mesin ini. Yang diketahui baru image default CLI, yaitu 17.6.1.143. Konfirmasi setelah `supabase start`.
- Apakah koneksi `dblink` lokal `dbname=postgres user=postgres` dipercaya oleh `pg_hba` image itu. Jika migration 154000 gagal di situ, role perlu dibuat dengan cara koneksi yang lolos di image tersebut.
- Apakah fungsi lama yang masih di-GRANT ke `PUBLIC` bisa dipanggil role runner. Cabut `PUBLIC` untuk seluruh fungsi akan mengubah privilege global dan belum dilakukan.
- Nama departemen digital marketing yang tepat. Itu urusan seed step 4b.
- Apakah project hosted masih menerima JWT HS256 dengan role kustom. Uji satu RPC disimpan untuk step 6.
- Apakah setiap `thinking.execution.check` menulis `content_ai_usage`. Itu baru bisa dipastikan saat `generate-script-ai` diubah di step 7.
- GUC kustom `ai_employee.status_write` bisa memunculkan peringatan `unrecognized configuration parameter` pada sebagian versi. Tiket sekali pakai tetap yang menentukan boleh tidaknya perubahan status.
