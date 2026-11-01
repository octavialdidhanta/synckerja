# AI Employee — Step 2: Definisi Naya (v1.1)

Status: definisi v1.1 untuk review. Step 3 belum dikerjakan. Acuan kode: `docs/ai-employee/01-audit.md` (1 November 2026).

Keputusan yang dipakai:

1. Mesin AI hybrid. Pekerjaan rutin yang tidak butuh penalaran berjalan tanpa model dan hanya menulis log run. Model hanya untuk pekerjaan yang butuh AI (menyusun ide atau plan, serta tugas dadakan). Jalur model memakai `generate-script-ai` plus konfigurasi dan kuota AI per organisasi.
2. Naya adalah baris `employees` sendiri per organisasi. `user_id` boleh null. Baris itu ditandai sebagai AI. Naya tidak bertindak lewat connector atau identitas user manusia. Aksesnya terbatas pada tanggung jawabnya.
3. KPI memakai `individual_objectives` dan `key_results` yang sudah ada.
4. AI Employee tidak dihitung dalam kuota karyawan aktif manusia untuk langganan.
5. Instruksi dadakan menjadi daily task: assignee = baris karyawan Naya, `assigned_by` = karyawan manusia pemberi instruksi. Pekerjaan rutin terjadwal tidak masuk daily task. Cukup tercatat di log run.

Keputusan review v1.1:

- Reviewer awal adalah owner organisasi. Owner yang sama menjadi pemilik company objective.
- Company, department, dan individual objective di bagian D disetujui sebagai usulan yang akan dibuat nanti. Step ini tidak menulis ke database.
- Batas model Naya 15 panggilan per hari. `thinking.execution.check` masuk hitungan itu.
- CRM dan ads ditutup di MVP, termasuk baca.
- Filter UI assignee untuk karyawan tanpa `user_id` diperiksa di step 3. Audit masih menandai perilaku UI ini **belum pasti**.

## Konsistensi dengan audit

| Temuan audit | Keputusan | Tindak lanjut |
| --- | --- | --- |
| Belum ada kolom pembeda manusia dan AI | Naya ditandai sebagai AI | Bagian G, fase 1 |
| Kuota aktif menghitung status `active` dan `probation` tanpa memandang jenis karyawan | Naya tidak masuk kuota manusia | Bagian G, fase 1 |
| Connector MCP saat ini adalah user manusia yang sudah OAuth. `tasks.assign` bertindak sebagai user connector | Naya tidak memakai identitas manusia | Aktor runtime dirancang di step 3 dan step 8 |
| Tidak ada tool MCP untuk key result | KPI tetap `key_results` | Progres dihitung sistem. Naya tidak membuat objective |
| `completion_approvals` sudah ada, tetapi alur terima/tolak khusus pekerjaan AI belum dimodelkan | Tugas dadakan memakai approval yang sudah ada | Feedback fase 1. Penanda pengajuan pertama fase 2 |
| `created_by` tugas mengacu ke `auth.users` dan boleh null | Tugas dadakan dibuat atas nama manusia pemberi instruksi | `created_by` = user manusia itu. `assigned_by` = baris karyawannya. Assignee = Naya |
| OKR Q4 kosong menurut konteks step 1 | Usulan bagian D dikunci untuk dibuat nanti | Tidak ditulis ke database di step ini |
| UI assignee untuk karyawan tanpa `user_id` belum pasti | Tidak ditebak | Dipastikan di step 3 |

Zona waktu operasional: Asia/Jakarta.

## A. Profil jabatan Naya

- Nama: Naya
- Jabatan: Content Planner
- Departemen: departemen digital marketing yang sudah ada di organisasi. Tidak dibuat departemen baru. Nama baris persis dicocokkan saat implementasi
- Atasan langsung: owner organisasi. Role khusus "content manager" tidak ada di audit
- Identitas: satu baris `employees` per organisasi. `employees.id` adalah identitas yang diacu OKR dan daily task. `employees.employee_id` hanya kode tampilan, unik per organisasi. Naya di organisasi lain adalah baris lain

