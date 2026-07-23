# Synckerja – TikTok Content OAuth & Direct Post (Production Go-Live)

Runbook untuk app **developers.tiktok.com → Synckerja Office** (Login Kit + Content Posting API) agar scope production live dan posting **Public / Followers** berfungsi end-to-end.

| | |
|---|---|
| **Product** | Synckerja Office |
| **App URL** | https://office.synckerja.com |
| **Privacy Policy** | https://synckerja.com/policy/privacy (atau `https://office.synckerja.com/policy/privacy` jika tersedia) |
| **Terms of Service** | https://synckerja.com/policy/terms |
| **Support email** | business@vialdi.id |
| **developers app** | Synckerja Office (Login Kit / Direct Post) |
| **business-api app** | Synkerja Content Insight (organic insights + comments) |
| **Redirect URI** | `https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/tiktok-content-oauth-callback` |

> Dual-app model: **business-api** untuk Connect (insights/comments); **developers** untuk “Authorize publishing” (video.upload / video.publish).  
> Referensi format: [`docs/youtube-content-oauth-verification.md`](./youtube-content-oauth-verification.md), [`docs/meta-content-publish-app-review.md`](./meta-content-publish-app-review.md)

---

## 1. Architecture (dua app)

```
[Org admin] → Connect TikTok account
              ↓ tiktok-content-oauth-start (oauth_purpose=full)
              ↓ business-api Synkerja Content Insight (tt_user)
              ↓ tiktok-content-oauth-callback → encrypted tokens

[Org admin] → Authorize publishing (per account)
              ↓ tiktok-content-oauth-start (oauth_purpose=publish)
              ↓ developers Synckerja Office (Login Kit)
              ↓ publish_access_token_enc + video.upload,video.publish

[Schedule / Post Now]
              ↓ tiktok-content-publish → social-media-scheduler
              ↓ FILE_UPLOAD Direct Post (open.tiktokapis.com)
```

| Scope | App portal | OAuth step | Used for |
|-------|------------|------------|----------|
| `user.info.basic` | Both | Connect + Publish | Username / avatar |
| `user.info.stats` | business-api | Connect | Follower / likes summary |
| `video.list` | business-api | Connect | Performance video list |
| `video.upload` | developers | Authorize publishing | Chunked video upload |
| `video.publish` | developers | Authorize publishing | Direct Post |
| `comment.list` / `comment.list.manage` | business-api | Connect | Manage Comments (bukan di portal developers) |

**Known App IDs (diagnostics):**

| Slot | Env | Expected app |
|------|-----|--------------|
| CONTENT | `TIKTOK_CONTENT_CLIENT_KEY` | business-api Synkerja Content Insight `7649637336472354817` |
| PUBLISH | `TIKTOK_CONTENT_PUBLISH_CLIENT_KEY` | developers Synckerja Office (Client key dari Credentials; portal App ID `7654513562417039368`) |
| ADS | `TIKTOK_ADS_CLIENT_KEY` | business-api Synkerja Office (Ads) `7649636462582366225` |

---

## 2. Checklist sebelum submit App Review

### Portal developers.tiktok.com — Synckerja Office

- [ ] Status **Live**
- [ ] Login Kit + Content Posting API enabled
- [ ] Redirect URI exact: `https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/tiktok-content-oauth-callback`
- [ ] Scopes: `user.info.basic`, `user.info.stats`, `video.list`, `video.upload`, `video.publish`
- [ ] Direct Post toggle **ON** → klik **Apply** (audit terpisah dari App Review)
- [ ] Privacy Policy & Terms publik tanpa login
- [ ] Demo video domain = `office.synckerja.com`
- [ ] App Review explanation mencakup **semua** scope (lihat §4)

### Portal business-api.tiktok.com — Synkerja Content Insight

- [ ] App approved / live
- [ ] Redirect URI **sama** dengan callback di atas
- [ ] Organic + comment scopes approved

### Supabase Edge secrets

| Secret | Required | Notes |
|--------|----------|-------|
| `TIKTOK_CONTENT_CLIENT_KEY` / `SECRET` | Yes | business-api Content Insight |
| `TIKTOK_CONTENT_PUBLISH_CLIENT_KEY` / `SECRET` | Yes | developers Client key/secret |
| `TIKTOK_CONTENT_CONFIG_ENCRYPTION_KEY` | Yes | 32-byte base64 atau 64-char hex |
| `APP_PUBLIC_URL` | Yes | `https://office.synckerja.com` |
| `SCHEDULED_POSTS_INTERNAL_SECRET` | Yes | Cron + internal execute |
| `SCHEDULER_PUBLISH_DRY_RUN` | Off | Unset atau `false` untuk publish nyata |
| `TIKTOK_CREDENTIAL_DIAGNOSTICS_ENABLED` | Optional | `true` sementara untuk admin self-check |

**Production verification (2026-07-20):** DB shows active TikTok content connection + publish token row → CONTENT and PUBLISH OAuth secrets are configured and working. Confirm `APP_PUBLIC_URL` and `SCHEDULER_PUBLISH_DRY_RUN` in Dashboard → Edge Functions → Secrets. Cron `social-media-scheduler` (`*/1 * * * *`) is active.

