# Tinjauan fungsi KUNING yang bisa dipanggil tanpa login — 4 November 2026

Langkah 5 (bagian pertama) dari task "Sisa hardening keamanan Synckerja (lanjutan 2 Nov 2026)".
Hanya tinjauan; belum ada perubahan database dari dokumen ini.

## Cakupan

Fungsi `SECURITY DEFINER` di schema `public` yang bisa dipanggil `anon` **dan** `authenticated`, dan badannya punya pengecekan (`auth.uid`, `user_organization_ids`, `can_access_web_id`, cek role, dsb.). Jumlah: **75** (37 `pos_*`, 38 lainnya). Daftar "~70" dari 2 Nov tidak tersimpan, jadi daftar ini dihitung ulang dari database live.

Cara tinjau: baca bagian pengecekan setiap fungsi, kelompokkan pola yang sama, lalu uji yang mencurigakan dengan `BEGIN … ROLLBACK` di production sebagai anon, user organisasi lain, dan owner.

## Ringkasan

| Kelompok | Jumlah | Keterangan |
|---|---|---|
| Kritis, terbukti bocor | 3 (+3 terkait) | lihat bawah |
| Rendah / catatan | 9 | perlu perbaikan kecil atau keputusan bisnis |
| Aman | 63 | pengecekan benar; izin `anon` tidak diperlukan untuk sebagian besar |

## Kritis (terbukti lewat uji)

### 1. `_lead_merge_assert_org_access` selalu lolos → merge lead lintas organisasi
Fungsi cek ini melewati pemeriksaan bila `current_user` = `postgres`. Karena fungsi ini sendiri `SECURITY DEFINER` milik `postgres`, `current_user` di dalamnya **selalu** `postgres`, jadi cek organisasi tidak pernah dijalankan.

- Uji: anon dan user organisasi lain memanggil `merge_checkout_identity_bridge_execute(org Aldi, …, p_confirm := false)` → lolos sampai `confirm_required`, bukan `not_authorized`.
- Terdampak: `merge_checkout_identity_bridge_execute` (bisa tanpa login), `merge_customer_lead_duplicates_execute`, `merge_identity_graph_leads_execute`, `merge_typo_email_leads_execute` (user login mana pun). Tiga yang terakhir hanya butuh ID organisasi untuk menggabungkan lead duplikat secara massal di organisasi lain.
- Usul: hapus pengecualian `current_user`; cukup `service_role` atau anggota org (sebaiknya owner/admin). Cabut `anon`.

### 2. `pos_shift_detail` bisa dibaca tanpa login
Cek organisasi hanya berjalan `IF auth.uid() IS NOT NULL`. Anon melewatinya.
- Uji: anon membaca shift kasir org Aldi (kas awal, kas diharapkan, nama kasir, penjualan, kas masuk/keluar). Butuh ID shift.
- Usul: tolak bila `auth.uid()` NULL kecuali `service_role`.

### 3. `pos_ensure_open_shift` mengembalikan shift outlet organisasi lain
Cek hanya bahwa `p_organization_id` milik pemanggil, lalu mencari shift dengan `outlet_id = p_outlet_id` tanpa memastikan outlet itu milik organisasi tersebut.
- Uji: user organisasi lain (dengan org-nya sendiri) + ID outlet milik Aldi → mendapat shift terbuka org Aldi.
- Usul: pastikan `pos_outlets.organization_id = p_organization_id` sebelum mencari shift (seperti `pos_start_shift`).

## Rendah / catatan

| Fungsi | Catatan | Usul |
|---|---|---|
| `apply_catalog_fulfillment_stock`, `apply_catalog_ingredient_produce` | `p_outlet_id` tidak dicek milik org (item tetap milik org pemanggil, dampak terbatas) | validasi outlet seperti `apply_catalog_checkout_stock` |
| `pos_verify_admin_pin_for_outlet`, `pos_staff_verify_pin` | PIN 4 digit tanpa batas percobaan | batasi percobaan per staff/menit |
| `validate_attendance_comprehensive`, `validate_checkout_comprehensive` | logika `ATAU`: anggota org mana pun bisa memvalidasi atas nama karyawan lain (hanya baca) | samakan dengan RPC absensi: hanya diri sendiri atau owner/admin/hr |
| `log_payroll_bank_export` | anggota org mana pun bisa menulis audit "export bank" | batasi owner/admin/hr |
| `pos_staff_is_user_verified` | user login mana pun bisa menanyakan status verifikasi user id mana pun | batasi ke org yang sama |
| 33 laporan `pos_*` (penjualan, laba kotor, pajak, shift, transaksi) | cek organisasi benar, tetapi semua anggota org — termasuk karyawan biasa — bisa membaca laporan keuangan | keputusan bisnis: batasi ke owner/admin atau role tertentu |

## Aman (pengecekan benar)

Diuji langsung: `get_whatsapp/facebook/instagram/email_conversations_with_preview`, `get_organization_members` (anon dan org lain = 0 baris; owner melihat datanya).

Dibaca: semua laporan `pos_*` (pola cek seragam: anon ditolak, org lain ditolak, query difilter `organization_id = p_organization_id`), `admin_list_lead_submissions` (cms admin), `apply_catalog_checkout_stock`, `reverse_store_checkout_stock`, `record_store_checkout_income`, `get_pos_receipt_send_status`, `get_catalog_inventory_workflow_modes`, `list_catalog_inventory_org_roles`, `crm_customer_survey_summary`, `list_pos_receipt_feedback`, `get_click_targets_for_utm_row`, `get_traffic_sessions_by_utm_campaign`, `maybe_refresh_analytics_rollups` (service_role), `compute_lead_magnet_addon_amount`, `candidate_profile_accessible` (anon hanya lewat link rekrutmen aktif), `validate_client_visit_location`, `get_active_payroll_paid_announcements`, `task_step_comment_*`, `task_files_storage_can_write`, `lead_magnet_assets_storage_can_write`, `is_cms_admin`, `is_plan_pic`, `is_omnichannel_survey_settings_admin`, `user_is_org_owner_or_admin`, `auth_profile_id`.

Catatan umum: hampir semua fungsi di atas menolak anon dengan sendirinya, jadi izin `EXECUTE` untuk `anon` tidak diperlukan. Mencabutnya menutup permukaan serangan tanpa mengubah perilaku, kecuali fungsi yang memang dipakai halaman publik (`candidate_profile_accessible`, helper storage) — perlu dicek pemanggilnya dulu.

## Langkah berikutnya

1. Perbaiki 3 temuan kritis (prioritas: merge lead).
2. Putuskan siapa yang boleh melihat laporan POS.
3. Lanjut tinjau ~112 fungsi KUNING yang hanya bisa dipanggil user login.
