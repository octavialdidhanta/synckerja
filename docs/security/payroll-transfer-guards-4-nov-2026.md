# Payroll saat transfer berjalan — 4 November 2026

Langkah 1 dan 2 dari task "Sisa hardening keamanan Synckerja (lanjutan 2 Nov 2026)".

- Migration: `supabase/migrations/20261104110000_payroll_transfer_guards.sql`
- Rollback: `supabase/rollback/20261104_payroll_transfer_guards_rollback.sql`

## Masalah

**1. Bayar dua kali.** Tombol Disburse Xendit mengubah kalkulasi menjadi `processing` lalu mengirim transfer. Selama itu run tetap `calculated`, dan tombol Process (▶ di `PayrollRunsOverview`) tetap aktif. `process_payroll_run` menghapus semua kalkulasi yang belum `paid`, termasuk `processing`, lalu membuat kalkulasi baru `pending`. Tombol Disburse muncul lagi dan transfer kedua bisa dikirim. Callback transfer pertama tidak menemukan barisnya.

**2. Transfer gagal tercatat lunas.** Setelah Xendit selesai dengan sebagian gagal, run tetap `calculated` (`maybe_finalize_payroll_run` hanya menutup run bila semua `paid`), dan tombol Mark as Paid muncul lagi. `mark_payroll_run_paid` mengubah semua yang belum `paid` menjadi `paid`, termasuk `failed`. Dari API, fungsi itu juga tidak menolak `processing`.

## Perbaikan

- `payroll_run_transfer_in_flight(run)` (helper, service_role): jumlah kalkulasi belum `paid` yang `processing`, atau punya transfer Xendit/Brick `pending`/`processing`/`completed`.
- `process_payroll_run`: kunci baris run (`FOR UPDATE`), tolak bila helper > 0. Kalkulasi yang hanya `failed` (uang tidak keluar) tetap boleh dihitung ulang.
- `mark_payroll_run_paid`: kunci baris run, tolak bila ada `processing`, hanya ubah `pending` → `paid`. Bila masih ada `failed`, run tetap `calculated` dan pesan menyebut jumlah yang gagal. Audit log `marked_paid` dengan `partial: true`.
- Teks dialog Mark as Paid menyebut bahwa transfer gagal tidak ikut ditandai.

Cek org, role, dan escrow tidak berubah.

## Uji (`BEGIN … ROLLBACK` di production, data uji dibuat lalu dibuang)

| Skenario | Hasil |
|---|---|
| Process saat 1 kalkulasi `processing` | ditolak |
| Mark paid saat 1 kalkulasi `processing` | ditolak |
| Process saat transfer Xendit `completed` tapi kalkulasi belum `paid` | ditolak |
| Mark paid dengan 1 `pending` + 1 `failed` | 1 `paid`, 1 tetap `failed`, run tetap `calculated` |
| Mark paid dengan semua `pending` | semua `paid`, run `paid` |
| Process run `paid` | ditolak (tetap) |
| Process run yang hanya berisi `failed` tanpa transfer aktif | boleh |

Catatan: organisasi uji punya escrow aktif, jadi Mark as Paid manual memang diblokir di sana; escrow dimatikan sementara di dalam transaksi uji.
