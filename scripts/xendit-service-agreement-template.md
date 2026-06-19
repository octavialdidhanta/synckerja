# Xendit Service Agreement Template (Ops)

## Tujuan

File ini dipakai tenant saat onboarding sub-account MANAGED di `/xendit/connect`. Tenant mengunduh template dari modal KYC, menandatangani, lalu mengunggah PDF.

## Minta template resmi ke Xendit

1. Hubungi **account manager Xendit** (atau support bisnis xenPlatform).
2. Sampaikan konteks: platform Synckerja memakai xenPlatform; butuh **template Service Agreement sub-merchant MANAGED Indonesia** untuk upload API `service_agreement_document`.
3. Simpan file resmi yang dikirim Xendit.

## Ganti placeholder di repo

**Path file (wajib sama):**

```
public/templates/xendit-service-agreement-id.pdf
```

1. Backup/replace file placeholder dengan PDF resmi dari Xendit.
2. Deploy ulang frontend (file `public/` ikut build Vite).
3. Verifikasi di UI:
   - Buka `/xendit/connect` → Tambah sub-account → modal KYC
   - Klik **Unduh template** → pastikan isi PDF benar (bukan teks PLACEHOLDER)
4. Uji upload PDF ditandatangani ke flow KYC.

## Catatan legal

- Jangan commit template resmi ke git jika berisi watermark confidential tanpa izin legal.
- Jika template tidak boleh di-repo, pertimbangkan fase berikutnya: host di Supabase Storage bucket publik + env URL.

## Saat ini

File di `public/templates/xendit-service-agreement-id.pdf` adalah **placeholder** sampai template resmi tersedia.
