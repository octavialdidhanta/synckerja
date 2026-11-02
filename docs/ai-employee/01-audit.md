# AI Employee — Step 1: Audit

Status: audit selesai. Step 2 belum dikerjakan. Dokumen ini hanya mencatat keadaan kode pada 1 November 2026. Yang tidak bisa dipastikan dari kode ditandai **belum pasti**.

Konteks: MVP AI Employee pertama bernama Naya, content planner otomatis. AI Employee diperlakukan seperti karyawan: punya SOP, KPI individu, masuk OKR, menerima daily task, dan kinerjanya bisa dievaluasi.

## Ringkasan

1. Server MCP ada di `services/mcp`. Autentikasi memakai OAuth authorization code + PKCE. Token akses 15 menit, refresh 30 hari.
2. Organisasi aktif tidak lagi disimpan di dalam token. Disimpan di `mcp_connector_sessions` per `user_id` + `client_id`, dan diganti lewat `session.switchOrg`.
3. Izin efektif dihitung ulang setiap panggilan: scope OAuth dipotong role, izin halaman, dan modul organisasi aktif.
4. Ada 57 tool. Tool data tidak menerima argumen `organization_id`. Tool tulis menambahkan `organization_name` pada hasil.
5. Karyawan adalah baris `employees`. `user_id` boleh kosong. Tidak ada kolom yang membedakan manusia dan AI. Satu baris karyawan terikat ke satu `organization_id`.
6. Assignee daily task wajib `employees.id`. Pembuat penugasan (`assigned_by`) juga wajib karyawan. Penyelesaian lewat `completion_approvals` (pending, lalu approve atau reject).
7. OKR sudah punya company, department, individual, dan key result. Progres adalah angka `progress_percentage`. KPI individu sebagai objek terpisah belum ada. Yang ada adalah objective individu dan KPI kampanye iklan.
8. Konten dan Thinking Lab (Master Thought sampai execution) sudah ada, termasuk tool MCP baca dan tulis.
9. `pg_cron` dan banyak Edge Function sudah ada, masing-masing untuk fitur sendiri. Antrean pekerjaan AI Employee yang terpusat belum ada.
10. AI berbayar sudah dipakai untuk skrip, gambar, video, dan cek Thinking Lab, lewat kunci di database organisasi atau env function. Service MCP sendiri tidak menyimpan kunci model.

## A. Server MCP Synckerja

Kode ada di `services/mcp`. Masuk HTTP di `src/server.ts`, aplikasi di `src/http/createApp.ts`, daftar tool di `src/mcp/registry.ts`.

Menjalankan lokal: `npm run dev` atau `npm start` di folder itu, memakai `.env`. Di repo tidak ada Dockerfile atau skrip deploy untuk service ini. Host produksi **belum pasti** dari kode. URL publik berasal dari env `MCP_PUBLIC_URL`. Endpoint connector adalah `{MCP_PUBLIC_URL}/mcp`.

### Autentikasi

OAuth: klien mendaftar, lalu authorization code dengan PKCE, lalu token. JWT akses berisi user, `profile_id`, scope, `client_id`, dan `connection_id`. Token baru tidak berisi `org_id`. Token lama yang masih membawa `org_id` tetap diterima sampai di-refresh. Refresh tidak mengembalikan organisasi lama kalau sesi sudah dipindah.

### Organisasi, role, dan scope per sesi

- Scope OAuth dikunci saat sambung. Daftarnya di `services/mcp/src/scopes.ts`.
- Organisasi aktif dibaca dari `mcp_connector_sessions`.
- Role dibaca dari `user_roles` organisasi itu. Employee dari `employees` organisasi itu.
- Halaman memakai `permission_configurations`. Kebijakan MCP menolak kalau tidak ada izin.
- Modul (digital marketing, OKR, finance, HR, operations, tools, omnichannel) mengikuti paket langganan atau `organization_sales_module_access`.
- Tool terlihat hanya jika scope, modul, dan halaman semuanya lolos. Panggilan yang tidak berhak ditolak saat dijalankan.

### Daftar tool

Tool sesi, scope `session:read`:

- `session.whoami` — membaca identitas dan organisasi aktif.
- `session.orgs.list` — membaca keanggotaan.
- `session.switchOrg` — menulis organisasi aktif. Scope-nya tetap `session:read`.

Baca:

