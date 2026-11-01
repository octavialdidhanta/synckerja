# AI Employee — Step 3: Desain teknis fase 1 (v1.1)

Status: desain v1.1 untuk review. Belum ada migration, perubahan kode, atau tulisan ke database. Acuan: `docs/ai-employee/01-audit.md` dan `docs/ai-employee/02-definisi.md` v1.1.

Cakupan dokumen ini fase 1. Fase 2 hanya disebut sebagai tempat menempel.

## A. Hasil verifikasi

### 1. UI assignee dan karyawan tanpa `user_id`

Ditampilkan. Pemilih assignee daily task memakai `useAvailableEmployees` lewat `src/8-2-DailyTask/section/AssignTaskModal.tsx`. Modal yang sama dipakai `TaskForm` dan `CreateTaskDialog`. Modal penugas plan (`src/6-1-dashboard/modal/AssignSocialMediaPlanModal.tsx`) memakai hook yang sama.

Query di `src/shared/hooks/useAvailableEmployees.ts` memilih `id, full_name, email, employee_status_id, pending_removal` dengan `organization_id`, tanpa syarat `user_id`. Filter berikutnya hanya `isEmployeeActive` di `src/2-1-employees/utils/employeeUtils.ts`: buang `pending_removal` dan status yang mengandung inactive, terminated, atau resigned. `user_id` null lolos.

`src/8-2-DailyTask/section/JobDescTracker/useJobDescAssignments.ts` juga mengambil semua karyawan organisasi lalu membuang status nonaktif, tanpa syarat `user_id`.

Dampak: Naya dengan `user_id` null dan status aktif muncul di daftar assignee. Jangan memakai status resigned untuk menyembunyikannya dari kuota, karena daftar ini akan ikut menyembunyikannya.

### 2. Rollup progres individual objective

Tidak otomatis ditulis dari key result berbobot.

`individual_objectives.progress_percentage` dan `key_results.progress_percentage` disimpan terpisah. Check-in di `ObjectiveCheckinForm.tsx` menulis angka yang diisi manusia. Tidak ada trigger SQL yang merata-rata bobot key result ke objective.

Yang ada hanya hitungan tampilan di `src/1-home/components/HomeOKRDashboard/hooks/objectiveStatsQuery.ts`. Untuk objective individu yang punya key result, progres statistik = rata-rata sederhana `keyResultProgress`, tanpa kolom `weight`. Key result `metric_type = 'number'` dihitung dari `current_value / target_value`. Selain itu dipakai `progress_percentage`. Objective tanpa key result memakai `progress_percentage` yang tersimpan.

Akibat untuk fase 1: key result yang tertinggal di angka 0 ikut menarik rata-rata statistik home. Fungsi tulis KPI di bagian E harus mengecualikan KR yang belum dinilai, dan step 4 menyesuaikan tampilan ini.

### 3. `count_active_employees_for_org`

Definisi terakhir ada di `supabase/migrations/20260429120000_employees_org_scope_active_count.sql`. Menghitung karyawan organisasi yang `pending_removal` bukan true dan status `active` atau `probation`. Tidak ada cabang AI.

Pemakai yang sudah ada:

- `get_subscription_status` di `supabase/migrations/20260407120000_10-subscription_schema_rpc.sql` mengisi `employee_count` dan `is_over_limit` (`employee_count > member_count`)
- `can_add_employee` di file yang sama menolak karyawan baru bila hitungan sudah mencapai `member_count`. Dipanggil dari `src/10-subscription/hooks/useOptimizedSubscription.ts`
- Hitungan yang sama dipakai entitlement lead magnet, kursi omnichannel, addon POS, dan payload perubahan langganan (`20260717130000`, `20260511200000`, `20260930241000`, `20260930660000`, `20260718120000`)

Bila AI dikecualikan di fungsi ini, semua pemakai di atas ikut berubah. Naya tidak makan kursi langganan dan tidak membuat `is_over_limit` true. Kursi manusia yang tersisa di `can_add_employee` tidak berkurang karena Naya. Tidak perlu mengubah tiap pemanggil.

### 4. Status produksi dan tanggal plan

Nama di v1.1 cocok dengan helper SQL, tetapi ejaan yang ditulis UI berbeda.

Kolom di `social_media_plans`:

- `production_status text`, boleh null, tanpa CHECK. Helper di `supabase/migrations/20260529120000_social_media_production_push_notifications.sql` membandingkan setelah `lower(trim(...))`: `need review`, `request revision` atau `request revisi`, dan `approved`
- UI menulis ejaan judul. `ContentPlanTable.tsx` membandingkan `'Request Revision'`, `'Need Review'`, dan `'Approved'`
- `approved boolean NOT NULL DEFAULT false` dan `production_approved boolean NOT NULL DEFAULT false` adalah dua kolom terpisah dari teks status
- `post_date timestamptz`. Tool MCP menyimpan tanggal kalender sebagai tengah malam Asia/Jakarta (`20261101060000_mcp_content_brief.sql`)
- Jadwal tayang bukan kolom plan. Ada di `social_media_scheduled_posts`. Trigger di `20260623120500_social_media_scheduled_posts_core.sql` membatalkan jadwal bila `approved` bukan true, `production_approved` bukan true, `google_drive_link` kosong, `post_date` null, atau tipe konten bukan Reel
- Ada juga `status text NOT NULL DEFAULT 'draft'` plus `revision_count`, terpisah dari `production_status` dan `production_revision_count`

