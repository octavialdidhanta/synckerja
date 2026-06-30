# instagram-webhook

Webhook untuk **Instagram Messaging** (DM) dan **Instagram Comments** (real-time inbox). Meta memanggil URL ini tanpa JWT.

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
- **Subscribed fields (via OAuth / Subscribe webhooks):** `messages`, `messaging_postbacks`, `message_reads`, `comments`
  - DM masuk ke livechat dengan field `messages`.
  - Komentar baru di post/reel IG masuk ke Manage Comments inbox dengan field `comments`.

## Re-subscribe akun yang sudah terhubung

Setelah deploy, akun existing perlu re-subscribe sekali agar field `comments` aktif:

1. **Connect Instagram** → tombol subscribe webhooks, atau
2. Reconnect OAuth Facebook/Instagram.

Verifikasi: response `instagram-subscribe-webhooks` harus memuat `comments` di `subscribedFields`.

## Tes comment webhook

1. Pastikan `instagram_manage_comments` granted dan Page webhook subscribed dengan `comments`.
2. Komentar pada post IG Business dari akun tester (bukan akun bisnis sendiri).
3. Cek edge logs: `comments webhook received`, `commentProcessedCount >= 1`.
4. Cek DB: baris baru di `meta_manage_comments_inbound_comments`.
5. Buka `/digital-marketing/social-media-performance/manage-comments/instagram` — post ter-highlight dalam ~5s.

Contoh payload (ringkas):

```json
{
  "object": "instagram",
  "entry": [{
    "id": "<INSTAGRAM_BUSINESS_ACCOUNT_ID>",
    "changes": [{
      "field": "comments",
      "value": {
        "id": "<COMMENT_ID>",
        "text": "PDF",
        "from": { "id": "<IGSID>", "username": "user" },
        "media": { "id": "<MEDIA_ID>" }
      }
    }]
  }]
}
```