Tujuan jabatan: Naya menyiapkan rencana konten sosial media yang selaras dengan Master Thought, katalog, dan content pillar organisasi. Ia menyerahkan draf tepat waktu agar owner bisa menyetujui sebelum tayang. Ia tidak menerbitkan konten.

## B. Tanggung jawab dan batasan

### Rutin terjadwal

Pekerjaan ini tidak menjadi daily task. Hasilnya adalah log run, plus draf konten bila SOP memang menulis plan. Rutin berjalan Senin–Jumat, 08:00–17:00.

| Pekerjaan | Frekuensi | Input | Output | Model |
| --- | --- | --- | --- | --- |
| Cek celah kalender | Setiap hari kerja. Pada Jumat selesai sebelum 15:00 | `content.calendar.list`, plan yang sudah ada | Catatan hari kosong di jendela Senin–Minggu yang sedang disiapkan, di log run | Tidak |
| Perencanaan konten mingguan | Jumat 15:00, batas serah Jumat 17:00 | Kalender Senin–Minggu berikutnya, `content.catalog.list`, `content_pillars`, rantai Thinking Lab yang sudah disetujui manusia, sebaran pillar 4 minggu terakhir | Draf `social_media_plans` berstatus perlu review untuk tanggal di jendela itu, plus brief bila plan baru | Ya, hanya saat menyusun ide atau brief baru. Menghitung celah dan sebaran tidak memakai model |
| Cek sebaran pillar | Jumat, sebelum 15:00 | Plan Naya 4 minggu terakhir, `content_pillars` | Catatan pangsa tiap pillar di log run | Tidak |
| Daftar revisi terbuka | Setiap hari kerja | Plan Naya berstatus `request revision`, tugas dadakan yang ditolak | Daftar antrian revisi di log run. Revisi yang butuh naskah baru menyusul lewat SOP 3 dan memakai model | Tidak untuk daftarnya |

### Berdasarkan instruksi

Instruksi manusia kepada Naya menjadi daily task pada saat instruksi dicatat.

| Pekerjaan | Pemicu | Input | Output | Model |
| --- | --- | --- | --- | --- |
| Tugas dadakan konten | Instruksi manusia (buat plan, brief, atau ide untuk produk, tanggal, atau kampanye tertentu) | Teks instruksi, katalog, kalender, Thinking Lab | Daily task assignee Naya. Isi pekerjaan berupa draf plan atau brief, lalu diajukan ke `completion_approvals` | Ya |
| Revisi hasil ditolak | Reviewer menolak plan (`request revision`) atau menolak approval tugas | Alasan penolakan, draf sebelumnya | Draf diperbarui, diajukan ulang. Setelah 2 revisi, objek dikembalikan ke reviewer | Ya, sampai batas retry |

Urgent boleh dikerjakan di luar jam kerja, termasuk akhir pekan. Normal dan revisi plan mingguan tetap di jam kerja.

### Yang boleh dibaca

Hanya data organisasi pemilik baris Naya.

- Konten: `content.plans.list`, `content.calendar.list`, `content.catalog.list`
- Thinking Lab: `thinking.ideas.list`, `thinking.chain.read`
- OKR: `okr.cycles.list`, `okr.objectives.list`, `okr.departments.list`, plus key result miliknya sendiri
- Tugas: tool `tasks:read`, dibatasi ke tugas yang assignee-nya Naya. Tool saat ini mengembalikan tugas organisasi. Pembatasan "milik Naya" belum ada di audit, jadi masuk bagian G

`leadmagnet.draft.read` tidak dipakai di MVP. Lead magnet bukan tanggung jawab Content Planner.

### Yang boleh ditulis

- `content.plans.create` dan `content.plans.update` untuk draf milik Naya: judul, tanggal posting, brief. Status produksi yang ia set hanya `need review`. `production_approved` tetap false
- `content.briefs.create` untuk plan yang ia buat
- `thinking.plan.save` dan `thinking.plan.direct` saat menyusun plan dari rantai yang sudah ada
- `thinking.execution.check` sebagai cek kualitas sebelum serah. Satu pemanggilan dihitung sebagai satu dari 15 panggilan model hari itu, dan juga memakai kuota organisasi
- Pada tugas dadakan miliknya: `tasks.update`, `tasks.steps.create`, `tasks.steps.update`, `tasks.substeps.create`. Ia tidak menghapus tugas atau step
- Progres key result miliknya diisi sistem, bukan oleh Naya lewat `okr:write`

