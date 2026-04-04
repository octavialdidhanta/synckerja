# whatsapp-webhook

Edge function untuk menerima webhook dari Meta (WhatsApp + Instagram). GET untuk verifikasi, POST untuk pesan masuk.

## Logs tidak muncul di Dashboard?

- **Setiap request** yang sampai ke function akan log: `whatsapp-webhook request: GET/POST ...`. Jika tidak ada log sama sekali:
  1. **URL di Meta Developer** harus persis: `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook` (lihat project ref di Supabase Dashboard → Settings → General).
  2. **Enforce JWT harus OFF** agar Meta (yang tidak mengirim JWT) bisa memanggil URL. Redeploy dengan `--no-verify-jwt` atau di Dashboard → Edge Functions → whatsapp-webhook → Settings pastikan "Enforce JWT" dinonaktifkan.
  3. **Webhook Instagram:** Di Meta Developer → Webhooks → **Instagram** (bukan hanya WhatsApp) harus dikonfigurasi: Callback URL sama, Verify Token sama, subscribe **messages**.
- Setelah konfigurasi benar, saat Meta kirim GET (verifikasi) atau POST (pesan), log akan muncul di **Supabase Dashboard → Edge Functions → whatsapp-webhook → Logs**.

## Deploy

Setelah `supabase link` (atau dengan `--project-ref`):

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

Dengan project ref langsung:

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt --project-ref najgdwffjhnqlogfrlqa
```

**Penting:** Meta memanggil URL tanpa JWT, jadi deploy harus pakai `--no-verify-jwt` (atau set `whatsapp-webhook.verify_jwt = false` di `supabase/config.toml`).

## Setelah deploy

1. **WhatsApp:** Meta Developer → WhatsApp → Configuration → Webhook: set Callback URL (URL function ini), Verify Token (sama dengan di Connect WhatsApp), subscribe **messages**.
2. **Instagram:** Meta Developer → Webhooks → Instagram → set Callback URL (sama), Verify Token (sama), subscribe **messages**.

Tanpa langkah di atas, pesan masuk tidak akan dikirim Meta ke URL ini. Lihat `docs/whatsapp-webhook-inbound.md` dan `docs/instagram-webhook-setup.md`.
