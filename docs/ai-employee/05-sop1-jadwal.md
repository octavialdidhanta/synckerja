# SOP1 — jadwal otomatis

Migration sudah diterapkan di project `wqdzqqshoifwyrltzgvx`. Cron `ai-employee-dispatch` aktif tiap menit. Fungsi `ai-employee-run` yang live sudah menerima mode `sop1`. Jadwal Naya berikutnya: Jumat 6 November 2026 pukul 15:00 WIB.

## Alur

Satu job `pg_cron` bernama `ai-employee-dispatch` berjalan tiap menit dan memanggil `ai_employee_dispatch()`.

1. Kalau `pg_net` tidak ada, atau rahasia Vault `ai_employee_project_url` / `ai_employee_internal_secret` kosong, fungsi berhenti. Tidak ada klaim dan tidak ada HTTP.
2. Fungsi mengunci jadwal SOP1 yang `next_run_at <= now()`, profilnya aktif, dan statusnya bukan `disabled`. Paling banyak 5 baris, `FOR UPDATE SKIP LOCKED`.
3. `next_run_at` langsung dipindah ke kejadian berikutnya. Pemanggilan kedua tidak mengambil baris yang sama.
4. Hanya baris yang berhasil diklaim yang dikirim ke `ai-employee-run` dengan `mode: "sop1"` dan header `x-synckerja-internal-secret`. Kalau tidak ada yang jatuh tempo, tidak ada HTTP, jadi model tidak dipanggil.

Zona waktu dibaca dari `ai_employee_profiles.time_zone`. Kosong atau tidak dikenal memakai Asia/Jakarta. `weekday` 1 adalah Senin, 7 adalah Minggu. `due_local` harus setelah `start_local`.

Mengubah hari atau jam mulai menghitung ulang `next_run_at`. Mengubah hanya `due_local` tidak. `authenticated` tidak boleh menulis `next_run_at`.

## Mode SOP1

`ai-employee-run` dengan `mode: "sop1"` mengikuti delapan langkah SOP1 yang tersimpan:

- Jendela adalah Senin–Minggu minggu depan, zona profil.
- Hanya hari yang belum punya plan Naya. Paling banyak 7 plan, satu per hari.
- Plan baru selalu `Need Review`. Tidak ada approval dan tidak ada jadwal tayang.
- Di bawah 5 plan pada 4 minggu (minggu target plus 3 minggu sebelumnya), pillar tersedikit yang dipilih. Mulai plan ke-5, pillar yang penambahannya membuat pangsa di atas 40% tidak dipilih. Kalau tidak ada pillar yang lolos, run selesai tanpa panggilan model lagi.
- Jendela yang sudah penuh selesai dengan `model_calls = 0`.
- Kuota harian tetap lewat `ai_employee_reserve_model_call`. Habis di tengah jalan: run `deferred`, plan yang sudah tersimpan tetap ada.
- Ada rantai Thinking Lab: draf dicek. Yang ditolak diperbaiki sekali lalu dicek ulang. Yang tetap gagal tidak disimpan.
- Selesai setelah `due_local` pada hari jadwal: status `late`. Hari lain tetap `succeeded`.

## Tool jadwal

`ai_employee.schedule.update(employee_name, sop_code, weekday, start_local, due_local, is_active)` hanya untuk owner organisasi sesi. Admin ditolak. Setelah update, trigger menghitung ulang `next_run_at`. Balasan memuat jadwal lama dan jadwal baru.

## File

| File | Isi |
| --- | --- |
| `supabase/migrations/20261103107000_ai_employee_sop1_schedule.sql` | Kolom, fungsi, trigger, cron |
| `supabase/rollback/ai-employee/20261103107000_ai_employee_sop1_schedule.sql` | Cabut cron, fungsi, kolom |
| `supabase/tests/ai_employee_sop1_dryrun.sql` | Uji di SQL Editor, satu transaksi, diakhiri `ROLLBACK` |
| `supabase/functions/ai-employee-run/index.ts` | Mode `sop1` |
| `supabase/functions/_shared/aiEmployee/planDraft.mjs` | Hari kosong, pillar, salam waktu |
| `services/mcp/src/db/aiEmployee.ts` | Update jadwal |

## Rahasia

Dua nama di Vault, tanpa nilai di repo:

- `ai_employee_project_url` = URL project
- `ai_employee_internal_secret` = nilai yang sama dengan `SCHEDULED_POSTS_INTERNAL_SECRET`

Selama salah satu kosong, cron tidak mengklaim jadwal dan tidak memanggil fungsi. Tool `ai_employee.schedule.update` ikut hidup setelah perubahan MCP ini masuk `main` dan Render selesai.
