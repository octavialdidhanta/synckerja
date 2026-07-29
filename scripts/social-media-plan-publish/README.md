# social-media-plan-publish — acceptance checklist

Orchestrator edge function for bulk **Post now** (`post_now_bulk`). Google Drive remains SSOT; one Drive download per plan job when preload is needed.

## Deploy

```powershell
cd "D:\Synckerja Office - 11 Juni 2026\synckerja"
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."

# Full publish bundle (orchestrator + per-platform publish + schedulers)
npm run supabase:functions:deploy:social-media-publish-bundle
```

Post-deploy checks (Supabase Dashboard → Edge Functions):

- `social-media-plan-publish`: `wall_clock_duration` = **400** (from `supabase/config.toml`)
- Optional secrets: `TIKTOK_PULL_FROM_URL_ENABLED` (default on), `PLAN_PUBLISH_SEQUENTIAL` (default off)

## Manual tests

| Test | Expected |
|------|----------|
| Mobile share → Save video → **Post now all** (YouTube + TikTok) | One `plan_bulk_publish download_ok` per plan in logs |
| Desktop plan → **Post now to all** | Same single download in orchestrator logs |
| Post now **YouTube only** (one row) | Via `youtube-content-publish`, not orchestrator |
| Scheduler tick on pending row | `social-media-scheduler` still publishes |
| TikTok resume (`tiktok_publish_id` + upload done) | Poll-only path, no re-upload |
| Change Drive link mid-publish | Schedule fails with `google_drive_link_changed` |

## Log filters

In Supabase function logs, search:

- `plan_bulk_publish` — orchestrator job (`download_ok`, `complete` with `download_ms`, `tiktok_path`, `results`)
- `tiktok_publish_path` — per-schedule TikTok path (`pull` or `file_upload`)

Example complete line:

```
plan_bulk_publish complete planId=... platforms=YouTube,TikTok download_ms=... tiktok_path=file_upload results=YouTube:ok,TikTok:ok
```

## TikTok PULL_FROM_URL (optional)

Until domain is verified in TikTok Developer Portal, expect `tiktok_path=file_upload` with bytes from orchestrator preload (no second Drive download). After verify, TikTok-only or bulk may log `tiktok_path=pull`.