**Self-check UI:** Settings panel credential card (when diagnostics enabled) should summarize:  
`OK: CONTENT (business) + PUBLISH (developers) + ADS (Synkerja Office).`

---

## 3. Direct Post audit vs App Review

| Gate | Where | Unlocks |
|------|-------|---------|
| **App Review** | Tab App review + demo video | Production scopes for Login Kit / Content Posting |
| **Direct Post audit** | Products → Content Posting API → **Apply** | Public / Followers posting (lifts `unaudited_client_can_only_post_to_private_accounts`) |

Until Direct Post audit is approved, API only allows **SELF_ONLY** (Only me) on eligible private accounts.

Domain **Verify** for `PULL_FROM_URL` is **not required** for current production path (Google Drive → **FILE_UPLOAD**).

---

## 4. App Review explanation (copy-paste, ≤1000 chars)

```
Synckerja Office (https://office.synckerja.com) helps marketing teams plan, approve, and publish TikTok videos from an internal content calendar.

user.info.basic — Show connected TikTok username/avatar after OAuth in Digital Marketing > Social Media Performance > TikTok Settings.

user.info.stats — Display follower/following/likes/video counts on the TikTok performance dashboard summary bar.

video.list — List the creator's public videos with views/likes/comments for performance reporting and plan matching.

video.upload + video.publish — After org admin clicks "Authorize publishing" (separate Login Kit step), upload video from Google Drive and Direct Post to the creator profile via Schedule or Post Now on approved content plans.

OAuth redirect: Supabase edge function callback. Only org admins can connect accounts.
```

---

## 5. Demo video script (2–4 menit)

Rekam di **`https://office.synckerja.com`**. Jangan tampilkan Client secret.

| Step | Tampilkan |
|------|-----------|
| 1 | Login → Digital Marketing |
| 2 | Social Media Performance → TikTok → **Settings** |
| 3 | **Connect TikTok account** → consent → username/avatar (`user.info.basic`) |
| 4 | Performance dashboard: stats bar + video list (`user.info.stats`, `video.list`) |
| 5 | Settings → **Authorize publishing** → Login Kit consent (`video.upload`, `video.publish`) |
| 6 | Content plan (approved + Drive video) → **Post Now** or **Schedule** |
| 7 | Show published result / schedule status |
| 8 | (Opsional) Manage Comments inbox |

Accepted: mp4/mov, max 50MB. Domain in video must match website URL used in App details.

---

## 6. Deploy edge functions

```bash
npm run supabase:functions:deploy:tiktok-content-all
npm run supabase:functions:deploy:social-media-scheduler
```

`tiktok-content-all` includes OAuth + config + metrics + comments + **publish**.  
`social-media-scheduler` deploys the cron worker (+ shim).

Scheduler migrations (if not yet applied): see [`supabase/functions/social-media-scheduler/README.md`](../supabase/functions/social-media-scheduler/README.md).

---

## 7. Setelah App Review + Direct Post audit approved

1. Set `SCHEDULER_PUBLISH_DRY_RUN` off (atau unset).
2. Setiap org admin: **Disconnect** → **Connect** → **Authorize publishing** (token lama tidak otomatis dapat scope baru).
3. Smoke test **Post Now** dengan visibility **PUBLIC_TO_EVERYONE** atau **FOLLOWER_OF_CREATOR** (opsi dari `creator_info`).
4. Smoke test **Schedule** → cron publish dalam ~1 menit.
5. Verifikasi metrics sync setelah publish.
6. Matikan `TIKTOK_CREDENTIAL_DIAGNOSTICS_ENABLED` jika hanya untuk debugging.

### Monitoring

```sql
SELECT public.get_social_media_schedule_monitoring_summary();

SELECT platform, status, count(*)
FROM social_media_scheduled_posts
WHERE created_at > now() - interval '24 hours'
  AND platform = 'TikTok'
GROUP BY 1, 2
ORDER BY 1, 2;
```

### Pre-approval (sandbox) smoke

- Connect + Authorize publishing OK
- Post Now dengan **SELF_ONLY** sukses
- Tidak expect public posting sampai Direct Post audit lolos

---

## 8. Rollback

Flip `scheduleReady: false` for TikTok in `src/6-1-scheduled-posts/types/platform-delivery.ts` and redeploy frontend only.

Atau set `SCHEDULER_PUBLISH_DRY_RUN=true` di Edge secrets (semua platform scheduler).

---

## 9. Implementasi di repo

| Area | Path |
|------|------|
| Scopes / redirect | `supabase/functions/_shared/tiktokContentAuth.ts` |
| OAuth start/callback | `supabase/functions/tiktok-content-oauth-*` |
| Publish API | `supabase/functions/_shared/tiktokContent/tiktokContentPublishApi.ts` |
| Scheduler executor | `supabase/functions/_shared/scheduledPosts/executeTikTokScheduledPost.ts` |
| Settings UI | `src/tiktok-content/settings/TikTokContentSettingsPanel.tsx` |
| Credential diagnostics | `supabase/functions/_shared/tiktokCredentialDiagnostics.ts` |
