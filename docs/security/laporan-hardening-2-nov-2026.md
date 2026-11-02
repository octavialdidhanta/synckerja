# Laporan pengamanan database — 2 November 2026

Status: perbaikan sudah hidup di database, dan catatannya sudah masuk ke kode resmi (`main`).

Pull request: https://github.com/octavialdidhanta/synckerja/pull/1

Commit di `main`: `8d195c3`

## Apa yang berbahaya

Beberapa fungsi database berjalan dengan hak penuh dan tetap bisa dipanggil tanpa login. Kunci pengunjung ada di aplikasi. Selama akses itu terbuka, pengunjung bisa menjalankan fungsi lewat API, termasuk fungsi yang mengubah pembayaran, pemasukan, payroll, dan data organisasi.

Mencabut akses umum saja tidak cukup. Akses khusus untuk pengunjung tetap menempel pada fungsi yang sudah dibuat.

## Apa yang sudah dilakukan

1. Akses tanpa login dicabut dari fungsi berbahaya yang sudah dicek hari ini.
2. Fungsi payroll yang menghitung, menandai lunas, dan memproses run hanya boleh dijalankan pemilik, admin, atau HR organisasi itu. Fungsi hitung internal hanya boleh dipanggil server.
3. Dua puluh lima fungsi publik dibungkus. Pemanggil di luar organisasi ditolak. Badan aslinya hanya untuk server.
4. Seratus sembilan belas fungsi bantuan hanya untuk server.
5. Jam check-in absensi memakai jam server, bukan jam perangkat yang bisa diubah.
6. Pengaktifan add-on POS tidak lagi percaya jumlah outlet yang dikirim dari aplikasi.
7. Tombol buat payroll run tidak lagi memanggil fungsi hitung yang sudah ditutup. Run baru tetap tersimpan sebagai draft. Total tetap Rp 0 sampai run diproses. Perhitungan gaji tidak dihilangkan: total diisi saat tombol proses ditekan.
8. Fungsi baru yang dibuat role `postgres` tidak lagi otomatis bisa dipanggil tanpa login. Halaman yang memang harus publik wajib diberi izin secara tertulis di migration-nya.

Cek penyalahgunaan pada 2 November 2026 memakai 4 indikator. Keempatnya 0.

Tes layar buat payroll: 2 tes lulus. Tes dijalankan pada komponen, bukan pada database produksi. Tidak ada payroll run baru yang dibuat untuk tes ini.

## Apa yang dilakukan di GitHub

Perubahan di atas sudah diterapkan langsung ke database sebelum dicatat di Git. File migration, skrip rollback, dokumen, dan perbaikan layar payroll lalu disimpan di branch `fix/revoke-anon-wave1` dan digabung ke `main` lewat pull request #1. Penggabungan itu tidak menjalankan SQL lagi.

Empat belas file ikut masuk ke `main`:

- lima migration: `20261102100000`, `20261102110000`, `20261102140000`, `20261102150000`, `20261102160000`
- tiga skrip rollback
- tiga dokumen keamanan
- `CreatePayrollRunDialog.tsx` dan tesnya
- `docs/ai-employee/progress.md` (catatan progres AI Employee, bukan bagian pengamanan)

## Yang sengaja belum dikerjakan

- Jam clock-out masih dari perangkat.
- Beberapa fungsi bertanda kuning dan merah belum ditinjau, termasuk fungsi baca tanpa parameter organisasi.
- Default privilege role selain `postgres` belum diubah.
- Logika payroll saat transfer masih berjalan, dan tandai lunas masih ikut mengubah transfer yang gagal, belum diperbaiki di putaran ini.