Koreksi terhadap v1.1: runner menulis `production_status = 'Need Review'`. Helper SQL tetap mengenali huruf kecil. Naya tidak mengubah `approved`, `production_approved`, atau `content.plans.schedule`.

### 5. `generate-script-ai`, pemakaian, dan `daily_limit`

`supabase/functions/generate-script-ai/index.ts`:

- Membaca `organization_script_ai_config.daily_limit`. Kosong dianggap 50, lalu minimal 1
- Tanggal pemakaian adalah `new Date().toISOString().slice(0, 10)`, yaitu tanggal UTC, bukan Asia/Jakarta
- Membaca `script_ai_daily_usage` per `organization_id` + `usage_date`. Jika `count >= daily_limit`, respons 429
- `count` naik 1 hanya setelah model mengembalikan naskah. Kegagalan provider tidak menaikkan count
- Kenaikan ini read-then-write tanpa kunci baris. Dua panggilan bersamaan bisa melewati batas. Ini perilaku yang sudah ada
- `content_ai_usage` ditulis hanya bila ada master thought yang sah, atau bila pemanggilan skrip biasa meminta pelacakan plan. `thinking.execution.check` lewat purpose `thinking_json` tidak masuk cabang plan itu. **Belum pasti** apakah setiap cek execution menulis `content_ai_usage`. Cara memastikan: baca `recordContentUsage` dan payload `services/mcp/src/db/thinkingLab.ts` pada satu panggilan sukses. Yang pasti, `script_ai_daily_usage.count` tetap naik untuk panggilan yang menghasilkan naskah, termasuk cek itu
- Jalur internal function ini mensyaratkan `purpose = thinking_json`, header `x-synckerja-internal-secret`, dan `user_id` yang masih anggota `user_organizations`. Naya tidak punya `user_id`. Step 7 menambah cabang internal yang menerima `employees.id` bertanda `is_ai`, tanpa meminjam user owner. `actor_user_id` pada `content_ai_usage` untuk panggilan itu tetap null

Batas 15 panggilan Naya dihitung per tanggal Asia/Jakarta pada `ai_employee_model_calls`. Batas itu tidak memakai `content_ai_usage`. Sisa kuota organisasi tetap dibaca dari `script_ai_daily_usage` pada tanggal UTC yang function itu sudah pakai.

## B. Model data fase 1

Pola yang diikuti:

- RLS baca anggota organisasi seperti `daily_tasks_org_all` di `supabase/migrations/20260430220000_daily_tasks_blockers_reference_core.sql`, memakai `user_organization_ids()`
- Tulis runtime tidak diberi ke `authenticated`. Pintu tulisnya fungsi `SECURITY DEFINER`, pola `mcp_switch_organization` di `supabase/migrations/20261101140000_mcp_connector_sessions.sql`
- `REVOKE` dari `anon` dan `authenticated` untuk tabel antrean, lalu `GRANT` ke `service_role`, seperti `mcp_connector_sessions`

Kolom pada tabel lama dipakai bila objeknya memang sudah ada di situ: penanda AI pada `employees`, pembuat plan, dan penanda tugas dadakan. Tabel baru dipakai bila satu karyawan bisa punya banyak baris (SOP, jadwal, run, feedback, izin) atau bila mencampur ke tabel manusia membuat syarat yang tidak berlaku untuk manusia.

| Konsep | Tempat | Kolom utama | Relasi dan batas | RLS |
| --- | --- | --- | --- | --- |
| Penanda AI | Kolom baru `employees` | `is_ai boolean NOT NULL DEFAULT false` | Tidak mengganti `user_id`. Tetap boleh null | Kebijakan karyawan yang sudah ada. Owner, admin, atau hr yang mengubah lewat UI step 4 |
| Profil | Tabel `ai_employee_profiles` | `employee_id` PK, `organization_id`, `job_title`, `department_id`, `reviewer_employee_id`, `time_zone`, `is_active`, `performance_status` | Satu profil per karyawan. `department_id` dan reviewer wajib organisasi yang sama lewat foreign key gabungan. Reviewer awal = karyawan owner | Baca: anggota organisasi. Status tidak diubah lewat UPDATE baris. Lihat fungsi owner di bawah |
| SOP | `ai_employee_sops` dan `ai_employee_sop_steps` | `code`, `version`, `is_current`, `step_no`, `may_call_model` | Satu versi aktif per karyawan per kode SOP. Langkah model hanya yang ditandai | Baca: anggota organisasi. Tulis: owner. Runner hanya membaca |
| Jadwal rutin | `ai_employee_schedules` | `sop_code`, `weekday`, `start_local`, `due_local`, `window_start_weekday`, `window_end_weekday` | Untuk SOP 1: Jumat 15:00, batas 17:00, jendela Senin–Minggu berikutnya | Sama dengan SOP |
| Log run | `ai_employee_runs` | `started_at`, `finished_at`, `status`, `model_calls`, `plan_count`, `object_ids` | Status: `running`, `succeeded`, `deferred`, `late`, `failed`. `model_calls` termasuk `thinking.execution.check` | Baca: anggota organisasi. Tulis: fungsi runner saja |
| Atribusi plan | Kolom baru `social_media_plans.author_employee_id` | uuid null | Bukan `pic_id`. `pic_id` tetap PIC manusia. Index `(organization_id, author_employee_id, post_date)` | Kebijakan plan yang sudah ada. Runner mengisi lewat fungsi |
| Tugas dadakan | Kolom baru `daily_tasks.requested_ai_employee_id` | uuid null | Assignee tetap di `daily_tasks_assigned`. `created_by` tetap user manusia. `assigned_by` tetap karyawan manusia | Kebijakan tugas yang sudah ada |
| Feedback | `ai_employee_feedback` | `object_type`, `object_id`, `reason`, `reviewer_employee_id`, `expires_at`, `dismissed_at` | Berlaku 8 minggu. Paling baru 10 yang belum kedaluwarsa masuk prompt | Baca: anggota organisasi. Tulis: fungsi runner dan owner saat menandai tidak berlaku |
| Izin aksi | `ai_employee_permissions` | `action_code` | Unik per `(employee_id, action_code)`. Isi awal = allowlist bagian B v1.1 | Baca: anggota organisasi. Tulis: owner. Runner hanya membaca |
| Revisi | Pakai kolom yang sudah ada, plus satu kolom tugas | Plan: `production_revision_count`. Tugas: `daily_tasks.ai_revision_count integer NOT NULL DEFAULT 0` | UI sudah menaikkan `production_revision_count` saat manusia memilih Request Revision. Jangan buat penghitung plan kedua | Tugas mengikuti RLS tugas |