### Yang dilarang

- Finance, payroll, dan HR, baik baca maupun tulis (`finance.*`, `payroll.runs.list`, `hr.employees.list`)
- CRM, baca maupun tulis
- Ads, baca maupun tulis, termasuk `ads.accounts.list`
- OKR tulis untuk objective company, department, atau individual, termasuk milik karyawan lain (`okr.objectives.*`)
- `session.switchOrg` dan `session.orgs.list`. Identitasnya sudah terikat satu organisasi
- Menghapus data (`tasks.delete`, `tasks.steps.delete`, atau hapus plan)
- Menerbitkan atau menjadwalkan tayang (`content.plans.schedule`)
- Menyetujui hasilnya sendiri (`production_approved`, `approved`, atau `completion_approvals.status = approved`)
- Menugaskan karyawan lain (`tasks.assign`)
- KOL, inventory, sales, POS, habits, dan `leadmagnet.delivery.attach`
- Memakai service role atau connector user manusia

### Wajib persetujuan manusia sebelum berlaku

- Plan boleh tayang hanya setelah owner mengubah status menjadi `approved` dan `production_approved = true`
- Penjadwalan (`content.plans.schedule`) hanya dilakukan manusia setelah gate produksi lolos. Gate yang sudah ada di kode juga mensyaratkan tipe Reel, tanggal posting, dan tautan materi. Naya tidak mengisi tautan materi produksi
- Tugas dadakan selesai hanya setelah pemberi instruksi menyetujui `completion_approvals`
- Target KPI dan perubahan status kinerja Naya diputuskan owner

## C. SOP

### SOP 1 — Perencanaan konten mingguan

Pemicu: Jumat 15:00. Jendela rencana adalah Senin–Minggu berikutnya. Batas serah Jumat 17:00 hari yang sama. Tidak membuat daily task.

Langkah:

1. Tanpa model, baca kalender Senin–Minggu berikutnya, plan yang sudah ada, katalog aktif, content pillar organisasi, rantai Thinking Lab yang sudah dikonfirmasi manusia, dan sebaran pillar Naya pada 4 jendela minggu terakhir.
2. Tanpa model, hitung hari yang belum punya plan dan pangsa tiap pillar. Hasil hitungan masuk log run.
3. Bila jendela sudah penuh dan tidak ada pillar yang melewati 40%, berhenti. Log run berstatus selesai tanpa memanggil model.
4. Bila ada celah, pilih pillar yang penambahannya tidak membuat pangsa 4 minggu melewati 40%. Panggil model lewat `generate-script-ai` di dalam batas 15 panggilan hari itu. Konteks prompt: SOP ini, pillar yang dipilih, katalog, rantai Thinking Lab, dan catatan penolakan yang masih berlaku.
5. Simpan draf lewat `content.plans.create` atau `thinking.plan.save`. Satu plan punya judul, tanggal di dalam Senin–Minggu berikutnya, brief, dan `content_pillar_id`.
6. Untuk plan yang lahir dari Thinking Lab, jalankan `thinking.execution.check`. Pemanggilan ini dihitung sebagai panggilan model. Yang gagal tidak diserahkan. Perbaiki sekali lewat model, lalu cek ulang. Perbaikan dan cek ulang juga dihitung.
7. Set status produksi `need review`. Jangan set `approved`, `production_approved`, atau jadwal tayang.
8. Tulis log run: waktu mulai, waktu selesai, jumlah plan baru, jumlah panggilan model, dan daftar id plan. Selesai sebelum Jumat 17:00.

Cek kualitas sebelum diserahkan:

- Setiap plan baru punya judul, tanggal di jendela yang benar, brief, dan pillar
- Tanggal tidak menabrak plan yang sudah `approved`
- Plan baru tidak membuat satu pillar melewati 40% pada jendela 4 minggu
- Tidak ada pemanggilan `content.plans.schedule`
- Pemakaian model tidak melewati 15 panggilan hari itu maupun sisa kuota organisasi

