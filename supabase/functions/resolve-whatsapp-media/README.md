# resolve-whatsapp-media

Edge Function to resolve inbound WhatsApp media (image/video/document/audio) from Meta and store the file in Supabase Storage, then set `media_url` on the message so the chat UI can show the actual file instead of "[image]".

## Deploy (required for "Tampilkan gambar" to work)

Without deploying, you get **CORS / net::ERR_FAILED** when calling from localhost because the browser’s OPTIONS preflight gets 401 (no JWT).

### Penting: Nonaktifkan JWT verification untuk fungsi ini

Supabase memblokir request **OPTIONS** (preflight) jika JWT verification aktif, karena preflight tidak mengirim header `Authorization`, sehingga respons 401 dan CORS gagal. Fungsi ini memvalidasi JWT sendiri untuk request **POST**.

### Option 1: Supabase Dashboard

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) → project Anda → **Edge Functions**.
2. Buat fungsi baru (atau buka `resolve-whatsapp-media` jika sudah ada).
3. Nama: **`resolve-whatsapp-media`**.
4. Paste isi file **`index.ts`** dari folder ini.
5. **Matikan "Enforce JWT verification"** (Verify JWT = OFF) agar OPTIONS mengembalikan 200.
6. Deploy.

### Option 2: Supabase CLI

Proyek ini punya `supabase/config.toml` dengan `resolve-whatsapp-media.verify_jwt = false`. Setelah login, deploy:

```bash
supabase login
supabase functions deploy resolve-whatsapp-media --project-ref najgdwffjhnqlogfrlqa
```

Atau tanpa config: tambahkan flag **`--no-verify-jwt`**:

```bash
supabase functions deploy resolve-whatsapp-media --project-ref najgdwffjhnqlogfrlqa --no-verify-jwt
```

## Request

- **Method:** POST
- **Headers:** `Authorization: Bearer <user_jwt>`, `Content-Type: application/json`
- **Body:** `{ "message_id": "<whatsapp_messages.id>" }`

## Response

- **200 + media_url:** `{ "media_url": "https://..." }` (sukses)
- **200 + error (gagal resolve):** `{ "media_url": null, "error": "..." }` – tidak pakai 5xx agar client bisa baca JSON; toast menampilkan pesan dari `error`
- **4xx:** `{ "error": "..." }` (Unauthorized, Bad Request, dll.)

## Jika masih dapat 502 (Bad Gateway)

502 biasanya dari gateway Supabase, bukan dari kode fungsi. Pastikan:

1. **Fungsi sudah dideploy** – Dashboard → Edge Functions → `resolve-whatsapp-media` → Deploy, atau CLI: `supabase functions deploy resolve-whatsapp-media --project-ref najgdwffjhnqlogfrlqa`
2. **Env tersedia** – Di Dashboard → Edge Functions → resolve-whatsapp-media → Settings, pastikan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` ada (biasanya otomatis).
3. **Coba lagi** – Kadang 502 karena timeout; klik "Tampilkan gambar" sekali lagi.
