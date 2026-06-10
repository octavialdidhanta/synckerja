# Synckerja – YouTube Content Insight OAuth Verification (Production)

Panduan **Opsi B**: publish OAuth app agar **semua customer Synckerja** bisa connect YouTube tanpa batas 100 test user.

| | |
|---|---|
| **Product** | Synckerja |
| **App URL** | https://office.synckerja.com |
| **Privacy Policy** | https://office.synckerja.com/policy/privacy |
| **Terms of Service** | https://office.synckerja.com/policy/terms |
| **Support email** | business@vialdi.id |
| **OAuth client name** | Synkerja YouTube Content Insight |
| **Redirect URI** | `https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/youtube-content-oauth-callback` |
| **Scopes** | `https://www.googleapis.com/auth/youtube.readonly`, `https://www.googleapis.com/auth/yt-analytics.readonly` |

> Export bagian **Scope justification** dan **Demo script** ke PDF jika Google meminta lampiran.  
> Referensi format: [`docs/google-ads-api-design-document.md`](./google-ads-api-design-document.md)

---

## 1. Checklist sebelum submit

- [ ] Connect YouTube sudah berhasil di production (sudah ✓)
- [ ] Privacy Policy & Terms publik dan bisa dibuka tanpa login
- [ ] Privacy Policy menyebut integrasi YouTube / Google API Limited Use (deploy terbaru)
- [ ] Domain `synckerja.com` terverifikasi di Google Search Console (untuk Authorized domains)
- [ ] Logo app (min. 120×120 px) siap untuk consent screen
- [ ] Video demo 2–3 menit direkam (lihat §5)
- [ ] Test user dihapus dari daftar setelah publish (opsional, setelah approved)

---

## 2. Google Cloud Console — OAuth consent screen

