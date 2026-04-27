### Tujuan
Menjaga rollup analytics (termasuk `source_breakdown`) tetap update tanpa menghitung dari raw tables saat dashboard dibuka.

### Rekomendasi cadence (traffic tinggi)
- **Tiap 15 menit**: refresh **today + yesterday** (UTC) untuk tiap `web_id` aktif.
  - Alasan: event bisa datang telat (late events) dan beberapa event sesi bisa masuk melewati jam/hari.

### Cara memanggil
Edge function `traffic-refresh-rollups` saat ini menerima:
- `web_id` (wajib)
- `from` dan `to` (opsional; jika keduanya null/diabaikan => mode `maximum`/all-time, tidak disarankan untuk cron)

Untuk cron, gunakan explicit range `yyyy-mm-dd`:

```json
{ "web_id": "<web_id>", "from": "<YYYY-MM-DD>", "to": "<YYYY-MM-DD>" }
```

### Contoh range untuk today + yesterday (UTC)
Di scheduler Anda (GitHub Actions / Supabase Scheduled Functions / server cron), hitung:
- `to = UTC today (yyyy-mm-dd)`
- `from = UTC today - 1 day (yyyy-mm-dd)`

Lalu kirim request POST dengan header `Authorization: Bearer <JWT admin/owner>` seperti pemanggilan manual dari UI.

### Catatan
- Jangan panggil mode `maximum` dari cron kecuali untuk backfill satu kali.
- Jika Anda punya banyak `web_id`, jalankan per `web_id` (serial atau paralel terbatas) untuk menghindari spike load.