`performance_status` memakai nilai `on_track`, `attention`, `coaching`, `disabled`, default `on_track`. Mesin transisi fase 2 nanti mengisi kolom yang sama lewat fungsi yang sama. Tidak ada tabel status terpisah di fase 1.

RLS Postgres berlaku per baris, bukan per kolom. Memberi `UPDATE` pada `ai_employee_profiles` kepada owner akan ikut membuka `job_title`, reviewer, dan `is_active`. Karena itu status tidak ditulis dengan UPDATE klien.

Pilihan: fungsi `ai_employee_set_performance_status(employee_id, status)` ditambah trigger penolak. Fungsi itu `SECURITY DEFINER`, memeriksa `auth.uid()` punya `user_roles.role = 'owner'` pada organisasi profil, lalu mengubah hanya kolom status. Trigger `BEFORE UPDATE` menolak perubahan `performance_status` bila GUC transaksi `ai_employee.status_write` tidak bernilai `owner-function`. Hanya fungsi itu yang mengisi GUC, dan hanya untuk transaksi berjalan. Klien Supabase tidak bisa menjalankan `SET` bebas. Runner tidak memanggil fungsi ini.

Trigger dipilih sebagai pengaman, bukan sebagai pengganti fungsi. Tanpa fungsi, owner tidak punya jalan yang memeriksa role. Tanpa trigger, siapa pun yang nanti dapat `UPDATE` baris bisa mengubah status. Grant kolom ditolak karena PostgREST di repo ini mengirim UPDATE satu baris, dan pola `GRANT` yang sudah ada juga per tabel.

Fase 2 yang sengaja ditunda, tanpa tabel baru di fase 1:

- KR2 menempel ke `key_results` berkode `KR2` setelah ada penanda pengajuan pertama
- KR4 dan cap waktu izin menempel ke `daily_tasks` (dua timestamptz yang belum ditambahkan)
- Kapasitas per karyawan menempel sebagai kolom pada `ai_employee_profiles`
- Eskalasi terstruktur menjadi tabel baru. Fase 1 cukup status run `returned` dan catatan feedback

Konsistensi organisasi memakai foreign key gabungan, bukan `CHECK (organization_id IS NOT NULL)` dan bukan trigger. `CHECK` itu tidak mengikat baris karyawan. Trigger harus diulang di setiap tabel dan mudah terlewat. Foreign key gabungan ditolak oleh database pada insert dan pada perubahan `employees.organization_id`.

Pola yang sama sudah dipakai `thinking_master_thoughts_id_org_key` di `supabase/migrations/20260930880000_thinking_parent_same_organization_v1.sql`: unik `(id, organization_id)` pada induk, lalu anak menunjuk pasangan itu.

`employees.id` sudah unik, jadi unik `(id, organization_id)` tidak menambah arti bisnis. Fungsinya hanya menjadi sasaran foreign key. `departments` mendapat unik yang sama supaya `department_id` tidak menunjuk departemen organisasi lain.

