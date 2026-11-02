# AI Employee — Step 4a: Laporan migration fase 1

Status: file migration, tes, dan rollback ada di branch `feat/ai-employee-phase1-migrations`. Belum di-merge. Tidak di-push dan tidak di-link. Step 4b dan step 5 tidak dikerjakan. Tidak ada baris Naya, profil, SOP, objective, atau seed.

Revisi ini mengganti `dblink` dengan `CREATE ROLE` di dalam transaksi, mengganti `DISABLE TRIGGER` dengan tiket brief sekali pakai, dan mencatat audit privilege serta penyebut KR1.

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

File 6 desain (`ai_employee_jobs`, `ai_employee_dispatch`, cron) tidak dibuat. Migration lama tidak diubah. Penjaga brief diganti lewat file baru.

| Migration | Isi singkat | Rollback |
| --- | --- | --- |
| `supabase/migrations/20261101150000_ai_employee_marker.sql` | Kolom `employees.is_ai`. Unique `(id, organization_id)` pada `employees` dan `departments`. `count_active_employees_for_org` melewatkan `is_ai`. | `supabase/rollback/ai-employee/20261101150000_ai_employee_marker.sql` |
| `supabase/migrations/20261101151000_ai_employee_profile.sql` | Profil, SOP, langkah SOP, jadwal, izin, tiket status, fungsi owner, trigger penolak, RLS. | `supabase/rollback/ai-employee/20261101151000_ai_employee_profile.sql` |
| `supabase/migrations/20261101152000_ai_employee_runs.sql` | Run, masukan reviewer, penghitung panggilan model per tanggal Jakarta. | `supabase/rollback/ai-employee/20261101152000_ai_employee_runs.sql` |
| `supabase/migrations/20261101153000_ai_employee_attribution.sql` | `author_employee_id`, `requested_ai_employee_id`, `ai_revision_count`, `key_results.ai_kr_code`. Foreign key gabungan dengan `SET NULL` satu kolom. | `supabase/rollback/ai-employee/20261101153000_ai_employee_attribution.sql` |
| `supabase/migrations/20261101154000_ai_employee_perform.sql` | Role `ai_employee_runner` dan fungsi pintu, baca, buka/tutup run, kuota, dan hitung ulang KR. | `supabase/rollback/ai-employee/20261101154000_ai_employee_perform.sql` |
| `supabase/migrations/20261101156000_ai_employee_reviewer_notify.sql` | CHECK antrean push diperlebar. | `supabase/rollback/ai-employee/20261101156000_ai_employee_reviewer_notify.sql` |
| `supabase/migrations/20261101157000_ai_employee_brief_ticket.sql` | Tiket brief sekali pakai dan pengganti badan `guard_social_media_plan_brief_pic`. | `supabase/rollback/ai-employee/20261101157000_ai_employee_brief_ticket.sql` |

Rollback dijalankan dari yang paling baru: 157000, 156000, 154000, 153000, 152000, 151000, lalu 150000. `DROP ROLE` ada di dalam blok `DO` yang sama dengan pencabutan grant, setelah dicek di `pg_roles`.

## Fungsi runner dan grant

Role `ai_employee_runner`: `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS`. Role ini di-`GRANT` ke `authenticator` supaya PostgREST bisa `SET ROLE`. Ia punya `USAGE` pada skema `public`. Tidak ada `SELECT`, `INSERT`, `UPDATE`, atau `DELETE` tabel yang diberikan ke role itu.

`CREATE ROLE` dijalankan di dalam blok `DO` pada transaksi migration. Blok itu membuat role hanya bila `pg_roles` belum punya `ai_employee_runner`, lalu `ALTER ROLE` dan `GRANT` mengikuti seperti sebelumnya. `dblink` tidak dipakai.