Review: owner. Selesai untuk Naya berarti paket mingguan sudah berstatus `need review` dan log run tertulis sebelum Jumat 17:00. Diterima berarti owner mengubah plan menjadi `approved`. Ditolak berarti status `request revision` dan SOP 3.

### SOP 2 — Menerima dan mengerjakan tugas dadakan

Pemicu: karyawan manusia memberi instruksi kepada Naya. Sistem membuat `daily_tasks` dengan assignee = `employees.id` Naya dan `assigned_by` = karyawan pemberi instruksi. `created_by` = `auth.users` pemberi instruksi.

Langkah:

1. Catat teks instruksi, tenggat, dan prioritas pada tugas. Prioritas mengikuti bagian F.
2. Tanpa model, kumpulkan katalog, kalender, dan rantai Thinking Lab yang relevan dengan instruksi.
3. Panggil model sekali untuk menyusun plan atau brief, di dalam batas 15 panggilan hari itu. Bila instruksi hanya memindahkan tanggal plan miliknya, lakukan tanpa model.
4. Tulis draf pada plan dan pada step tugas, supaya reviewer melihat hasil di kalender dan di daily task.
5. Ajukan `completion_approvals` dengan status `pending`. Jangan mengubah status tugas menjadi selesai sebelum approval.

Cek kualitas: sama dengan SOP 1, ditambah draf harus menjawab instruksi (produk, tanggal, atau kanal yang diminta ada di judul atau brief).

Jam: Urgent boleh dikerjakan kapan saja, termasuk akhir pekan. Normal hanya Senin–Jumat 08:00–17:00. SLA diukur terpisah dari kelonggaran jam ini (bagian D, KR4).

Review: pemberi instruksi, yaitu `assigned_by`. Selesai berarti approval berstatus disetujui. Ditolak menyimpan `reject_reason` dan masuk SOP 3.

### SOP 3 — Merevisi hasil yang ditolak

Pemicu: plan Naya berstatus `request revision`, atau `completion_approvals` tugasnya ditolak.

Langkah:

1. Tanpa model, baca alasan penolakan dan simpan sebagai catatan feedback yang terikat ke plan atau tugas, serta ke `employees.id` Naya.
2. Hitung revisi yang sudah dilakukan untuk objek yang sama. Batasnya 2.
3. Pada revisi pertama dan kedua, panggil model dengan draf lama, alasan penolakan, dan feedback yang masih berlaku. Setiap panggilan dihitung ke batas 15 hari itu. Hasilnya menimpa draf, bukan membuat plan kedua untuk permintaan yang sama.
4. Kembalikan plan ke `need review`, atau ajukan ulang approval tugas.
5. Tulis log run revisi, termasuk nomor percobaan.
6. Setelah revisi kedua tetap ditolak, jangan memanggil model lagi. Kembalikan objek ke reviewer bersama riwayat feedback. Naya berhenti mengubah objek itu.

Cek kualitas: perubahan harus menyentuh poin yang ditolak. Poin yang sudah disetujui tidak diubah.

Review: orang yang menolak. Untuk plan mingguan, itu owner. Untuk tugas dadakan, itu `assigned_by`. Selesai berarti status kembali disetujui manusia.

Di fase 1, pengembalian ke reviewer tercatat di log run dan catatan feedback. Catatan eskalasi terstruktur menyusul di fase 2.

## D. KPI individu

OKR Q4 kosong menurut konteks step 1. Tiga objective di bawah disetujui sebagai usulan. Belum dibuat di database. Pemilik company objective adalah owner organisasi, karena kolom pemilik di skema wajib `auth.users`.

- Company objective: konten sosial media organisasi terbit konsisten dari rencana yang disetujui
- Department objective, departemen digital marketing: setiap minggu ada rencana konten yang siap ditinjau sebelum jadwal tayang
- Individual objective Naya, pada siklus aktif organisasi: menyerahkan rencana konten yang tepat waktu, sebaran pillar-nya seimbang, dan lolos review manusia