```sql
-- RANCANGAN — belum dijalankan
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_id_organization_id_key UNIQUE (id, organization_id);

ALTER TABLE public.departments
  ADD CONSTRAINT departments_id_organization_id_key UNIQUE (id, organization_id);

ALTER TABLE public.social_media_plans
  ADD COLUMN IF NOT EXISTS author_employee_id uuid NULL;

ALTER TABLE public.social_media_plans
  ADD CONSTRAINT social_media_plans_author_org_fkey
  FOREIGN KEY (author_employee_id, organization_id)
  REFERENCES public.employees (id, organization_id)
  ON DELETE SET NULL;

ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS requested_ai_employee_id uuid NULL,
  ADD COLUMN IF NOT EXISTS ai_revision_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.daily_tasks
  ADD CONSTRAINT daily_tasks_requested_ai_org_fkey
  FOREIGN KEY (requested_ai_employee_id, organization_id)
  REFERENCES public.employees (id, organization_id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.ai_employee_profiles (
  employee_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  job_title text NOT NULL DEFAULT 'Content Planner',
  department_id uuid NULL,
  reviewer_employee_id uuid NOT NULL,
  time_zone text NOT NULL DEFAULT 'Asia/Jakarta',
  is_active boolean NOT NULL DEFAULT true,
  performance_status text NOT NULL DEFAULT 'on_track'
    CHECK (performance_status IN ('on_track', 'attention', 'coaching', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_employee_profiles_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_profiles_reviewer_org_fkey
    FOREIGN KEY (reviewer_employee_id, organization_id)
    REFERENCES public.employees (id, organization_id),
  CONSTRAINT ai_employee_profiles_department_org_fkey
    FOREIGN KEY (department_id, organization_id)
    REFERENCES public.departments (id, organization_id)
);
```

Foreign key gabungan yang sama, `(employee_id, organization_id)` ke `employees (id, organization_id)`, dipasang pada `ai_employee_sops`, `ai_employee_schedules`, `ai_employee_runs`, `ai_employee_feedback`, `ai_employee_permissions`, `ai_employee_jobs`, dan `ai_employee_model_calls`. Feedback yang menyimpan reviewer memakai pasangan `(reviewer_employee_id, organization_id)` yang sama. `ON DELETE CASCADE` hanya pada karyawan AI pemilik baris. Reviewer tidak di-cascade supaya menghapus owner tidak menghapus profil diam-diam.

Pengecualian kuota, masih di fungsi yang sama:

```sql
-- RANCANGAN — belum dijalankan
-- Ditambahkan ke WHERE count_active_employees_for_org:
AND COALESCE(e.is_ai, false) = false
```

Departemen tidak dibuat baru. Seed profil mencari `departments` organisasi yang `is_active` dan namanya cocok dengan digital marketing. Bila hasilnya bukan tepat satu baris, seed berhenti. Nama persis di data **belum pasti** dari kode. Cara memastikan: baca `departments.name` organisasi pertama saat step 4, sebelum migration dijalankan.

## C. Identitas dan aktor runtime

Naya bukan user OAuth dan bukan service role yang bebas menulis tabel.

### Opsi

| Opsi | Cara akses | Pelaku yang tercatat | Trade-off |
| --- | --- | --- | --- |
| Auth user khusus Naya | Worker menandatangani JWT user itu. RLS biasa berlaku | `created_by` bisa terisi user Naya | User itu bisa tersambung ke OAuth jika kredensialnya bocor. Bertentangan dengan keputusan `user_id` boleh null |
| Fungsi pintu plus JWT role `ai_employee_runner` | PostgREST memakai klaim `role` pada JWT. Role itu hanya punya `EXECUTE` pada fungsi pintu | Log run dan `author_employee_id` = Naya. `created_by` tugas = user manusia. `assigned_by` = karyawan manusia | JWT harus ditandatangani secret legacy di luar repo, lalu disimpan sebagai secret function |
| Fungsi pintu dipanggil dengan service role | Sama, tetapi klien database function adalah service role | Sama | Satu bug runner yang memanggil `.from().update()` menulis tabel apa saja |

### JWT role khusus: bisa

Repo tidak membuat role database sendiri dan tidak menandatangani JWT Supabase. Yang ada:

- `supabase/config.toml` membedakan token user ES256 dari secret legacy HS256. Anon key dan service role key adalah JWT HS256 yang diterima Data API
- Edge Function membuat klien dengan `SUPABASE_SERVICE_ROLE_KEY`, yaitu JWT yang klaim `role`-nya `service_role`. PostgREST lalu `SET ROLE` sesuai klaim itu
- Tidak ada `SUPABASE_JWT_SECRET` atau penandatangan HS256 di `supabase/functions`

Karena service role key sudah diterima Data API, JWT kedua dengan klaim `role = ai_employee_runner`, ditandatangani secret legacy yang sama, mengikuti jalur yang sama. Syarat database: `CREATE ROLE ai_employee_runner NOLOGIN NOINHERIT`, `GRANT ai_employee_runner TO authenticator`, `GRANT USAGE ON SCHEMA public`, dan `GRANT EXECUTE` hanya pada fungsi pintu. Role ini tidak mendapat `BYPASSRLS` dan tidak mendapat `INSERT`/`UPDATE` tabel.

Function di repo tidak memegang secret penandatangan. JWT runner dibuat sekali di luar repo, lalu disimpan sebagai secret `AI_EMPLOYEE_RUNNER_JWT`. Runner memanggil `createClient(url, AI_EMPLOYEE_RUNNER_JWT)` untuk `rpc`, bukan service role. Cron yang membangunkan function memakai header internal `x-synckerja-internal-secret`, pola yang sama dengan `generate-script-ai`, bukan service role untuk menulis database.

Cadangan bila JWT uji ditolak Data API: runner memakai service role, dan kode runner hanya boleh memanggil `rpc`. Uji itu dilakukan di step 6 sebelum jalur cadangan dipilih. Kegagalan yang tersisa **belum pasti** dari kode: proyek hidup mematikan secret legacy. Cara memastikan: satu RPC percobaan dengan JWT role itu di branch, sebelum step 6.

