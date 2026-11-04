# Fungsi MERAH — 4 November 2026

Lanjutan `revoke-anon-wave1.md`, bagian "Sisa pekerjaan": fungsi `SECURITY DEFINER` yang mengembalikan data tanpa membatasi ke organisasi pemanggil.

- Migration: `supabase/migrations/20261104100000_security_red_functions.sql`
- Rollback: `supabase/rollback/20261104_security_red_functions_rollback.sql`

## Cara mencari

Fungsi `SECURITY DEFINER` di `public` yang bisa dipanggil `authenticated` atau `anon`, badannya tidak memanggil `auth.uid`, `auth.role`, `user_organization_ids`, `can_access_web_id`, `user_has_org_role`, atau cek role lain. Hasilnya dibaca satu per satu. Fungsi publik berbasis token (review publik, survei, QR order, tes rekrutmen, verifikasi email) sengaja publik dan tidak diubah.

## Yang terbukti bocor (diuji sebelum perubahan)

User B = user organisasi lain. Diuji dengan `BEGIN … ROLLBACK` di production.

| Fungsi | Siapa bisa | Hasil sebelum |
|---|---|---|
| `search_facebook_messages` | tanpa login | mencari isi pesan Messenger org mana pun |
| `search_whatsapp_messages` | user org lain | 86 pesan WhatsApp org lain terbaca |
| `get_whatsapp_conversation_ids_by_message_search` | user org lain | 10 percakapan org lain |
| `get_all_resolved_blockers` | user org lain | judul task dan blocker org lain |
| `get_employee_task_ids` | user org lain | 7 task id karyawan org lain |
| `employee_display_name` | tanpa login | nama/email karyawan dari id |
| `_count_organization_rows` | tanpa login | jumlah baris per tabel untuk org mana pun |
| `audit_duplicate_payment_milestones` | tanpa login | daftar `organization_id` semua tenant |
| `ensure_analytics_web_access_for_org` | tanpa login | bisa mematikan akses traffic org lain |
| `pos_expire_stale_pending_checkouts` | tanpa login | memicu pembatalan checkout QRIS kedaluwarsa |
| `resolve_form_id_for_omnichannel_submission` | tanpa login | form id terakhir org mana pun |

`get_traffic_dashboard` (versi 6 argumen) ternyata **tidak** bocor: rantai fungsi di dalamnya (`get_traffic_dashboard_base_before_utm_click_sync`) sudah menolak dengan `can_access_web_id`. Anon dan org lain mendapat `forbidden`. Yang diubah hanya mencabut `EXECUTE` dari anon.

`get_threads_conversations_with_preview` bisa dipanggil anon, tetapi fungsi dalamnya sudah membatasi ke organisasi user. Tidak diubah.

## Perbaikan

- Dipakai klien → dibungkus (pola wave 2): asli di-RENAME ke `__impl` tanpa mengubah badan, pembungkus menolak `authenticated`/`anon` di luar organisasi. `service_role` dan `postgres` lewat.
- Tidak dipakai klien (tidak ada pemanggil di `src/`, `android-mobile/`, `supabase/functions/`, fungsi lain, policy, view, atau cron) → `EXECUTE` hanya `service_role`.

## Hasil uji setelah perubahan

26 dari 26 lulus (`BEGIN … ROLLBACK`): pemilik org tetap bisa memakai semua fungsi dengan hasil yang sama (86 pesan, 10 percakapan, 7 task, traffic), user org lain dan anon ditolak, `service_role` tetap bisa.

## Temuan lain, tidak diubah

- `resolve_form_id_for_omnichannel_submission` gagal `invalid input syntax for type uuid` bila `lead_submissions.form_id` berisi slug (mis. `contact-page`). Bug lama di badan fungsi.
- Masih ada ~70 fungsi KUNING (langkah 5) yang belum ditinjau.
