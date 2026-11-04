# Fungsi KUNING — 4 November 2026

Lanjutan [fungsi-merah-4-nov-2026.md](fungsi-merah-4-nov-2026.md). Yang ditinjau adalah fungsi `SECURITY DEFINER` di `public` yang masih bisa dipanggil `anon` atau `authenticated`, di luar trigger dan fungsi `__impl`.

- Migration yang dijalankan: `supabase/migrations/20261104150000_kuning_unguarded_fixes.sql`
- Salinan trigger yang sudah hidup: `supabase/migrations/20261104140000_profiles_active_org_guard.sql`
- Uji: `supabase/tests/kuning_critical_dryrun.sql`
- Rollback iris: `supabase/rollback/20261104_kuning_unguarded_fixes_rollback.sql`
- Rollback trigger: `supabase/rollback/20261104_profiles_active_org_guard_rollback.sql`

## Cara mencari

Penanda lama (`auth.uid`, `auth.role`, `user_organization_ids`, `can_access_web_id`, `user_has_org_role`) menghasilkan 93 fungsi. Banyak yang sudah menolak lewat helper, jadi penandanya ditambah: `auth.jwt`, `auth_profile_id`, `is_cms_admin`, `user_is_org_owner_or_admin`, `user_can_`, dan `_guard(`.

Sisanya dibaca badannya, lalu dicari pemanggilnya di `src/`, `android-mobile/`, `supabase/functions/`, policy, view, dan fungsi lain.

## Versi database yang statement-nya kosong

`20261104130000` `kuning_critical_fixes` dan `20261104140000` `profiles_active_org_guard` tercatat di `schema_migrations` dengan `statements` kosong.

Fungsi baru sesudah `record_attendance_checkout` hanya dua: `user_can_manage_attendance` (sudah ada di migration absensi) dan `profiles_enforce_active_org_membership`. Isi `kuning_critical_fixes` tidak ditemukan dan tidak direka.

Trigger yang hidup disalin ke file `20261104140000`. Production sudah punya versi itu. Jangan jalankan file tersebut di database ini. Database baru memakainya.

## Yang diubah di `20261104150000`

Enam status koneksi dibungkus dan `anon` dicabut. Anggota organisasi lain mendapat `42501`. Klien login: `is_tiktok_ads_connected`, `is_tiktok_content_connected`. Saudara yang sama polanya: `is_tiktok_ads_integration_enabled`, `is_linkedin_content_connected`, `is_youtube_content_connected`, `is_blibli_seller_chat_connected`.

Fungsi kerja tanpa pemanggil di `src/` dikunci ke `service_role`. Pemanggil yang ada adalah edge function service role atau cron:

- `apply_meta_session_expired_conversations`
- `apply_template_followup_customer_reply`
- `apply_template_followup_sent`
- `ensure_open_threads_conversation_cycle` (dipanggil dari fungsi `SECURITY DEFINER`)
- `process_due_flow_delay_jobs`
- `purge_expired_google_ads_metrics_cache`
- `run_bank_expense_mutation_match_for_org`

`get_latest_signup_verification_token`, `issue_new_verification_token`, dan `ensure_registration_profile` tetap bisa dipanggil tanpa sesi, supaya halaman daftar tidak putus. Bila sudah ada sesi dan `auth.uid()` bukan user yang diminta, jawabannya `not_authorized` dan token tidak dikembalikan.

`synckerja_order_activated_org_ids` dipindah ke `ops_private`. Policy `catalog_product_photos_public_synckerja_order_menu` ikut memanggil fungsi itu, jadi foto menu tamu tetap bisa dibaca. `EXECUTE` fungsi `public` dicabut dari `anon` dan `authenticated`. Schema `ops_private` tidak masuk API PostgREST. Dua tabel cadangan di schema itu tidak punya grant baca.

## Yang dibaca dan tidak diubah

- Halaman publik: tes rekrutmen berbasis token, review, survei, struk POS, order QRIS tamu, verifikasi email berbasis token, penghitung klik, `analytics_session_touch`.
- `email_exists`, karena login dan daftar memakainya sebelum ada sesi.
- Admin CMS lewat `is_cms_admin()`, dan fungsi yang sudah memanggil `user_is_org_owner_or_admin()`, `auth.jwt()`, `auth_profile_id()`, atau `hub_require_active_web_id`.
- `get_threads_conversations_with_preview` dan `get_traffic_dashboard` versi 6 argumen, sudah dicatat pada 4 November.
- `lead_status_is_resolved_or_expired_visibility`. Trigger `conversations_snapshot_last_handler_on_resolve` bukan `SECURITY DEFINER` dan memanggilnya, jadi grant pemanggil tabel tidak dicabut. Hasilnya boolean kategori status, bukan isi percakapan.
- `pos_finalize_qris_checkout`. `EXECUTE` sudah hanya `service_role`. Badan mengunci `pos_pending_checkouts` lewat `p_pending_id`, lalu menulis `sales_activities.organization_id` dari `v_pending.organization_id`. Argumen actor tidak memilih organisasi lain.

## Hasil uji

`supabase/tests/kuning_critical_dryrun.sql` lulus di SQL editor pada 4 November 2026 dan berakhir `ROLLBACK`.

`supabase/migrations/20261104150000_kuning_unguarded_fixes.sql` kemudian dijalankan di SQL editor yang sama dan lulus. `anon` tidak lagi bisa memanggil status koneksi atau RPC daftar organisasi. Anggota tetap bisa memanggil status koneksi organisasinya. Fungsi kerja hanya untuk `service_role`. Token daftar menolak sesi yang bukan pemiliknya.

Versi `20261104150000` `kuning_unguarded_fixes` sudah tercatat di `schema_migrations`. Jangan menjalankan `20261104140000` di database ini.
