# Konteks kerja Naya

Belum diterapkan. Jangan deploy fungsi `ai-employee-run` dan jangan menjalankan migration ini di production sebelum uji `supabase/tests/ai_employee_work_context_dryrun.sql` lulus. File itu satu transaksi dan diakhiri `ROLLBACK`.

## Brief

Satu baris `ai_employee_briefs` per karyawan AI: katalog (`services`), target audiens, id `product_knowledge` sebagai Customer Persona, gaya bahasa, catatan wajib, catatan larangan, pillar prioritas, dan aturan pembagian bila katalog lebih dari satu.

Owner mengubahnya lewat `ai_employee.brief.update`. Admin ditolak. Balasan memuat brief lama dan baru. Naya tidak menulis tabel ini. Ia membaca lewat scope `brief` pada `ai_employee_context`.

Brief dan persona masuk ke prompt chat, SOP1, SOP2, dan SOP3. SOP3 memakai mode `sop3` dan tetap satu draf Need Review.

## Thinking Lab

Scope `thinking` mengembalikan rantai yang sudah `locked` dan `LOLOS`: Master Thought, Big Thought, Territory, Angle, Idea, pillar id+nama, dan execution yang hanya berisi id, nama pillar, judul, serta lulus atau tidak. Path gambar tidak ikut.

Idea yang sudah punya `social_media_plans.thinking_idea_id` ditandai `used`. Scope `thinking` mengurutkan idea yang belum dipakai lebih dulu, lalu yang terbaru, dan hanya mengembalikan delapan baris. SOP1 dan SOP2 memilih idea yang belum terpakai, lalu menyimpan plan lewat `thinking.plan.save`. Idea yang sama tidak bisa menjadi plan kedua.

Execution manusia (`author_employee_id` kosong) tidak diubah. Naya hanya memperbarui baris yang `author_employee_id`-nya dirinya. Kalau belum ada, ia menambah baris baru.

`thinking.execution.check` tidak lagi mengembalikan `accepted = true` untuk payload kosong. Payload harus memuat sepuluh id cek Thinking Lab berstatus `pass`, plus `facts` dengan `resolution = RESOLVED`, `relationToParent = VALID_EXECUTION`, dan `unresolvedReasons` kosong. Baru setelah itu execution disimpan. Panggilan model yang menghasilkan fakta itu dihitung lewat `ai_employee_reserve_model_call`.

## Kalender, pilar, dan brand

Scope `calendar` membaca plan seluruh organisasi pada rentang tanggal: judul, tanggal, pillar, katalog, pembuat, dan PIC. Tidak ada teks brief. SOP1 menganggap hari terisi bila siapa pun sudah punya plan di hari itu.

Batas pillar 40% tetap dihitung dari plan Naya sendiri, lewat scope `plans`.

SOP1 hanya membuat plan untuk katalog di brief. Lebih dari satu katalog mengikuti urutan dan `split_rule`. Instruksi SOP2 dari owner boleh menyebut nama katalog lain dan menimpa fokus itu. Tanpa brief, SOP1 berhenti `brief_missing` dan tidak membuat plan.

## Performa

Scope `performance` belum berisi metrik hasil. Tidak ada CTR, spend, reach, impression, atau engagement dari konten maupun iklan. Yang dikembalikan hanya jumlah plan per pillar pada 28 hari terakhir, plus jumlah akun iklan Google, Meta, dan TikTok yang terhubung. Tidak ada id akun, token, nama orang, atau email. Menulis iklan tetap `action_forbidden`.

## Hak akses

Tabel brief tidak diberikan ke `anon`, `authenticated`, `service_role`, atau `ai_employee_runner`. `ai_employee_brief_read` dan `ai_employee_brief_write` hanya untuk `service_role`, dan keduanya menolak pemanggil yang bukan owner. `ai_employee_accept_execution` tidak diberikan ke siapa pun; hanya pintu `ai_employee_perform` yang memanggilnya. Runner tetap hanya boleh `ai_employee_context` dan `ai_employee_perform`.