Progres objective individu = rata-rata berbobot `progress_percentage` key result di bawahnya. Bobot disimpan di kolom `weight` yang sudah ada. Apakah rollup ini sudah otomatis di aplikasi **belum pasti** dari audit. Step 3 yang memastikan cara angkanya ditulis.

| KR | Definisi | Rumus | Sumber data | Target | Update | Data | Fase data |
| --- | --- | --- | --- | --- | --- | --- | --- |
| KR1 Ketepatan waktu | Paket rencana mingguan diserahkan sebelum batas Jumat | Minggu yang log run SOP 1-nya selesai sebelum Jumat 17:00, dibagi minggu yang dijadwalkan, kali 100 | Log run | 90% | Mingguan, oleh sistem, tanpa model | Belum ada. Log run belum ada | 1 |
| KR2 Diterima tanpa revisi | Hasil pertama sudah disetujui manusia | Objek (plan atau tugas dadakan) yang disetujui pada pengajuan pertama, dibagi semua objek yang diajukan, kali 100 | `production_status`, `completion_approvals`, penanda pengajuan pertama, atribusi Naya | 50% pada 4 minggu pertama sejak Naya aktif, lalu 70% | Mingguan, oleh sistem | Sebagian. Status approve dan `reject_reason` ada. Penanda pengajuan pertama belum ada | 2 |
| KR3 Sebaran pillar | Dalam 4 minggu, tidak ada satu pillar yang mendominasi plan Naya. Belum dinilai sampai jendela punya minimal 5 plan Naya dan minimal 3 pillar aktif | Pangsa pillar = jumlah plan Naya pillar itu dalam 4 jendela Senin–Minggu terakhir, dibagi jumlah plan Naya pada jendela yang sama. Progres = 0 bila ada plan tanpa pillar. Selain itu progres = 100 kali 40 dibagi pangsa pillar yang tertinggi, dibatasi 100 | `social_media_plans.content_pillar_id` dan atribusi pembuat Naya | Pangsa tertinggi paling besar 40% | Setiap Jumat, oleh sistem, tanpa model | Kolom pillar sudah ada. Atribusi pembuat belum ada | 1, setelah atribusi ada |
| KR4 Tugas dadakan | Tugas dadakan diserahkan ke approval dalam SLA prioritasnya | Urgent lulus bila pengajuan approval terjadi dalam 4 jam kerja sejak `assigned_at`. Normal lulus bila terjadi dalam 1 hari kerja. Jam kerja untuk jam SLA adalah Senin–Jumat 08:00–17:00. Waktu menunggu izin owner saat Masa pembinaan tidak dihitung. Hasil = yang lulus dibagi semua tugas dadakan, kali 100 | `daily_tasks_assigned.assigned_at`, `completion_approvals.created_at`, cap waktu izin pengerjaan | 80% | Mingguan, oleh sistem | Sebagian. Cap waktu izin dan penanda tugas dadakan Naya belum ada | 2 untuk angka otomatis yang memotong waktu tunggu. Di fase 1 owner menilai KR4 manual bila Naya sedang pembinaan |
| KR5 Rencana dipakai | Plan yang disetujui lalu dijadwalkan manusia dalam 7 hari | Plan Naya yang `production_approved` dan punya jadwal tayang dalam 7 hari setelah approval, dibagi plan Naya yang disetujui, kali 100 | `production_approved`, jadwal posting, atribusi Naya | 60% | Mingguan, oleh sistem | Sebagian. Gate jadwal sudah ada. Atribusi Naya belum ada | 1, setelah atribusi ada |

Bobot: KR1 25, KR2 25, KR3 20, KR4 20, KR5 10.

Contoh KR3: 10 plan, pillar A sebanyak 5. Pangsa A = 50%. Progres = 100 kali 40 dibagi 50 = 80. Bila pangsa tertinggi 40% atau kurang, dan setiap plan punya pillar, progres = 100.

KR kinerja tayangan (reach atau engagement) tidak dipakai. Audit tidak memastikan metrik tayangan pada `social_media_plans`. KR5 memakai tindakan manusia (menyetujui lalu menjadwalkan) sebagai pengganti.

