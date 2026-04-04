# instagram-webhook

Webhook untuk **Instagram Messaging** (DM). Meta memanggil URL ini tanpa JWT.

## Deploy (wajib tanpa JWT)

```bash
supabase functions deploy instagram-webhook --no-verify-jwt
```

Atau jika memakai `supabase/config.toml` yang sudah set `instagram-webhook.verify_jwt = false`:

```bash
supabase functions deploy instagram-webhook
```

**Penting:** Tanpa `verify_jwt = false`, Meta akan dapat 401 dan validasi webhook gagal ("The callback URL or verify token couldn't be validated").

## Meta Developer

- **Callback URL:** `https://<project-ref>.supabase.co/functions/v1/instagram-webhook`
- **Verify token:** Nilai dari halaman Connect Instagram (awalan `ig_`) atau dari akun Instagram yang sudah di-connect.
- Subscribe field **messages** agar DM masuk ke aplikasi.