Rekomendasi: role `ai_employee_runner` sebagai pintu utama. Service role hanya cadangan. Naya tetap `user_id` null.

```sql
-- RANCANGAN — belum dijalankan
-- Sketsa pintu. Bukan definisi akhir.
CREATE FUNCTION public.ai_employee_perform(
  p_employee_id uuid,
  p_run_id uuid,
  p_action text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_employee uuid;
  v_run_status text;
BEGIN
  SELECT employee_id, status
    INTO v_run_employee, v_run_status
  FROM public.ai_employee_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF v_run_employee IS NULL OR v_run_employee <> p_employee_id OR v_run_status <> 'running' THEN
    RAISE EXCEPTION 'run_not_running' USING ERRCODE = '42501';
  END IF;

  -- Kunci baris profil. Tolak bila bukan is_ai, tidak aktif, atau disabled.
  -- organization_id SELALU dari employees, abaikan payload.
  -- Tolak bila p_action tidak ada di ai_employee_permissions.
  -- Tolak aksi set approved, production_approved, completion approved, schedule, delete, switch org.
  -- Untuk tugas, tolak bila assignee bukan p_employee_id.
  -- Untuk plan, tulis author_employee_id = p_employee_id dan production_status = 'Need Review'.
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) TO ai_employee_runner;
-- Cadangan step 6, hanya bila JWT role ditolak Data API:
-- GRANT EXECUTE ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) TO service_role;
```

Pencegahan:

- Pindah organisasi: payload tidak punya efek. Organisasi diambil dari baris karyawan
- Di luar allowlist: fungsi menolak `action_code` yang tidak ada untuk karyawan itu
- Menyetujui diri sendiri: allowlist tidak berisi `approved`, `production_approved`, status approval `approved`, atau `content.plans.schedule`. Fungsi menolak meskipun model meminta
- Prompt injection: keluaran model hanya JSON dengan kunci yang sudah ditentukan untuk langkah SOP yang sedang berjalan. Nama tool dari teks plan, brief, atau feedback tidak dieksekusi. Teks sumber dibungkus sebagai data. Fungsi mengabaikan `organization_id` di dalam JSON

`thinking.execution.check` tidak dipanggil sebagai tool MCP bebas. Runner memanggil `generate-script-ai` hanya pada langkah SOP yang `may_call_model`, setelah `ai_employee_reserve_model_call` mengizinkan.

## D. Alur data per SOP

### SOP 1 — Jumat 15:00

1. Cron memasukkan job `scheduled` untuk SOP 1. Runner membuat `ai_employee_runs` status `running`.
2. Baca, tanpa model: `social_media_plans` jendela Senin–Minggu berikutnya, `content_pillars` yang `is_active`, katalog, rantai Thinking Lab yang sudah dikonfirmasi, feedback yang belum kedaluwarsa, dan pangsa pillar 4 minggu untuk `author_employee_id` Naya.
3. Bila jendela penuh dan tidak ada pillar di atas 40%, tutup run `succeeded` dengan `model_calls = 0`. Tidak ada daily task.
4. Bila ada celah dan masih ada jatah model, reservasi panggilan pada tanggal Jakarta, lalu panggil `generate-script-ai`. Sebelum itu baca sisa `script_ai_daily_usage` untuk tanggal UTC function itu. Sukses menaikkan `ai_employee_runs.model_calls` dan penghitung Jakarta. Function yang sama menaikkan penghitung UTC organisasi. Gagal teknis tidak menaikkan revisi. Dicoba ulang sekali. Gagal lagi: run `failed`, lalu notifikasi ke reviewer. Tidak ada daily task.
5. Simpan plan lewat `ai_employee_perform`: `author_employee_id` = Naya, `post_date` di jendela, `production_status = 'Need Review'`, `approved` dan `production_approved` tetap false.
6. Untuk plan dari Thinking Lab, `thinking.execution.check` lewat function yang sama. Setiap percobaan yang menghasilkan jawaban dihitung sebagai panggilan, termasuk cek ulang.
7. Tutup run sebelum Jumat 17:00 dengan status `succeeded`. Lewat batas: status `late`, lalu notifikasi. Job yang tertunda Urgent tetapi selesai sebelum 17:00 tetap `succeeded`.
8. Panggil perhitungan KR1, KR3, dan KR5.

Kuota habis di tengah paket: langkah tanpa model tetap selesai. Plan yang belum dibuat tidak dipaksakan. Run `deferred`, lalu notifikasi. Tidak diubah menjadi daily task.

### SOP 2 — instruksi menjadi tugas lalu antrean

1. Manusia di organisasi mengirim instruksi dari UI step 4. `created_by` = `auth.uid()` manusia itu.
2. Fungsi mencari `employees.id` manusia pada organisasi yang sama. Itu `assigned_by`. Bila ia tidak punya baris karyawan, instruksi ditolak.
3. Fungsi membuat `daily_tasks` dengan `requested_ai_employee_id` = Naya, `organization_id` organisasi itu, dan `created_by` user manusia. Lalu `daily_tasks_assigned.employee_id` = Naya dan `assigned_by` = karyawan manusia.
4. Fungsi memasukkan `ai_employee_jobs` prioritas Urgent atau Normal. Job menyimpan `daily_task_id`.
5. Runner, saat giliran tiba, membuka run, membaca katalog dan kalender tanpa model, lalu memanggil model bila instruksi butuh naskah. Memindahkan tanggal plan milik Naya tidak memanggil model.
6. Menulis plan (`author_employee_id` Naya) dan step tugas. Mengajukan `completion_approvals` status `pending`. Tidak mengubah tugas menjadi selesai.
7. Menutup run. Tugas tetap terbuka sampai manusia menyetujui.