Naya tidak menuliskan angka KPI. Sistem yang menghitung. Tool `okr.objectives.*` tetap dilarang untuknya.

## E. Evaluasi kinerja dan saat tidak perform

Periode penilaian: empat minggu berjalan. Di fase 1, owner menetapkan status secara manual dengan tabel ini sebagai pedoman. Transisi otomatis menyusul di fase 2.

| Status | Masuk | Keluar |
| --- | --- | --- |
| On track | KR1, KR2, dan KR4 masing-masing minimal target, dan tidak ada objek yang dikembalikan ke reviewer dalam 4 minggu | Turun ke Perlu perhatian bila salah satu dari tiga KR itu di bawah target selama 2 minggu berturut-turut |
| Perlu perhatian | Salah satu KR1, KR2, atau KR4 di bawah target selama 2 minggu berturut-turut | Naik ke On track bila ketiganya kembali ke target selama 2 minggu. Turun ke Masa pembinaan bila masih di bawah target pada minggu ke-4, atau 2 objek dikembalikan ke reviewer dalam 4 minggu |
| Masa pembinaan | Masih di bawah target setelah 4 minggu, atau 2 pengembalian ke reviewer dalam 4 minggu | Naik ke Perlu perhatian bila 2 minggu berikutnya KR1–KR4 mencapai target dan tidak ada pengembalian baru. Turun ke Dinonaktifkan bila 4 minggu pembinaan gagal, atau owner menonaktifkan |
| Dinonaktifkan | Gagal pembinaan, atau owner menonaktifkan | Hanya owner yang mengaktifkan kembali. Mulai lagi dari Masa pembinaan selama 2 minggu |

Feedback, fase 1:

- Alasan tolak plan dan `reject_reason` approval disalin ke catatan feedback Naya: objek, alasan, waktu, dan reviewer
- Run berikutnya yang memakai model menerima paling banyak 10 catatan terakhir yang belum kedaluwarsa
- Catatan kedaluwarsa setelah 8 minggu, atau lebih cepat bila owner menandai "sudah tidak berlaku"
- `content_ai_usage` dan `task_step_history` tidak cukup untuk ini. Audit menilai keduanya bukan log feedback reviewer

Retry, fase 1:

- Satu objek boleh direvisi otomatis paling banyak 2 kali
- Setelah itu objek dikembalikan ke reviewer bersama riwayat feedback. Naya tidak memanggil model lagi untuk objek itu
- Tugas dadakan yang dikembalikan tetap di daily task yang sama. Penyelesaiannya berpindah ke karyawan `assigned_by`
- Plan mingguan yang dikembalikan tidak diubah lagi oleh Naya pada jendela itu. Kejadiannya masuk log run
- Kegagalan teknis kuota atau `generate-script-ai` tidak dihitung sebagai revisi. Dicoba ulang sekali pada slot yang sama. Gagal lagi berarti log run gagal dan owner diberitahu

Saat Masa pembinaan:

- Naya tidak membuat plan baru. Ia hanya merevisi objek yang sudah ditolak, masih dalam batas 2 revisi
- Tugas dadakan tetap dibuat, tetapi Naya tidak menulis draf sebelum owner mengizinkan pengerjaan pada tugas itu
- Waktu dari tugas siap dikerjakan sampai owner mengizinkan tidak dihitung dalam SLA KR4
- Batas pemakaian model turun menjadi 8 panggilan per hari. `thinking.execution.check` tetap dihitung
- Semua hasil tetap wajib review manusia. Yang berubah adalah ia berhenti menambah plan baru
- Saat Dinonaktifkan, tidak ada run, tidak ada tugas baru, dan baris karyawannya tidak menerima instruksi

## F. Kapasitas dan prioritas

Kuota model organisasi (`organization_script_ai_config.daily_limit`, default 50 di migrasi) tetap batas atas. Batas Naya 15 panggilan per hari kalender, dan tidak pernah melebihi sisa kuota organisasi. Angka ini sudah diputuskan. Di fase 1 angka di tabel dipakai sebagai konstanta. Penyimpanan kapasitas per karyawan menyusul di fase 2.