- Konten `content:read`: `content.plans.list`, `content.calendar.list`, `content.catalog.list`, `leadmagnet.draft.read`, `thinking.ideas.list`, `thinking.chain.read`.
- OKR `okr:read`: `okr.cycles.list`, `okr.objectives.list`, `okr.departments.list`.
- Tugas `tasks:read`: `tasks.summary`, `tasks.list`, `tasks.initiative.list`, `tasks.workload`, `tasks.completed.list`, `tasks.steps.list`.
- Lainnya: `crm.leads.list` (`crm:read`), `ads.accounts.list` (`ads:read`), `finance.income.list` dan `finance.expenses.list` (`finance:read`), `hr.employees.list` (`hr:read`), `payroll.runs.list` (`payroll:read`), `sales.visits.list` (`sales:read`), `pos.sales.daily` (`pos:read`), `kol.campaigns.list` dan `kol.profiles.list` (`kol:read`), `inventory.stock.list` (`commerce:read`), `habits.list` (`habits:read`).

Tulis:

- Konten `content:write`: `content.plans.create`, `content.plans.update`, `content.briefs.create`, `leadmagnet.delivery.attach`, `thinking.plan.save`, `thinking.plan.direct`.
- `thinking.execution.check` memakai scope `content:write` dan memanggil Edge Function `generate-script-ai`. Tidak masuk daftar tool yang menstempel `organization_name`.
- `content.plans.schedule` memakai `content:publish`.
- OKR `okr:write`: `okr.objectives.create`, `okr.objectives.update`, `okr.objectives.department.create`, `okr.objectives.individual.create`.
- Tugas `tasks:write`: `tasks.create`, `tasks.update`, `tasks.delete`, `tasks.assign`, `tasks.objective.link`, `tasks.initiative.take`, `tasks.steps.create`, `tasks.steps.update`, `tasks.steps.delete`, `tasks.substeps.create`, `tasks.steps.image.add`.
- `crm.leads.create`, `crm.leads.update`, `crm.leads.setStatus` (`crm:write`).
- `finance.income.create`, `finance.income.update`, `finance.expenses.create`, `finance.expenses.update` (`finance:write`).
- `habits.check` (`habits:write`).

Tidak ada tool MCP untuk key result, check-in mingguan, approval penyelesaian tugas, atau membuat karyawan.

## B. Modul dan skema data

### Karyawan

Tabel `employees`. `user_id` boleh null dan mengacu ke `auth.users`. Ada `organization_id`, `department_id`, `job_position_id`, `employee_status_id`, `employee_id` (nomor pegawai), NIK, tanggal masuk, dan `pending_removal`. Tidak ada kolom jenis manusia atau AI.

Identitas yang dipakai sistem ada dua, dan keduanya milik satu baris:

- `employees.id` adalah UUID baris. Ini yang diacu OKR individu (`individual_objectives.employee_id`) dan penugasan daily task (`daily_tasks_assigned.employee_id`).
- `employees.organization_id` adalah organisasi pemilik baris itu. Satu baris karyawan hanya milik satu organisasi.
- `employees.employee_id` adalah kode tampilan, misalnya `EMP-00012`. Kode ini unik per organisasi lewat indeks `(organization_id, employee_id)`. Kode ini bukan kunci yang dipakai tugas atau OKR.

Naya di Synckerja Office dan Naya di organisasi lain menjadi dua baris, masing-masing dengan UUID sendiri. Sama seperti satu orang yang bekerja di dua perusahaan: namanya sama, berkas kepegawaiannya terpisah, dan tugas serta KPI tidak tercampur.

Karyawan aktif untuk kuota langganan adalah status `active` atau `probation` dan belum ditandai hapus. RLS baca: diri sendiri atau organisasi tempat user menjadi anggota. RLS tulis: role `owner`, `admin`, atau `hr` di organisasi itu.

### Daily task

`daily_tasks` berisi judul, status default `pending`, prioritas, `due_date`, `plan_date`, `finish_date`, `plan_month` (ditambah migrasi terpisah), dan `created_by` ke `auth.users` (boleh null).

Assignee bukan kolom di tugas. Ada di `daily_tasks_assigned.employee_id`, wajib, mengacu ke `employees`. `assigned_by` juga wajib mengacu ke `employees`. Step di `task_steps`, sub-step di `task_steps_to_steps`, masing-masing punya tabel assignment sendiri.

Approval di `completion_approvals`: `entity_type` task, step, atau substep; status default `pending`; ada `reject_reason`. Assignee dan pemberi tugas di approval sama-sama wajib karyawan.