Urgent boleh diambil di luar jam kerja, termasuk akhir pekan, selama batas 3 tugas dan 15 panggilan tanggal Jakarta belum penuh. Normal menunggu jam Senin–Jumat 08:00–17:00.

### SOP 3 — revisi

1. Pemicu plan: `production_status` menjadi `Request Revision`. UI yang sudah ada menaikkan `production_revision_count` sekali per perubahan ke status itu.
2. Pemicu tugas: `completion_approvals.status` ditolak. Fungsi menyalin `reject_reason` ke `ai_employee_feedback` dan menaikkan `daily_tasks.ai_revision_count`.
3. Bila hitungan revisi 1 atau 2, job `scheduled` atau mengikuti prioritas tugas asalnya masuk antrean. Model dipanggil. Draf ditimpa. Plan kembali ke `Need Review`, atau approval tugas diajukan lagi sebagai baris `pending`.
4. Bila hitungan sudah lebih dari 2, tidak ada panggilan model. Run `returned`. Plan tidak diubah lagi pada jendela itu. Tugas tetap ada dan penyelesaiannya kembali ke `assigned_by`. Notifikasi dikirim ke reviewer.
5. Kegagalan `generate-script-ai` tidak menaikkan hitungan revisi.

### Notifikasi

Penerima adalah `employees.user_id` milik `reviewer_employee_id`. Owner punya user, jadi penerima ini ada. Naya tidak menerima push.

Mekanisme yang dipakai sudah ada untuk daily task:

- Lonceng: insert `daily_task_notifications`. Tabel ini tidak membatasi jenis kejadian. UI membacanya lewat `src/shared/hooks/useNotificationBadgeCount.ts`
- Push: insert `daily_task_completion_push_queue`. Webhook database pada `INSERT` memanggil Edge Function `daily-task-completion-send-push`, seperti `supabase/functions/daily-task-completion-send-push/README.md`. Function mengambil token dari `fcm_tokens` (`context = general`) dan mengirim FCM
- Antrean saat ini hanya mengizinkan `event_type` `completed` dan `rejected` (`20260528120000_daily_task_completion_notifications.sql`). Function push menyusun kalimat dari dua nilai itu, bukan dari kolom `title`. Nilai baru tanpa ubahan function akan terbaca sebagai "item selesai"

Karena itu migration menambah `run_failed`, `run_late`, `run_deferred`, dan `revision_returned` pada CHECK antrean, dan step 6 menambah cabang kalimat di `daily-task-completion-send-push/index.ts`. Lonceng memakai judul yang sama. Tidak dibuat jalur FCM baru.

Kejadian yang mengirim: run SOP 1 `failed`, `late`, atau `deferred` karena kuota, serta objek `returned` setelah 2 revisi. Run `succeeded` tidak mengirim.

## E. KPI dan OKR

Tiga objective di v1.1 tetap usulan. Penulisan baris OKR dilakukan saat step 4 atau migration data yang terpisah, setelah owner dan siklus aktif diketahui. Desain ini tidak menulis ke database.

Hubungan key result ke kode KR tidak mengandalkan judul. Tambah kolom nullable:

```sql
-- RANCANGAN — belum dijalankan
ALTER TABLE public.key_results
  ADD COLUMN IF NOT EXISTS ai_kr_code text NULL
    CHECK (ai_kr_code IN ('KR1', 'KR2', 'KR3', 'KR4', 'KR5'));
```

Unik per `(individual_objective_id, ai_kr_code)`. Fase 2 memakai kode `KR2` dan `KR4` pada tabel yang sama.

Fungsi `ai_employee_refresh_krs(employee_id)` dijalankan pada penutupan SOP 1 dan sekali lagi oleh cron setelah Jumat 17:00. Menulis `current_value` dan `progress_percentage` untuk KR1, KR3, dan KR5 saja.

- KR1: minggu dengan run SOP 1 `succeeded` dan `finished_at` sebelum Jumat 17:00 Jakarta, dibagi minggu yang punya jadwal SOP 1, kali 100. Target 90
- KR3: bila plan Naya pada 4 jendela terakhir kurang dari 5, atau `content_pillars.is_active` organisasi kurang dari 3, set `metric_type = 'unrated'`, `current_value` null, `progress_percentage = 0`, `unit = 'belum dinilai'`. Selain itu pangsa tertinggi dihitung seperti v1.1. Lulus bila tidak ada plan tanpa pillar dan pangsa tertinggi paling besar 40
- KR5: plan `author_employee_id` Naya yang `production_approved` dan punya baris `social_media_scheduled_posts` dalam 7 hari setelah approval, dibagi plan Naya yang `production_approved`, kali 100. Target 60

Progres objective selama fase 1: jangan membagi ulang dengan memasukkan KR2 dan KR4 yang masih 0. Rekomendasi: baris KR2 dan KR4 dibuat dengan `metric_type = 'manual'` dan tidak diikutkan rollup. KR3 `unrated` juga tidak diikutkan. Bobot yang tersisa dinormalkan. Contoh hanya KR1 (25) dan KR5 (10) yang siap: progres = (25 kali progres KR1 + 10 kali progres KR5) / 35. Hasil ditulis ke `individual_objectives.progress_percentage`.

