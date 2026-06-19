# Threads Sandbox — Internal Test Checklist

## Prerequisites

1. Meta App with **Threads API** product enabled.
2. Run migration `20260820120000_linkedin_threads_content_platform.sql`.
3. Deploy: `npm run supabase:functions:deploy:threads-content-all` (includes `meta-threads-oauth-exchange`)
4. Secrets: `THREADS_APP_ID`, `THREADS_APP_SECRET`, `THREADS_CONTENT_CONFIG_ENCRYPTION_KEY` (or `META_ADS_CONFIG_ENCRYPTION_KEY`). Keep `META_APP_ID` / `META_APP_SECRET` for the Facebook/Instagram app.
5. Frontend env: `VITE_THREADS_APP_ID` (Threads API app) and `VITE_META_APP_ID` (Facebook/Instagram app).
6. **Valid OAuth Redirect URI** (Threads use case): `https://office.synckerja.com/auth/threads/callback` (HTTPS required; localhost not supported)
7. Development mode test user as Threads profile admin

## 1. OAuth (`/omnichannel/integrations/instagram`)

**Two steps** — Threads scopes are **not** Facebook Login permissions:

1. **Connect with Facebook** — IG/FB scopes only (no Invalid Scopes warning).
2. **Connect Threads (sandbox)** — separate dialog at `threads.net` with:
   `threads_basic`, `threads_manage_insights`, `threads_read_replies`, `threads_manage_replies`

- [ ] Facebook connect succeeds without Invalid Scopes error
- [ ] **Connect Threads** button appears after IG is connected
- [ ] Threads authorize completes; scope cards: Threads Insights + Threads Replies show green
- [ ] `threads_user_id`, `has_threads=true` on `organization_instagram_accounts`

## 2. Performance (`/digital-marketing/social-media-performance/threads`)

- [ ] Threads tab enabled (not Coming soon)
- [ ] Account nav shows Threads profile
- [ ] Summary: followers, posts, views, engagement
- [ ] Posts table populated for date range

## 3. Manage Comments (`/manage-comments/threads`)

- [ ] Threads tab enabled
- [ ] Layout 3-column (accounts | posts | thread) matches TikTok/Meta
- [ ] Reply from app → appears on Threads
- [ ] "Open on Threads" link works

## 4. Report

- [ ] Threads in platform breakdown chart
- [ ] Audience not Hidden
- [ ] Target progress includes Threads accounts

## 5. Edge cases

- [ ] IG connected without Threads scopes → reconnect CTA on performance/comments
- [ ] Hard refresh direct URL → consistent skeleton, no tab flash