RLS tugas, step, dan assignment: anggota organisasi lewat `user_organization_ids()`.

### OKR

`okr_cycles`, lalu `company_objectives` (pemilik wajib `auth.users`), `department_objectives`, `individual_objectives` (wajib `employees.id`), dan `key_results` dengan tepat satu induk. Progres disimpan sebagai `progress_percentage`. Ada `weekly_checkins` per karyawan.

Di UI, sebagian objective konten menyelaraskan progres dari laporan iklan. Itu bukan tabel KPI individu. KPI yang ada terpisah: `campaign_kpi_templates` untuk iklan.

MCP bisa membuat objective, termasuk individual, tetapi tidak membuat key result.

### Konten dan Thinking Lab

`social_media_plans` per organisasi, dengan kalender lewat tanggal posting. Brief dan katalog dipakai tool MCP `content.briefs.create` dan `content.catalog.list`.

Thinking Lab: `thinking_master_thoughts` dan anaknya (big thought, territory, angle, idea, execution). Tool MCP bisa membaca ide dan rantai, menyimpan plan, dan memeriksa execution.

## C. Infrastruktur yang sudah ada

`pg_cron` sudah dipakai banyak jadwal terpisah: absensi, posting terjadwal, Google Contacts, penjualan harian, alur omnichannel, dan lainnya. Tidak ada satu cron untuk AI Employee.

Edge Function banyak, termasuk `generate-script-ai`, `generate-brief-video`, `generate-brief-voice`, `generate-design-image`, `analyze-expense-receipt-ai`, `social-media-scheduler`, `tiktok-content-scheduler`, dan worker seperti `stock-sync-worker` serta `whatsapp-campaign-worker`.

Antrean umum belum ada. Yang ada antrean khusus, misalnya push daily task dan kampanye WhatsApp.

### Integrasi AI

Nama env dan kolom saja. Nilai tidak dicatat di dokumen ini.

- `generate-script-ai` membaca `organization_script_ai_config`: kolom `google_ai_api_key`, `openai_api_key`, plus provider Gemini, Groq, Fireworks, atau OpenAI. Env function: `GROQ_API_KEY`, `FIREWORKS_API_KEY`, `FIREWORKS_BASE_URL`.
- Lead magnet Claude: kolom `claude_api_key` di konfigurasi yang sama.
- Struk biaya: `GROQ_API_KEY`, `GROQ_VISION_MODEL`, `GROQ_VISION_MODEL_FALLBACK`, `FIREWORKS_API_KEY`, `FIREWORKS_VISION_MODEL`, `FIREWORKS_VISION_MODEL_FALLBACK`.
- Video brief memanggil Gemini. Nama env kunci di function itu **belum pasti** dari cuplikan yang dibaca. Yang terlihat hanya `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`.
- Service MCP tidak memegang kunci model. `thinking.execution.check` memanggil `generate-script-ai` dengan service role.

Env service MCP: `MCP_PUBLIC_URL`, `OFFICE_ORIGIN`, `MCP_JWT_SECRET`, `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SCHEDULED_POSTS_INTERNAL_SECRET`.

### Log yang bisa dipakai untuk run

- `mcp_tool_calls` mencatat nama tool, hasil, user, organisasi, dan klien.
- `mcp_org_switches` mencatat pindah organisasi.
- `content_ai_usage` mencatat pemakaian AI konten: service, aksi, model, status `queued` sampai `failed`, dan jumlah token atau karakter.
- `task_step_history` mencatat perubahan tugas, bukan run AI.

## D. Celah dan risiko

Belum ada, relatif terhadap roadmap:

- Jenis karyawan AI, SOP, KPI individu, kapasitas, dan jadwal run.
- Cron terpusat dan antrean pekerjaan AI.
- Runtime yang menyusun prompt dari KPI.
- Aturan tugas mendadak versus pekerjaan rutin yang hanya masuk log.
- Tool MCP untuk key result, approval penyelesaian, dan membuat karyawan AI.
- Akun MCP milik AI. Connector saat ini adalah user manusia yang sudah OAuth.

Yang menghalangi AI menjadi assignee:

- Assignee harus `employees.id`. Baris karyawan tanpa `user_id` secara skema boleh, karena `user_id` nullable. Apakah UI pemilihan assignee menyembunyikan baris tanpa user **belum pasti**.
- `assigned_by` juga harus karyawan. AI yang menugaskan perlu baris karyawan sendiri, atau penugasan tetap atas nama manusia.
- `created_by` pada tugas mengacu ke `auth.users`. Tanpa user login, pembuat tercatat null atau harus memakai user manusia.
- Approval penyelesaian mengharapkan pemberi tugas yang juga karyawan. Alur manusia menerima atau menolak pekerjaan AI belum dimodelkan.
- MCP `tasks.assign` bertindak sebagai user connector, bukan sebagai karyawan AI.

Risiko kalau AI diberi write lewat MCP:

- Scope write yang sudah ada luas: tugas, konten, OKR, CRM, dan finance. Satu connector dengan scope itu bisa menulis semuanya di organisasi aktif.
- `session.switchOrg` bisa dipanggil model karena teks di dalam data, selama user memang anggota organisasi tujuan.
- `thinking.execution.check` memicu API model lewat kunci organisasi, jadi kuota AI organisasi terpakai.
- Service MCP memakai service role ke database. Batasnya ada di fungsi SQL dan pengecekan izin di proses MCP, bukan di RLS user tersebut.
- Prompt injection tetap bisa menyuruh model memanggil tool tulis. Server tidak membedakan perintah manusia dan teks di dalam data.

## E. Pertanyaan keputusan

Kecenderungan: menghindari API berbayar per token. Bagian ini memaparkan opsi, tidak memilih.

Ketergantungan roadmap pada API:

- Step 7 dan bagian step 8 yang menilai atau menulis naskah bergantung pada API, karena Thinking Lab dan skrip sudah memanggil `generate-script-ai`.
- Step 5, 6, 9, dan 10 (cron, antrean, prioritas, dashboard) tidak wajib memanggil API. Mereka hanya menjalankan dan mencatat.
- Step 2 sampai 4 adalah definisi dan UI. Tidak memanggil API.

Opsi:

- AI tetap di luar Synckerja, misalnya Claude atau ChatGPT yang sudah tersambung ke MCP, dijalankan sebagai tugas terjadwal di luar. Synckerja hanya menyimpan SOP, KPI, tugas, dan log. Keuntungannya tidak menambah tagihan token di server. Kerugiannya jadwal, rahasia, dan kuota ada di pihak lain. Prompt injection tetap bisa memakai tool write connector itu.
- AI dipanggil dari server Synckerja lewat `generate-script-ai` yang sudah ada. Kunci dan kuota harian per organisasi sudah ada. Kerugiannya tetap bayar per pemakaian, dan service role yang memanggil function itu lebih kuat daripada connector biasa.
- Pisahkan: pekerjaan rutin hanya menulis log run tanpa model. Model hanya dipakai saat tugas mendadak atau saat manusia meminta. Mengurangi token, tetapi step 7 tetap butuh satu jalur API untuk saat model benar-benar dipanggil.

## Lampiran path

- `services/mcp/src/server.ts`
- `services/mcp/src/http/createApp.ts`
- `services/mcp/src/oauth/tokens.ts`
- `services/mcp/src/oauth/token.ts`
- `services/mcp/src/scopes.ts`
- `services/mcp/src/authz/context.ts`
- `services/mcp/src/authz/loadContext.ts`
- `services/mcp/src/mcp/registry.ts`
- `services/mcp/src/mcp/filterTools.ts`
- `services/mcp/src/mcp/handler.ts`
- `services/mcp/src/db/connectorSession.ts`
- `services/mcp/src/db/dailyTasks.ts`
- `services/mcp/src/db/thinkingLab.ts`
- `services/mcp/.env.example`
- `services/mcp/package.json`
- `supabase/migrations/20261101140000_mcp_connector_sessions.sql`
- `supabase/migrations/20260328120001_0-onboarding_multitenant_tables.sql`
- `supabase/migrations/20260429120000_employees_org_scope_active_count.sql`
- `supabase/migrations/20260430150000_employees_single_select_rls_policy.sql`
- `supabase/migrations/20260430310000_employees_employee_id_column.sql`
- `supabase/migrations/20260509095000_employees_rls_allow_hr_manage_org.sql`
- `supabase/migrations/20260430210000_1-home_dashboard_reference_schema.sql`
- `supabase/migrations/20260430220000_daily_tasks_blockers_reference_core.sql`
- `supabase/migrations/20260430518900_script_ai_config_and_daily_usage.sql`
- `supabase/migrations/20261020210000_content_ai_usage.sql`
- `supabase/functions/generate-script-ai/index.ts`
- `src/thinking-lab/shared/thinkingAiClient.ts`