`CREATE ROLE` dan `DROP ROLE` boleh di dalam transaksi. Halaman [CREATE ROLE](https://www.postgresql.org/docs/current/sql-createrole.html) (PostgreSQL 18) tidak memuat kalimat "cannot be executed inside a transaction block". Kalimat itu ada di halaman [CREATE DATABASE](https://www.postgresql.org/docs/current/sql-createdatabase.html). Tom Lane, 6 Maret 2023, [message-id 3353928.1678116712@sss.pgh.pa.us](https://www.postgresql.org/message-id/3353928.1678116712@sss.pgh.pa.us): DDL Postgres transaksional kecuali halaman manualnya menyatakan sebaliknya.

Tidak ada bukti kuat bahwa migration Supabase menolak `CREATE ROLE`. CLI yang terpasang adalah 2.108.0, satu rilis sebelum penanganan khusus untuk pernyataan yang tidak bisa di-pipeline. Catatan rilis [2.109.0](https://github.com/supabase/cli/releases/tag/v2.109.0) menyebut daftar itu, yaitu pernyataan yang gagal dengan SQLSTATE 25001: `CREATE INDEX CONCURRENTLY`, `VACUUM`, `REINDEX CONCURRENTLY`, `ALTER SYSTEM`, dan `CLUSTER`. `CREATE ROLE` tidak ada di daftar itu. Isu [supabase/cli#2224](https://github.com/supabase/cli/issues/2224) adalah kesalahan privilege `42501`, bukan penolakan transaksi. Penerapan file ini di server lokal belum dijalankan karena Docker tidak hidup. Jika nanti muncul SQLSTATE 25001, itu bukti baru. Sampai ada bukti itu, `dblink` tidak dipakai.

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

## Tiket brief

`ALTER TABLE ... DISABLE TRIGGER` pada `social_media_plans` tidak dipakai. Perintah itu mengunci tabel untuk semua user.

Migration `20261020140000` tidak diubah. Trigger `social_media_plans_brief_pic_guard` tetap terpasang. File `20261101157000` hanya mengganti badan `guard_social_media_plan_brief_pic`.

Urutan di dalam trigger, untuk `BEFORE UPDATE`:

1. Bila `brief` tidak berubah, baris lolos. Sama seperti dulu.
2. Bila `is_plan_pic(OLD.id)` benar, baris lolos. PIC manusia tetap boleh mengubah brief. Kebijakan gambar storyboard yang memakai `is_plan_pic` tidak diubah.
3. Bila tidak, trigger membaca GUC `ai_employee.brief_write` dan menghapus satu baris `ai_employee_brief_tickets` untuk `plan_id` dan token yang sama. Hapus yang ketemu mengizinkan perubahan. Tiket itu sekali pakai.
4. Selain itu, exception tetap `Only the PIC can edit brief content` dengan `42501`.

`ai_employee_perform` menulis tiket itu hanya untuk `content.briefs.create` dan `content.plans.update`, di transaksi yang sama, lalu mengosongkan GUC dan menghapus sisa tiket setelah `UPDATE`. `content.plans.create` menyisipkan brief pada `INSERT`, jadi trigger update tidak jalan.

Tabel tiket dicabut dari `PUBLIC`, `anon`, `authenticated`, dan `service_role`. RLS hidup dan tidak punya policy. Runner tidak punya `UPDATE` tabel, jadi GUC yang tertinggal tidak memberinya jalan menulis brief sendiri.

Rollback mengembalikan badan fungsi ke versi `20261020140000`, mencabut EXECUTE dari `PUBLIC`, lalu menghapus tabel tiket.

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
- Manusia yang bukan PIC ditolak saat mengubah brief, dengan pesan `Only the PIC can edit brief content`. Tiket asli yang dipasangkan dengan GUC palsu juga ditolak, dan brief tidak berubah. `content.briefs.create` lewat pintu AI menyimpan brief.
- Role runner tidak punya SELECT pada `employees`, tetapi bisa memanggil `ai_employee_context`.
- Event `completed` dan `rejected` tetap masuk. Event `run_failed`, `run_late`, `run_deferred`, dan `revision_returned` masuk dengan `daily_task_id` kosong. Event yang tidak dikenal ditolak.
- KR1 pada dua run SOP1 Jumat, satu tepat waktu dan satu telat, menjadi 50. Angka itu memakai penyebut sementara (run yang ditutup). KR3 tetap `unrated` saat plan belum cukup, dan tidak menurunkan `individual_objectives.progress_percentage`.

Perintah, setelah Docker hidup. Ini hanya database lokal. Jangan `supabase db push` dan jangan `supabase link`.

```powershell
npx supabase start
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/ai_employee_phase1.sql
```

`db reset` menghapus isi database lokal. Notice yang diharapkan: `AI_EMPLOYEE_PHASE1_OK`.

Rollback, cek skema, pasang lagi, lalu tes lagi. `DROP ROLE` ada di dalam `DO` dan sah di dalam transaksi yang sama.

```powershell
$psql = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
$files = @(
  "supabase/rollback/ai-employee/20261101157000_ai_employee_brief_ticket.sql",
  "supabase/rollback/ai-employee/20261101156000_ai_employee_reviewer_notify.sql",
  "supabase/rollback/ai-employee/20261101154000_ai_employee_perform.sql",
  "supabase/rollback/ai-employee/20261101153000_ai_employee_attribution.sql",
  "supabase/rollback/ai-employee/20261101152000_ai_employee_runs.sql",
  "supabase/rollback/ai-employee/20261101151000_ai_employee_profile.sql",
  "supabase/rollback/ai-employee/20261101150000_ai_employee_marker.sql"
)
foreach ($file in $files) { psql $psql -v ON_ERROR_STOP=1 -f $file }
psql $psql -v ON_ERROR_STOP=1 -c "SELECT to_regclass('public.ai_employee_profiles') AS profile, to_regclass('public.ai_employee_runs') AS runs, to_regclass('public.ai_employee_brief_tickets') AS brief_tickets, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'is_ai') AS is_ai, EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_employee_runner') AS runner;"
```

Hasil yang diharapkan: `profile`, `runs`, dan `brief_tickets` kosong, `is_ai` false, `runner` false.

Pasang ulang tujuh file, bukan lewat `migration up`, karena riwayat `schema_migrations` masih menganggap file itu sudah jalan.

```powershell
$up = @(
  "supabase/migrations/20261101150000_ai_employee_marker.sql",
  "supabase/migrations/20261101151000_ai_employee_profile.sql",
  "supabase/migrations/20261101152000_ai_employee_runs.sql",
  "supabase/migrations/20261101153000_ai_employee_attribution.sql",
  "supabase/migrations/20261101154000_ai_employee_perform.sql",
  "supabase/migrations/20261101156000_ai_employee_reviewer_notify.sql",
  "supabase/migrations/20261101157000_ai_employee_brief_ticket.sql"
)
foreach ($file in $up) { psql $psql -v ON_ERROR_STOP=1 -f $file }
psql $psql -v ON_ERROR_STOP=1 -f supabase/tests/ai_employee_phase1.sql
```

## Audit privilege PUBLIC

Tidak ada yang dicabut di step ini. Daftar di bawah adalah temuan, bukan perubahan.

`ai_employee_runner` adalah `NOINHERIT` dan bukan anggota `anon`, `authenticated`, atau `service_role`. Grant ke role-role itu tidak otomatis menjadi grant ke runner. Grant ke `PUBLIC` berlaku untuk runner. Postgres memberi EXECUTE pada fungsi baru kepada `PUBLIC` secara default, dan repo ini tidak mencabut default privilege EXECUTE di skema `public`. `CREATE OR REPLACE` mempertahankan ACL yang sudah ada, jadi `REVOKE` lama tetap hidup setelah fungsi diganti.

Pemindaian ini membaca 900 file di `supabase/migrations`, urut nama file. Fungsi yang masih `SECURITY DEFINER` dan masih bisa dieksekusi `PUBLIC` di akhir urutan itu yang masuk daftar. Ada 825 fungsi yang terlacak, 269 yang terbuka: 54 trigger dan 215 yang bisa dipanggil langsung. `REVOKE` yang tidak ketemu fungsinya: tidak ada. Fungsi pintu AI dan `guard_social_media_plan_brief_pic` tidak masuk daftar, karena EXECUTE-nya sudah dicabut dari `PUBLIC`.

Ini pemindaian teks migration, bukan kueri katalog yang hidup. `is_cms_admin()` dipanggil dari banyak fungsi admin, tetapi badan fungsi itu tidak ada di repo. Konfirmasi setelah Docker hidup:

```sql
SELECT p.proname, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND has_function_privilege('public', p.oid, 'EXECUTE')
ORDER BY 1, 2;
```

Arti penilaian:

- **aman**: pemanggilan langsung oleh runner tidak membuka data. Untuk trigger, Postgres menolak sebelum badan fungsi jalan. Runner juga tidak punya DML tabel, jadi ia tidak bisa menyalakan trigger dengan menulis baris. Penilaian itu berubah bila nanti runner diberi DML.
- **perlu dicek**: ada gerbang identitas, tetapi pemindaian ini tidak membuktikan setiap cabang menolak pemanggil tanpa JWT. Tidak dicabut sekarang.
- **perlu dicabut**: runner bisa memanggilnya, dan badan fungsi tidak memeriksa pemanggil. Nanti EXECUTE `PUBLIC` perlu dicabut, sambil `GRANT` tetap diberikan ke `authenticated` atau `service_role` bila aplikasi atau policy memakainya. Jangan dicabut di step ini.

`invoke_social_media_scheduler_edge` membaca `vault.decrypted_secrets` tanpa cek pemanggil. Fungsi `invoke_*` lain dinilai sama karena mereka memanggil edge tanpa cek pemanggil.

### Aman

| Fungsi | Penilaian |
| --- | --- |
| `auto_create_budget_allocation()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `catalog_inventory_guard_pr_approval()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `employees_generate_employee_id()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `enqueue_customer_survey_on_wa_resolve()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `flush_operational_inventory_alert_tx()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `guard_payment_terms_budget_headroom()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `handle_expense_bank_statement_outgoing()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `handle_expense_gateway_wallet_debit()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `handle_new_user_profile()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `init_kol_campaign_budget()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `initialize_bank_account_balance()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `normalize_kol_campaign_targets()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `organization_omnichannel_sla_audit_trigger()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `pause_flow_enrollments_on_assignee()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `pause_lead_magnet_enrollments_on_assignee()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `prevent_payroll_expense_mutation()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `seed_default_pos_outlet()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `seed_permission_configurations_for_organization()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_budget_allocation_from_payment_terms()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_conversion_thresholds_from_conversions()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_email_conv_status_to_lead()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_instagram_conv_status_to_lead()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_lead_assignee_to_facebook_conv()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_lead_assignee_to_instagram_conv()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_lead_assignee_to_threads_conv()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_lead_assignee_to_threads_dm_conv()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_lead_assignee_to_whatsapp_conv()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_payment_milestones()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_performance_thresholds_from_metrics()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `sync_wa_conv_status_to_lead()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `track_lead_status_change()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_cancel_scheduled_posts_on_plan_gate_change()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_catalog_ingredient_outlets_inventory_alert()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_completion_approval_rejected_notify()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_daily_task_assignment_notify()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_daily_task_completed_notify()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_enqueue_google_contacts_from_leads()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_enqueue_google_contacts_from_submissions()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_gateway_disbursement_finalize_pr()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_social_media_plans_production_notify()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_sub_step_completed_notify()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_task_step_comment_notify()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_task_step_comment_reaction_notify()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trg_task_step_completed_notify()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trigger_apply_performance_bonus()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trigger_notify_review_comment()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trigger_refresh_payout_on_milestone_change()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trigger_refresh_payout_on_payment_terms()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trigger_sync_follow_up_priority()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trigger_sync_milestones_from_payment_status()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trigger_sync_payment_status_from_milestones()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `trigger_sync_threshold_rows_from_payment_terms()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `update_campaign_budget_totals()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `update_lead_converted_at()` | Hanya jalan sebagai trigger. Pemanggilan langsung ditolak Postgres sebelum badan fungsi. |
| `build_daily_task_deeplink(text, uuid, uuid, uuid)` | Hanya merangkai path dari argumen. Tidak membaca tabel. |
| `build_task_step_comment_deeplink(uuid, uuid)` | Hanya merangkai path dari argumen. Tidak membaca tabel. |
| `sla_add_working_minutes(timestamptz, integer, text, text, jsonb)` | Hanya menghitung waktu dari argumen. Tidak membaca tabel tenant. |
| `sla_inter_reply_worst_in_cycle(integer, text, text, jsonb, timestamptz, timestamptz, jsonb)` | Hanya menghitung SLA dari argumen jsonb. Tidak membaca tabel tenant. |
| `sla_working_minutes_between(timestamptz, timestamptz, text, text, jsonb)` | Hanya menghitung waktu dari argumen. Tidak membaca tabel tenant. |

### Perlu dicek

| Fungsi | Penilaian |
| --- | --- |
| `admin_create_subscription_plan(text, numeric, jsonb, boolean, text, text, jsonb, integer, integer)` | Ada is_cms_admin() dan pemeriksaan auth. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `admin_create_subscription_plan(text, numeric, jsonb, boolean, text, text, numeric, integer, integer)` | Ada is_cms_admin() dan pemeriksaan auth. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `admin_create_subscription_plan(text, numeric, jsonb, boolean, text, text, numeric, integer)` | Ada is_cms_admin() dan pemeriksaan auth. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `admin_delete_organization(uuid, text, text, text)` | Sudah dibaca: menolak bila is_cms_admin() false atau auth.uid() kosong, sebelum menghapus. Badan is_cms_admin() tidak ada di repo. |
| `admin_get_organization_sales_modules(uuid)` | Pintu pertama is_cms_admin(). Definisi fungsi itu tidak ada di repo, jadi belum pasti runner ditolak. |
| `admin_get_plan_modules(uuid)` | Pintu pertama is_cms_admin(). Definisi fungsi itu tidak ada di repo, jadi belum pasti runner ditolak. |
| `admin_list_organization_module_adjustments(uuid, integer)` | Pintu pertama is_cms_admin(). Definisi fungsi itu tidak ada di repo, jadi belum pasti runner ditolak. |
| `admin_list_organizations(text, text, integer, integer)` | Sudah dibaca: menolak bila is_cms_admin() false, lalu mengembalikan email dan langganan organisasi. Badan is_cms_admin() tidak ada di repo. |
| `admin_list_plan_add_on_overrides(uuid)` | Pintu pertama is_cms_admin(). Definisi fungsi itu tidak ada di repo, jadi belum pasti runner ditolak. |
| `admin_list_plan_module_adjustments(uuid, integer)` | Pintu pertama is_cms_admin(). Definisi fungsi itu tidak ada di repo, jadi belum pasti runner ditolak. |
| `admin_list_plan_price_adjustments(text, uuid, uuid, uuid, integer)` | Pintu pertama is_cms_admin(). Definisi fungsi itu tidak ada di repo, jadi belum pasti runner ditolak. |
| `admin_list_subscription_add_ons()` | Pintu pertama is_cms_admin(). Definisi fungsi itu tidak ada di repo, jadi belum pasti runner ditolak. |
| `admin_list_subscription_plans()` | Pintu pertama is_cms_admin(). Definisi fungsi itu tidak ada di repo, jadi belum pasti runner ditolak. |
| `admin_preview_organization_deletion(uuid)` | Sudah dibaca: menolak bila is_cms_admin() false, lalu membaca ringkasan organisasi. Badan is_cms_admin() tidak ada di repo. |
| `admin_update_organization_sales_modules(uuid, jsonb, text)` | Ada is_cms_admin() dan pemeriksaan auth. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `admin_update_organization_settings(uuid, boolean, text)` | Sudah dibaca: menolak bila is_cms_admin() false atau auth.uid() kosong, sebelum mengubah. Badan is_cms_admin() tidak ada di repo. |
| `admin_update_plan_add_on_override(uuid, uuid, numeric, text)` | Ada is_cms_admin() dan pemeriksaan auth. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `admin_update_plan_modules(uuid, jsonb, text)` | Ada is_cms_admin() dan pemeriksaan auth. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `admin_update_subscription_add_on(uuid, numeric, boolean, boolean, text)` | Ada is_cms_admin() dan pemeriksaan auth. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `admin_update_subscription_plan(uuid, numeric, jsonb, integer, integer, boolean, text)` | Ada is_cms_admin() dan pemeriksaan auth. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `admin_update_subscription_plan(uuid, numeric, numeric, integer, boolean, text)` | Ada is_cms_admin() dan pemeriksaan auth. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `admin_update_subscription_plan(uuid, numeric, numeric, integer, integer, boolean, text)` | Ada is_cms_admin() dan pemeriksaan auth. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `admin_verify_organization_deleted(uuid)` | Pintu pertama is_cms_admin(). Definisi fungsi itu tidak ada di repo, jadi belum pasti runner ditolak. |
| `api_current_user_is_active_org_owner()` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `apply_catalog_checkout_stock(uuid, uuid, text, jsonb)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `apply_catalog_fulfillment_stock(uuid, uuid, uuid, jsonb, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `apply_catalog_ingredient_produce(uuid, uuid, uuid, numeric, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `apply_catalog_kitchen_commit_stock(uuid, uuid, uuid, jsonb, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `apply_catalog_stock_movement(uuid, uuid, text, uuid, uuid, uuid, text, numeric, text, text, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `apply_catalog_stock_reserve(uuid, uuid, uuid, jsonb, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `approve_catalog_stock_transfer(uuid, uuid, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `cancel_catalog_purchase_order(uuid, uuid, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `cancel_catalog_stock_transfer(uuid, uuid, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `catalog_po_actor_name(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `catalog_transfer_insert_event(uuid, uuid, text, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `clear_mfa_recovery_codes()` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `consume_mfa_recovery_code(text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `create_catalog_purchase_order(uuid, uuid, uuid, text, text, jsonb, boolean)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `create_catalog_stock_transfer(uuid, uuid, uuid, text, text, jsonb)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `create_expense_from_brick_debt_line(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `fulfill_catalog_purchase_order(uuid, uuid, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `fulfill_catalog_stock_transfer(uuid, uuid, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `get_email_conversations_with_preview(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `get_facebook_conversations_with_preview(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `get_instagram_conversations_with_preview(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `get_threads_dm_conversations_with_preview(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `get_whatsapp_conversations_with_preview(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `is_omnichannel_survey_settings_admin(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `log_auth_security_event(text, jsonb)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `mark_email_conversation_read(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `mark_facebook_conversation_read(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `mark_instagram_conversation_read(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `mark_review_comment_notifications_read(uuid[])` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `mark_social_media_production_notifications_read(uuid[])` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `mark_whatsapp_conversation_read(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `migrate_legacy_sku_to_catalog_stock(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_collected_by_sales_by_payment(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_collected_by_sales_report(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_discount_sales_by_value(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_discount_sales_report(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_gratuity_sales_by_rate(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_gratuity_sales_report(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_invoice_cancel(uuid, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_invoices_report(uuid, uuid, timestamptz, timestamptz, text, text, timestamptz, integer)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_modifier_sales_by_option(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_modifier_sales_report(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_served_by_sales_by_sales_type(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_served_by_sales_report(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_tax_sales_by_rate(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_tax_sales_report(uuid, uuid, timestamptz, timestamptz)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_transactions_cancelled_orders(uuid, uuid, timestamptz, timestamptz, timestamptz, integer)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_transactions_success_orders(uuid, uuid, timestamptz, timestamptz, text, timestamptz, integer)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `pos_transactions_void_items(uuid, uuid, timestamptz, timestamptz, timestamptz, integer)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `release_catalog_stock_reserve(uuid, uuid, uuid, jsonb, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `resubmit_catalog_po_purchase_request(uuid, uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `reverse_catalog_kitchen_commit(uuid, uuid, text, jsonb)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `reverse_store_checkout_stock(uuid, text, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `ship_catalog_stock_transfer(uuid, uuid, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `store_mfa_recovery_codes(text[])` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `sync_catalog_po_purchase_request(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `task_step_comment_can_access(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `task_step_comment_can_write(uuid)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `transfer_ownership(uuid, text)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |
| `update_catalog_purchase_order(uuid, uuid, text, jsonb)` | Ada auth.uid(), auth.role(), user_organization_ids(), atau request.jwt. Belum dibuktikan setiap cabang menolak pemanggil tanpa JWT. |

### Perlu dicabut

| Fungsi | Penilaian |
| --- | --- |
| `_apply_catalog_stock_lines(uuid, uuid, text, text, jsonb, text)` | Mengubah modul, fitur, atau stok tanpa cek pemanggil. |
| `_apply_plan_modules(uuid, jsonb)` | Mengubah modul, fitur, atau stok tanpa cek pemanggil. |
| `_collect_organization_auth_users_to_delete(uuid)` | Mengumpulkan user auth yang akan dihapus, tanpa cek pemanggil. |
| `_count_organization_rows(uuid)` | Menghitung isi organisasi tanpa cek pemanggil. |
| `_organization_has_cms_admin_member(uuid)` | Menjawab apakah organisasi punya anggota CMS, tanpa cek pemanggil. |
| `_plan_modules_json_for_plan(uuid)` | Membaca konfigurasi modul plan tanpa cek pemanggil. |
| `_purge_organization_rows(uuid)` | Menghapus baris organisasi tanpa cek pemanggil. |
| `_regenerate_plan_features_for_plan(uuid)` | Mengubah modul, fitur, atau stok tanpa cek pemanggil. |
| `apply_due_subscription_change_requests()` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `apply_meta_session_expired_conversations()` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `apply_performance_bonus(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `apply_template_followup_customer_reply(uuid, uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `apply_template_followup_sent(uuid, uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `auto_resolve_conversations_after_24h()` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `auto_resolve_email_conversations_after_24h()` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `cancel_social_media_scheduled_posts_for_plan(uuid, text)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `catalog_po_update_avg_cost(uuid, uuid, text, uuid, uuid, uuid, numeric, numeric)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `catalog_transfer_actor_name(uuid)` | Membaca nama, email, user id, atau token tanpa cek pemanggil. |
| `catalog_transfer_ensure_dest_row(uuid, uuid, text, uuid, uuid, uuid, boolean)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `catalog_transfer_fulfill_line(uuid, uuid, uuid, text, text, record)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `catalog_transfer_ship_line(uuid, uuid, uuid, text, text, record)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `check_campaign_budget_headroom(uuid, numeric)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `claim_daily_task_assignment_push_queue(uuid, integer, integer)` | Mengunci antrean atau posting untuk argumen yang diberikan, tanpa cek pemanggil. |
| `claim_daily_task_completion_push_queue(uuid, integer, integer)` | Mengunci antrean atau posting untuk argumen yang diberikan, tanpa cek pemanggil. |
| `claim_due_scheduled_posts(integer, integer)` | Mengunci antrean atau posting untuk argumen yang diberikan, tanpa cek pemanggil. |
| `claim_due_scheduled_posts(integer)` | Mengunci antrean atau posting untuk argumen yang diberikan, tanpa cek pemanggil. |
| `claim_google_contacts_sync_jobs(integer)` | Mengunci antrean atau posting untuk argumen yang diberikan, tanpa cek pemanggil. |
| `claim_resume_publishing_posts(integer)` | Mengunci antrean atau posting untuk argumen yang diberikan, tanpa cek pemanggil. |
| `claim_social_media_production_push_queue(uuid, integer, integer)` | Mengunci antrean atau posting untuk argumen yang diberikan, tanpa cek pemanggil. |
| `claim_task_step_comment_push_queue(uuid, integer, integer)` | Mengunci antrean atau posting untuk argumen yang diberikan, tanpa cek pemanggil. |
| `cleanup_social_media_load_test_rows()` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `completion_pending_approval(text, uuid, uuid, uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `count_template_followups_since_reset(uuid, uuid, timestamptz)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `credit_income_bank_deposit(uuid, uuid, uuid, numeric, uuid, text)` | Menulis saldo, mutasi bank, atau alokasi anggaran tanpa cek pemanggil. |
| `delete_public_review_comment(uuid, text, text)` | Menulis ulasan publik tanpa cek pemanggil di fungsi ini. |
| `employee_display_name(uuid)` | Membaca nama, email, user id, atau token tanpa cek pemanggil. |
| `employee_user_id(uuid)` | Membaca nama, email, user id, atau token tanpa cek pemanggil. |
| `enqueue_google_contacts_sync(uuid, uuid, text)` | Mengantrikan push atau pekerjaan untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `enqueue_task_step_comment_push(uuid, text)` | Mengantrikan push atau pekerjaan untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `enqueue_task_step_comment_reaction_push(uuid, uuid)` | Mengantrikan push atau pekerjaan untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `ensure_livechat_lead_statuses_for_org(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `ensure_open_threads_dm_conversation_cycle(uuid, uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `get_crm_first_response_time_per_room(uuid)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `get_email_unread_counts(uuid)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `get_facebook_unread_counts(uuid)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `get_instagram_unread_counts(uuid)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `get_public_review_brief_extended_by_token(text)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `get_public_review_comments(text)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `get_public_review_content_by_token(text)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `get_social_media_schedule_monitoring_summary()` | Mengembalikan contoh posting terjadwal lintas organisasi, tanpa cek pemanggil. |
| `get_social_media_scheduler_config()` | Membaca konfigurasi internal scheduler tanpa cek pemanggil. |
| `get_threads_conversations_with_preview(uuid)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `get_whatsapp_conversation_ids_by_message_search(uuid, text)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `get_whatsapp_cycle_metrics(uuid)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `get_whatsapp_unread_counts(uuid)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `insert_daily_task_assignment_notification(uuid, uuid, text, text, uuid, uuid, uuid, text, timestamptz, uuid, text)` | Menulis notifikasi untuk penerima yang diberikan argumen, tanpa cek pemanggil. |
| `insert_daily_task_completion_notification(uuid, uuid, text, text, uuid, uuid, uuid, uuid, uuid, text, boolean, uuid, text)` | Menulis notifikasi untuk penerima yang diberikan argumen, tanpa cek pemanggil. |
| `insert_public_review_comment(text, text, text, numeric, jsonb)` | Menulis ulasan publik tanpa cek pemanggil. |
| `insert_social_media_production_notification(uuid, uuid, text, uuid, text, uuid, uuid, uuid, text, text)` | Menulis notifikasi untuk penerima yang diberikan argumen, tanpa cek pemanggil. |
| `invoke_dispatch_operational_inventory_alert(uuid)` | Memanggil edge function tanpa cek pemanggil. |
| `invoke_google_ads_pending_conversions_edge()` | Memanggil edge function tanpa cek pemanggil. |
| `invoke_google_contacts_sync_edge()` | Memanggil edge function tanpa cek pemanggil. |
| `invoke_operational_daily_sales_edge()` | Memanggil edge function tanpa cek pemanggil. |
| `invoke_operational_inventory_alerts_edge()` | Memanggil edge function tanpa cek pemanggil. |
| `invoke_social_media_scheduler_edge()` | Memanggil edge function tanpa cek pemanggil. |
| `invoke_tiktok_content_scheduler_edge()` | Memanggil edge function tanpa cek pemanggil. |
| `invoke_tiktok_shop_token_refresh_edge()` | Memanggil edge function tanpa cek pemanggil. |
| `is_blibli_seller_chat_connected(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_google_ads_connected(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_google_ads_integration_enabled(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_google_ads_reporting_enabled(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_google_contacts_connected(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_linkedin_content_connected(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_linkedin_content_reporting_enabled(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_meta_ads_connected(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_meta_ads_integration_enabled(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_meta_ads_reporting_enabled(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_tiktok_ads_connected(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_tiktok_ads_integration_enabled(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_tiktok_ads_reporting_enabled(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_tiktok_content_connected(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_tiktok_content_reporting_enabled(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_tiktok_shop_connected(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_tiktok_shop_integration_enabled(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_youtube_content_connected(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `is_youtube_content_reporting_enabled(uuid)` | Mengungkap status sambungan ads, toko, atau kontak organisasi lain. |
| `latest_review_token_for_plan(uuid)` | Membaca nama, email, user id, atau token tanpa cek pemanggil. |
| `latest_step_assignment(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `latest_substep_assignment(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `latest_task_assignment(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `lead_status_is_resolved_or_expired_visibility(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `lead_status_is_resolved_survey(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `omnichannel_employee_sees_conversation(uuid, uuid, uuid, uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `process_due_flow_delay_jobs(integer)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `production_review_url_for_assigner(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `profile_display_name(uuid, uuid)` | Membaca nama, email, user id, atau token tanpa cek pemanggil. |
| `profile_user_id(uuid)` | Membaca nama, email, user id, atau token tanpa cek pemanggil. |
| `recalculate_pinjaman_online_debt_amount(uuid)` | Mengubah jumlah utang tanpa cek pemanggil. |
| `record_attendance_from_client_visit(uuid, uuid, date, uuid, uuid, timestamptz, jsonb, text, text, boolean, text)` | Menulis absensi tanpa cek pemanggil. |
| `recover_stale_publishing_rows(integer)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `refresh_budget_allocation_payout(uuid, uuid)` | Menulis saldo, mutasi bank, atau alokasi anggaran tanpa cek pemanggil. |
| `refresh_organization_has_active_subscription(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `resolve_assignment_due_date(text, uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `resolve_daily_task_entity_title(text, uuid, uuid, uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `resolve_inventory_po_expense_classification(uuid, text)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `resolve_production_assignee_user_id(uuid)` | Membaca nama, email, user id, atau token tanpa cek pemanggil. |
| `resolve_production_assigner_user_id(uuid)` | Membaca nama, email, user id, atau token tanpa cek pemanggil. |
| `resolve_sla_policy_row(uuid, text)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `search_facebook_messages(uuid, text)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `search_whatsapp_messages(uuid, text)` | Membaca data tenant untuk id yang diberikan argumen, tanpa cek pemanggil. |
| `seed_plan_module_access_defaults(uuid)` | Mengubah modul, fitur, atau stok tanpa cek pemanggil. |
| `seed_sales_module_access_defaults(uuid)` | Mengubah modul, fitur, atau stok tanpa cek pemanggil. |
| `sync_conversation_last_message(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `sync_follow_up_priority_for_conversation(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `sync_follow_up_priority_for_lead(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `sync_milestones_from_payment_status(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `sync_payment_status_from_milestones(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `sync_threshold_rows_from_payment_terms(uuid)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `try_acquire_social_media_publish_slot(uuid, text, integer)` | Membaca atau mengubah data tenant tanpa cek pemanggil. |
| `update_public_review_comment(uuid, text, text, text)` | Menulis ulasan publik tanpa cek pemanggil di fungsi ini. |
| `upsert_bank_statement_from_brick_callback(uuid, uuid, text, timestamptz, numeric, text, text, jsonb)` | Menulis saldo, mutasi bank, atau alokasi anggaran tanpa cek pemanggil. |
| `upsert_bank_statement_from_brick_disbursement_callback(uuid, uuid, text, timestamptz, numeric, text, text, jsonb)` | Menulis saldo, mutasi bank, atau alokasi anggaran tanpa cek pemanggil. |
| `upsert_bank_statement_from_erp_expense(uuid)` | Menulis saldo, mutasi bank, atau alokasi anggaran tanpa cek pemanggil. |
| `upsert_bank_statement_from_gateway_withdrawal(uuid)` | Menulis saldo, mutasi bank, atau alokasi anggaran tanpa cek pemanggil. |
| `upsert_kol_budget_allocation(uuid, uuid, uuid, numeric, text, uuid)` | Menulis saldo, mutasi bank, atau alokasi anggaran tanpa cek pemanggil. |
| `user_display_name(uuid)` | Membaca nama, email, user id, atau token tanpa cek pemanggil. |

## Penyimpangan dari desain 03 v1.1

- Sketsa di desain menulis `ON DELETE SET NULL` tanpa daftar kolom. Migration memakai `ON DELETE SET NULL (kolom karyawan)` supaya `organization_id` tidak ikut kosong.
- Status kinerja tidak hanya mengandalkan GUC. Fungsi owner menulis tiket sekali pakai di `ai_employee_status_tickets`. Trigger menghapus tiket yang cocok. `set_config` dengan token sembarang ditolak. Tabel tiket dicabut dari `PUBLIC`, `anon`, `authenticated`, dan `service_role`.
- `thinking.execution.check` hanya memastikan run, profil, dan izin, lalu mengembalikan `accepted`. SQL tidak memanggil `generate-script-ai`.
- `thinking.plan.save` dan `thinking.plan.direct` menulis baris `social_media_plans` sendiri. Keduanya tidak memanggil `mcp_create_thinking_plan`, karena fungsi itu membutuhkan user manusia dan format brief yang kaku. Template shot Thinking Lab tidak divalidasi di pintu SQL.
- Perubahan brief tidak mematikan trigger. Pintu AI menulis tiket sekali pakai, dan trigger yang sama mengizinkan perubahan hanya bila tiket itu cocok. Manusia bukan PIC tetap ditolak dengan pesan dan SQLSTATE yang sama.
- `ai_employee_model_calls` hanya merujuk `employees.id`. Penghitung tidak punya `organization_id`. `employees.id` sudah unik, jadi tidak ada pasangan organisasi yang bisa salah.
- Penyebut KR1 yang sekarang adalah run `SOP1` yang sudah ditutup (`succeeded`, `late`, `failed`, `deferred`, `returned`). Pembilang adalah run `succeeded` yang dimulai pada hari Jumat Asia/Jakarta dan selesai paling lambat pukul 17:00 pada tanggal mulai yang sama. Penyebut yang benar adalah minggu yang dijadwalkan, bukan run yang ditutup. Rumus SQL belum diubah. Perbaikan dilakukan di step 5, saat instance jadwal dibuat.
- Rantai Thinking Lab yang dibaca hanya `thinking_master_thoughts.status = 'locked'`. Status `audited` tidak ikut.
- Teks push FCM untuk event baru belum diubah. Fungsi edge tetap seperti sekarang.
- Antrean job dan cron tidak dibuat. Itu file 6, step 5.
- `service_role` tidak menerima EXECUTE. Cadangan itu menunggu uji JWT di step 6.

## Hal yang belum pasti

- Versi Postgres yang benar-benar menjawab `SELECT version()` di mesin ini. Yang diketahui baru image default CLI, yaitu 17.6.1.143. Konfirmasi setelah `supabase start`.
- Hasil tes SQL dan kueri katalog privilege di atas. Keduanya belum dijalankan karena Docker tidak hidup.
- Badan `is_cms_admin()`. Fungsi itu tidak didefinisikan di repo ini. Selama begitu, fungsi admin yang hanya mengandalkannya tetap berstatus perlu dicek.
- Nama departemen digital marketing yang tepat. Itu urusan seed step 4b.
- Apakah project hosted masih menerima JWT HS256 dengan role kustom. Uji satu RPC disimpan untuk step 6.
- Apakah setiap `thinking.execution.check` menulis `content_ai_usage`. Itu baru bisa dipastikan saat `generate-script-ai` diubah di step 7.
- GUC kustom `ai_employee.status_write` dan `ai_employee.brief_write` bisa memunculkan peringatan `unrecognized configuration parameter` pada sebagian versi. Tiket sekali pakai tetap yang menentukan boleh tidaknya perubahan.