`key_results.metric_type` di `supabase/migrations/20260430210000_1-home_dashboard_reference_schema.sql` bertipe `text` dan boleh null. Tidak ada CHECK atau enum pada kolom itu. CHECK `metric_type` yang ada di repo milik `kol_performance_thresholds`, tabel lain. Migration fase 1 tidak mengubah constraint `key_results`.

UI memakai `KrMetricType = 'percentage' | 'number' | 'currency' | 'boolean'` di `src/1-home/components/HomeOKRDashboard/component/ObjectivesTabImport/okr.ts`. Pemakaian yang ada membandingkan `=== 'number'`. Nilai lain, termasuk `unrated` dan `manual`, jatuh ke cabang persentase dan menampilkan `progress_percentage`. Tidak ada `switch` yang melempar error. Dropdown pembuat key result hanya menawarkan empat nilai lama, jadi manusia tidak memilih `unrated` dari form. Yang rusak tanpa step 4 hanyalah arti tampilan: batang 0% untuk KR yang belum dinilai.

Statistik home merata-rata semua key result tanpa bobot. Step 4 mengubah `objectiveStatsQuery.ts` dan tampilan persen di `CompanyObjectivesDetailView.tsx` agar `unrated` menulis "belum dinilai" dan `manual` tidak masuk rata-rata. Tanpa itu, angka 0 pada KR2, KR4, dan KR3 yang belum dinilai tetap terlihat rendah di kartu, walaupun kolom objective sudah benar.

KR3 menampilkan "belum dinilai" dari `unit` dan `metric_type`, bukan dari progres 0. Owner tidak menurunkan `performance_status` karena KR3 selama `metric_type = 'unrated'`.

## F. Kapasitas dan antrean

Implementasi runner dan cron ada di step 5 dan 6. Bentuknya dirancang di sini.

| Batas | Cara menegakkan |
| --- | --- |
| 15 panggilan per tanggal Jakarta, 8 bila `performance_status = 'coaching'` | `ai_employee_model_calls.usage_date` adalah tanggal Asia/Jakarta. Kunci baris sebelum HTTP. Naik hanya saat `generate-script-ai` sukses. `thinking.execution.check` ikut dihitung |
| `daily_limit` organisasi | Sebelum reservasi, baca `script_ai_daily_usage` pada tanggal UTC yang `generate-script-ai` pakai. Jangan mengubah tanggal itu. Antara 00:00 dan 07:00 Jakarta, tanggal penghitung Naya dan tanggal kuota organisasi bisa berbeda |
| 3 tugas dadakan per tanggal Jakarta | Hitung job SOP 2 yang mulai pada tanggal itu. Yang ke-4 tetap di antrean untuk tanggal berikutnya. Urgent akhir pekan tetap masuk hitungan tanggal itu |
| 7 plan per paket SOP 1 | Dihitung dari plan yang dibuat run itu. Lebih dari itu tidak ditulis |
| 2 revisi | `production_revision_count` untuk plan, `ai_revision_count` untuk tugas |

| Prioritas | Isi | Pengambilan |
| --- | --- | --- |
| Urgent | Job SOP 2 yang ditandai mendesak atau tenggatnya hari ini | Kapan saja, termasuk akhir pekan, setelah yang lebih dulu di antrean Urgent |
| Scheduled | SOP 1 Jumat 15:00 dan cek tanpa model yang jatuh tempo | Hanya Senin–Jumat 08:00–17:00, setelah Urgent yang sudah ada pada slot yang sama |
| Normal | SOP 2 tanpa tanda mendesak | Setelah Scheduled, hanya di jam kerja |

