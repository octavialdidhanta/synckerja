# Check Midtrans Payment Status Edge Function

Edge function untuk memeriksa status pembayaran dari Midtrans API dan memperbarui status di database.

## Deploy Instructions

Untuk deploy edge function ini ke Supabase, jalankan perintah berikut:

```bash
# Pastikan Anda sudah login ke Supabase CLI
supabase login

# Deploy edge function
supabase functions deploy check-midtrans-payment-status
```

Atau jika menggunakan Supabase Dashboard:
1. Buka Supabase Dashboard → Edge Functions
2. Klik "Create a new function"
3. Nama function: `check-midtrans-payment-status`
4. Copy paste isi dari `index.ts`
5. Deploy

## Environment Variables

Pastikan environment variables berikut sudah di-set di Supabase:
- `MIDTRANS_SERVER_KEY` - Server key dari Midtrans (sandbox atau production)
- `SUPABASE_URL` - URL Supabase project (otomatis tersedia)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (otomatis tersedia)

## Usage

Function ini menerima POST request dengan body:
```json
{
  "order_id": "ORD-1234567890-abc123"
}
```

Response:
```json
{
  "success": true,
  "message": "Payment status checked and updated",
  "status": "success",
  "transaction_status": "settlement"
}
```

## Features

- Memeriksa status pembayaran dari Midtrans API
- Memperbarui status di database
- Mengaktifkan subscription jika pembayaran berhasil
- Mendukung sandbox dan production Midtrans