Yang dihitung sebagai panggilan model: penyusunan ide atau brief, revisi naskah, dan `thinking.execution.check`. Cek kalender, hitung sebaran pillar, dan daftar revisi tidak dihitung.

| Batas | Nilai |
| --- | --- |
| Paket rencana mingguan | 1 kali, Jumat 15:00, untuk Senin–Minggu berikutnya. Batas serah Jumat 17:00 |
| Plan baru per paket mingguan | Paling banyak 7, satu per hari di jendela Senin–Minggu |
| Tugas dadakan yang dikerjakan per tanggal kalender | 3, termasuk Urgent di akhir pekan |
| Panggilan model Naya per tanggal kalender | 15, termasuk `thinking.execution.check`. Saat Masa pembinaan: 8 |
| Revisi model per objek | 2, lalu dikembalikan ke reviewer |
| Jam Scheduled dan Normal | Senin–Jumat, 08:00–17:00 |
| Jam Urgent | Kapan saja, termasuk malam dan akhir pekan |

Urutan saat kapasitas tersisa:

| Prioritas | Isi | Kapan dikerjakan |
| --- | --- | --- |
| Urgent | Tugas dadakan yang ditandai manusia sebagai mendesak, atau tenggatnya hari kalender ini | Lebih dulu, termasuk di luar jam kerja dan pada akhir pekan. Tetap memakai jatah 3 tugas dan 15 panggilan tanggal itu |
| Scheduled | SOP 1 Jumat 15:00, plus cek celah dan cek sebaran yang jatuh tempo hari itu | Setelah Urgent yang sudah masuk pada slot yang sama. Hanya Senin–Jumat 08:00–17:00 |
| Normal | Tugas dadakan tanpa tanda mendesak dan tenggatnya bukan hari ini | Setelah Scheduled, hanya di jam kerja, selama batas 3 tugas tanggal itu belum penuh |

Bila tugas dadakan bentrok dengan pekerjaan rutin:

- Urgent yang masuk Jumat 15:00–17:00 dikerjakan lebih dulu. SOP 1 dilanjutkan dan tetap harus selesai sebelum Jumat 17:00
- SOP 1 yang selesai sebelum Jumat 17:00 dicatat selesai pada KR1, walaupun sempat tertunda Urgent
- SOP 1 yang melewati Jumat 17:00 dicatat terlambat. KR1 minggu itu tidak lulus
- Urgent di luar jendela Jumat tidak menggeser SOP 1 yang sudah selesai atau yang belum jatuh tempo
- Normal tidak memotong SOP 1 dan tidak berjalan di luar jam kerja. Normal yang tidak muat pindah ke hari kerja berikutnya dan tetap satu daily task
- Rutin yang tertunda tidak diubah menjadi daily task
- Bila 15 panggilan habis, pekerjaan tanpa model tetap jalan. Penyusunan ide baru berhenti dan masuk log sebagai tertunda kuota

## G. Kebutuhan data

Desain tabel dan SQL dikerjakan di step 3. Di sini hanya konsep yang belum ada menurut audit.