```sql
-- RANCANGAN — belum dijalankan
CREATE TABLE IF NOT EXISTS public.ai_employee_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  CONSTRAINT ai_employee_jobs_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  sop_code text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('urgent', 'scheduled', 'normal')),
  not_before timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'deferred', 'failed', 'returned')),
  daily_task_id uuid NULL REFERENCES public.daily_tasks (id) ON DELETE SET NULL,
  run_id uuid NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Pengambilan memakai `FOR UPDATE SKIP LOCKED` urut `urgent`, lalu `scheduled`, lalu `normal`, lalu `not_before`. Satu job berjalan per karyawan. Job lain karyawan yang sama menunggu.

Cron terpusat satu job baru, tidak memakai nama job yang sudah ada (`tiktok-content-scheduler`, jadwal posting, absensi, dan yang lain di migration `pg_cron`). Pola penjadwalan mengikuti `supabase/migrations/20260623122000_social_media_scheduled_posts_cron.sql`: jadwalkan hanya bila `pg_cron` ada dan nama job belum ada.

```sql
-- RANCANGAN — belum dijalankan
-- Nama job: ai-employee-dispatch. Setiap menit.
-- Isi: SELECT public.ai_employee_dispatch();
-- Fungsi itu hanya mengambil job yang sudah jatuh tempo.
-- Tidak memanggil tiktok-content-scheduler atau social-media-scheduler.
```

`ai_employee_dispatch` membangunkan runner lewat satu Edge Function. Function itu tidak memegang logika konten. Ia memanggil `ai_employee_perform` dan `generate-script-ai`.

## G. Pemetaan ke roadmap

| Step | Pekerjaan | Area yang kemungkinan disentuh | Ketergantungan |
| --- | --- | --- | --- |
| 4 UI | Form profil Naya, pemilih departemen yang sudah ada, status kinerja manual, daftar run dan feedback | `src/2-1-employees`, halaman OKR `src/1-home/components/HomeOKRDashboard`, `objectiveStatsQuery.ts` | Desain bagian B dan E |
| 5 Cron | Pasang job `ai-employee-dispatch` saja | Migration cron, fungsi `ai_employee_dispatch` | Tabel job bagian F |
| 6 Antrean dan pemroses | Isi `ai_employee_jobs`, kunci prioritas, batas 15 dan 3, uji JWT `ai_employee_runner` | Edge Function runner, `ai_employee_perform` | Step 5 membangunkan runner. Step 4 belum wajib untuk job terjadwal |
| 7 Runtime | Prompt dari SOP, feedback, dan KPI. Jalur model `generate-script-ai` menerima karyawan `is_ai` tanpa user manusia. Kalimat push untuk empat `event_type` baru | Runner dan `daily-task-completion-send-push/index.ts` | Allowlist, SOP, dan CHECK antrean |
| 8 MCP terbatas | Naya tidak memakai connector manusia. Tool MCP yang namanya sama hanya jadi `action_code` di dalam fungsi | `services/mcp` tidak dijadikan identitas Naya. Batas ada di SQL | Bagian C |
| 9 Tugas dadakan | Instruksi manusia membuat `daily_tasks` dan job | UI instruksi, `daily_tasks.requested_ai_employee_id` | Step 6 sudah mengambil antrean |
| 10 Dashboard | KPI, kapasitas tetap 15/8/3, status manual, kuota yang sudah mengecualikan AI | OKR home, langganan `useOptimizedSubscription.ts` | KR refresh bagian E |
| 11 Uji dan rilis | Jumat 15:00, Urgent akhir pekan, KR3 belum dinilai, penolakan approval sendiri, kuota | Data uji satu organisasi | Step 4 sampai 10 untuk jalur yang diuji |

Step 6 bisa dikerjakan sebelum UI step 4 untuk job terjadwal. Instruksi manusia (step 9) butuh UI. Step 8 tidak menambah scope OAuth.

## H. Rencana migration

File belum dibuat. Urutan mengikuti nama `20261101140000_...` yang terakhir ada. Satu concern per file, seperti migration MCP yang sudah ada.

| Urutan | Nama file usulan | Isi | Rollback |
| --- | --- | --- | --- |
| 1 | `20261101150000_ai_employee_marker.sql` | `employees.is_ai`. Ubah `count_active_employees_for_org` | Drop kolom setelah kembali ke fungsi lama |
| 1b | bagian dari file 1 | Unik `employees (id, organization_id)` dan `departments (id, organization_id)` | Drop constraint unik. Tidak menghapus baris |
| 2 | `20261101151000_ai_employee_profile.sql` | Profil, SOP, langkah, jadwal, izin. Foreign key gabungan. Fungsi dan trigger status owner | Drop tabel dan fungsi status. Tidak menyentuh karyawan manusia |
| 3 | `20261101152000_ai_employee_runs.sql` | Run, feedback, panggilan model, foreign key gabungan | Drop tabel |
| 4 | `20261101153000_ai_employee_attribution.sql` | `author_employee_id`, `requested_ai_employee_id`, `ai_revision_count`, `key_results.ai_kr_code`, foreign key gabungan plan dan tugas. Tanpa CHECK baru pada `metric_type` | Drop kolom dan constraint. Plan dan tugas manusia tidak terisi kolom itu |
| 5 | `20261101154000_ai_employee_perform.sql` | Role `ai_employee_runner`, fungsi pintu, refresh KR. `EXECUTE` hanya untuk role itu | Drop fungsi dan role |
| 6 | `20261101155000_ai_employee_jobs.sql` | Antrean, foreign key gabungan, `ai_employee_dispatch`. Dijalankan saat step 5 | `cron.unschedule('ai-employee-dispatch')`, drop fungsi, drop tabel job |
| 7 | `20261101156000_ai_employee_reviewer_notify.sql` | Perlebar CHECK `daily_task_completion_push_queue.event_type` dengan `run_failed`, `run_late`, `run_deferred`, `revision_returned` | Kembalikan CHECK lama setelah baris jenis baru dihapus |

Tidak ada file di langkah ini yang mengisi baris Naya atau objective. Pengisian menunggu organisasi, owner, dan siklus yang dipilih di step 4.

## I. Risiko dan pertanyaan terbuka

Terjawab:

1. Pintu tulis fase 1 adalah `ai_employee_perform`. Klien database runner memakai JWT role `ai_employee_runner` yang hanya punya `EXECUTE`. Service role menjadi cadangan bila uji Data API di step 6 menolak JWT itu.
2. Penghitung panggilan Naya memakai tanggal Asia/Jakarta. Sisa kuota organisasi tetap dibaca pada tanggal UTC yang dipakai `generate-script-ai`.

Tidak ada pertanyaan terbuka baru. Uji JWT di step 6 adalah pemeriksaan teknis, bukan keputusan produk.