Buka: [Google Cloud Console](https://console.cloud.google.com/) → project Synckerja → **APIs & Services** → **OAuth consent screen**.

### User type

Pilih **External** (customer di luar organisasi Google Workspace Anda).

### App information

| Field | Nilai |
|-------|--------|
| App name | `Synckerja` atau `Synckerja YouTube Content Insight` |
| User support email | `business@vialdi.id` |
| App logo | Logo Synckerja (PNG/JPG) |
| Application home page | `https://office.synckerja.com` |
| Application privacy policy link | `https://office.synckerja.com/policy/privacy` |
| Application terms of service link | `https://office.synckerja.com/policy/terms` |
| Authorized domains | `synckerja.com` |

**Catatan Authorized domains:** Verifikasi kepemilikan domain di [Google Search Console](https://search.google.com/search-console) → **Settings** → **Ownership verification**. Tambahkan `synckerja.com` (bukan `supabase.co`). Redirect OAuth tetap di Supabase — itu normal.

### Developer contact

`business@vialdi.id` (dan email pribadi Anda jika perlu notifikasi review).

### Scopes

Pastikan hanya scope ini yang aktif (hapus scope lain yang tidak dipakai fitur ini):

```
https://www.googleapis.com/auth/youtube.readonly
https://www.googleapis.com/auth/yt-analytics.readonly
```

Klik **Add or remove scopes** → filter "YouTube" → centang kedua scope di atas → **Update**.

### APIs yang harus tetap enabled

- YouTube Data API v3
- YouTube Analytics API

---

## 3. Credentials — jangan ubah yang sudah jalan

**APIs & Services** → **Credentials** → OAuth client `Synkerja YouTube Content Insight`:

| Item | Nilai |
|------|--------|
| Application type | Web application |
| Authorized redirect URIs | `https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/youtube-content-oauth-callback` |

Jangan hapus redirect URI yang sudah dipakai production.

---

## 4. Teks untuk form verifikasi (copy-paste EN)

### Scope justification — `youtube.readonly`

```
Synckerja is a multi-tenant B2B operations platform (https://office.synckerja.com). Organization administrators connect a YouTube channel via OAuth only when they click "Connect YouTube channel" in Digital Marketing → Social Media Performance → YouTube settings.

We use https://www.googleapis.com/auth/youtube.readonly to:
(1) Identify the YouTube channel(s) the connecting Google account can manage;
(2) List public videos on that channel and read video metadata (title, thumbnail, publish date, video ID);
(3) Read aggregate engagement counts shown in the YouTube Data API (views, likes, comments) for those videos inside Synckerja's organic content performance dashboard.

Tokens are stored encrypted server-side (Supabase Edge Functions). End users never see refresh tokens. We do not upload, edit, or delete YouTube content. We do not sell or share YouTube data with third parties for advertising profiles.
```

### Scope justification — `yt-analytics.readonly`

```
We use https://www.googleapis.com/auth/yt-analytics.readonly to read channel/video analytics metrics (e.g. views over a date range) that supplement the YouTube Data API for the same connected channel. Data is displayed only to authenticated members of the organization that connected the channel, for internal marketing performance reporting.

This scope is used solely for user-facing reporting inside Synckerja. We do not use YouTube or Google user data to train AI/ML models. Our use adheres to the Google API Services User Data Policy, including Limited Use requirements.
```

### How does your app use Google user data? (short)

```
Optional OAuth: admins connect YouTube to view organic video performance (views, likes, comments, engagement rate) for their own channels. Data is shown in-app only to their organization. Users can disconnect at any time, which revokes our use of stored tokens for that organization.
```

### Why do you need these scopes?

```
There is no narrower OAuth scope that provides read-only access to channel-owned video lists and analytics for a third-party reporting dashboard. youtube.readonly and yt-analytics.readonly are the minimum read-only scopes required for our Social Media Performance feature.
```

---

## 5. Script video demo (2–3 menit)

Rekam layar **tanpa** menampilkan client secret atau Supabase service role key.

| Step | Tampilkan di video |
|------|-------------------|
| 1 | Buka `https://office.synckerja.com` → login |
| 2 | Navigasi: **Digital Marketing** → **Social Media Performance** → tab **YouTube** |
| 3 | Klik **Connect YouTube channel** (atau buka `/digital-marketing/social-media-performance/youtube/settings`) |
| 4 | Layar **Google OAuth consent** — scope `View your YouTube account` / analytics read-only terlihat |
| 5 | Pilih akun Google yang punya channel → **Allow** |
| 6 | Redirect kembali ke Synckerja → toast sukses / channel muncul di sidebar |
| 7 | Dashboard: summary (Videos, Views, Likes) + tabel video dengan link `youtube.com/watch?v=` |
| 8 | (Opsional) Pilih rentang tanggal / refresh |
| 9 | **Disconnect** atau tunjukkan di Settings bahwa user bisa putuskan koneksi |

Upload ke YouTube (unlisted) atau Google Drive (Anyone with link) dan paste URL di form verifikasi.

---

## 6. Submit for verification

1. Di **OAuth consent screen**, pastikan semua field §2 terisi.
2. Klik **Publish app** → **Prepare for verification** / **Submit for verification**.
3. Isi questionnaire:
   - **App type:** Web application
   - **Data access:** Explain using text §4
   - **Demo video:** URL dari §5
   - **Privacy policy:** `https://office.synckerja.com/policy/privacy`
4. Submit dan pantau email dari `business@vialdi.id` (biasanya balasan dalam beberapa hari–2 minggu).

### Jika Google meminta klarifikasi

Balas singkat (template):

```
Hello Google OAuth Verification Team,

Thank you for reviewing Synckerja's YouTube Content Insight integration.

We confirm:
- OAuth is optional and initiated only by organization admins via "Connect YouTube channel".
- We request read-only YouTube scopes only for organic performance reporting inside our app.
- We do not sell user data or use Google/YouTube data for generalized AI training.
- Users can disconnect YouTube in settings; stored tokens are deactivated for that organization.

Please find our updated privacy policy at https://office.synckerja.com/policy/privacy (Google API Limited Use section).

Best regards,
[Name]
Synckerja / vialdi.id
business@vialdi.id
```

---

## 7. Setelah disetujui

| Sebelum (Testing) | Sesudah (Production) |
|-------------------|----------------------|
| Maks. ~100 test users | Semua user Google bisa connect |
| Warning "App isn't verified" | Warning hilang atau berkurang |
| Harus tambah email di Test users | Tidak perlu daftar test user |

**Maintenance:**

- Pantau **YouTube Data API quota** (APIs & Services → Dashboard). Naikkan quota jika banyak tenant.
- Rotasi `YOUTUBE_CONTENT_CLIENT_SECRET` hanya jika bocor; update secret di Supabase Edge Functions.
- Jangan nonaktifkan YouTube Data API v3 / YouTube Analytics API.

---

## 8. Arsitektur (untuk jawaban teknis jika ditanya)

```
[Org admin] → Connect YouTube channel
              ↓ youtube-content-oauth-start (PKCE) → Google consent
              ↓ youtube-content-oauth-callback → encrypted refresh token per org

[Org member] → Social Media Performance / YouTube
              ↓ youtube-content-metrics (cached 15 min)
              ↓ YouTube Data API + YouTube Analytics API (read-only)
```

| Secret (Supabase Edge only) | Purpose |
|-----------------------------|---------|
| `YOUTUBE_CONTENT_CLIENT_ID` | OAuth web client |
| `YOUTUBE_CONTENT_CLIENT_SECRET` | OAuth web client |
| `YOUTUBE_CONTENT_CONFIG_ENCRYPTION_KEY` | Encrypt per-org refresh tokens |
| `APP_PUBLIC_URL` | Post-OAuth redirect ke `office.synckerja.com` |

Implementasi: `supabase/functions/youtube-content-*`, UI `src/youtube-content/`, halaman `src/6-0-social-media-performance/pages/YouTubeContentPerformancePage.tsx`.