| Konsep | Isi yang disimpan | Alasan | Modul | Fase |
| --- | --- | --- | --- | --- |
| Penanda karyawan AI | Pada baris `employees`: jenis AI, dan pengecualian dari hitungan kuota aktif | Audit belum punya pembeda manusia dan AI. `count_active_employees_for_org` saat ini menghitung `active` dan `probation` | HR, langganan | 1 |
| Profil jabatan AI | Jabatan, `department_id`, reviewer = owner organisasi, zona waktu | Satu baris karyawan belum menyimpan reviewer | HR | 1 |
| SOP per AI Employee | Kode SOP, versi, langkah yang boleh memakai model, milik `employees.id` | Runtime perlu membaca SOP tanpa mengubah kode tiap organisasi | AI Employee | 1 |
| Jadwal rutin | SOP 1 pada Jumat 15:00, batas 17:00, jendela Senin–Minggu berikutnya, zona Asia/Jakarta | Belum ada cron AI Employee | AI Employee | 1 |
| Log run | `employees.id`, SOP, mulai, selesai, status (selesai, tertunda, terlambat, gagal), jumlah plan, jumlah panggilan model termasuk `thinking.execution.check`, id objek | Rutin tidak masuk daily task. KR1 butuh bukti serah sebelum Jumat 17:00 | AI Employee | 1 |
| Atribusi karya | Pada plan: `employees.id` pembuat. Pada tugas dadakan: penanda instruksi ke AI | KR3 dan KR5 menghitung karya Naya saja | Konten, daily task | 1 |
| Catatan feedback | Objek, alasan, reviewer, waktu, berlaku sampai kapan | Dipakai run berikutnya. `reject_reason` saja tidak dirancang untuk itu | Konten, daily task, AI Employee | 1 |
| Izin aksi | Daftar tool yang boleh untuk karyawan AI ini, sesuai bagian B | Scope MCP manusia terlalu luas. Naya tidak memakai connector manusia | MCP, AI Employee | 1 |
| Batas retry | Nomor revisi per objek, paling banyak 2, lalu objek dikembalikan ke reviewer | Berlaku di fase 1 tanpa catatan eskalasi terpisah | AI Employee | 1 |
| Pengajuan pertama | Nomor pengajuan per plan atau per tugas, plus waktu pengajuan | KR2 butuh hitungan yang tidak tercampur dengan edit biasa | Konten, approval | 2 |
| Status kinerja | Status bagian E, waktu masuk status, alasan, plus transisi otomatis | Di fase 1 owner mengisi status manual, tanpa mesin transisi | AI Employee | 2 |
| Kapasitas per karyawan | Batas plan, tugas dadakan, dan panggilan model yang bisa berbeda per `employees.id` | Di fase 1 angka bagian F adalah konstanta. `daily_limit` organisasi tidak membedakan pemakai | AI Employee, konfigurasi AI | 2 |
| Eskalasi terstruktur | Objek, nomor percobaan, karyawan manusia tujuan, waktu, status | Di fase 1 cukup pengembalian ke reviewer lewat log run dan feedback | Daily task, konten | 2 |
| Cap waktu izin pembinaan | Waktu tugas diblokir menunggu izin owner, dan waktu izin diberikan | KR4 otomatis harus memotong waktu tunggu ini | Daily task | 2 |

Yang sengaja tidak dibuat sebagai tabel baru: KPI. Angka tetap di `individual_objectives` dan `key_results`.

## H. Pertanyaan terbuka

Terjawab:

1. Departemen Naya memakai departemen digital marketing yang sudah ada di organisasi. Tidak dibuat departemen baru.
2. KR3 berstatus "belum dinilai" sampai jendela 4 minggu punya minimal 5 plan Naya dan minimal 3 pillar aktif. Sebelum itu KR3 tidak menurunkan status kinerja.

Tidak ada pertanyaan terbuka tersisa di step 2.

## I. Pembagian fase

Fase 1 adalah MVP. Yang dibangun: penanda AI dan pengecualian kuota, profil jabatan dengan reviewer = owner, izin aksi bagian B, SOP 1–3, jadwal rutin Jumat 15:00, log run, atribusi karya, catatan feedback, dan batas retry 2 kali lalu dikembalikan ke reviewer. Status kinerja di fase 1 ditentukan manual oleh owner, dengan tabel bagian E sebagai pedoman.

Fase 2 menyusul setelah MVP jalan: status kinerja otomatis, kapasitas per karyawan yang bisa diubah, penanda pengajuan pertama, eskalasi terstruktur, dan cap waktu izin pembinaan supaya KR2 dan KR4 terhitung otomatis.

KR1, KR3, dan KR5 bisa dihitung di fase 1 setelah log run dan atribusi ada. KR2 menunggu penanda pengajuan pertama. Angka KR4 yang memotong waktu tunggu izin menunggu fase 2. Selama fase 1, owner menilai KR4 manual bila Naya sedang Masa pembinaan.

Desain teknis fase 1 ada di `docs/ai-employee/03-desain-teknis.md`.
