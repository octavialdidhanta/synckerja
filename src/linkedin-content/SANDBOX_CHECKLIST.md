# LinkedIn Sandbox — Internal Test Checklist

## Prerequisites

- [x] LinkedIn Developer App **Synckerja Content Insight** (`86ai8f4j1twr9q`) with **Community Management API** status **Added** (Development Tier).
- [x] Schema present: `organization_linkedin_content_*`, `linkedin_content_oauth_states`, `linkedin_content_pending_connections`, `granted_scopes` on accounts (migration `20260820120000_linkedin_threads_content_platform.sql` / equivalent applied).
- [x] Edge function `linkedin-content-api` deployed **ACTIVE** with `verify_jwt=false` (project `wqdzqqshoifwyrltzgvx`, v56+). Redeploy if needed: `npx supabase functions deploy linkedin-content-api --project-ref wqdzqqshoifwyrltzgvx --no-verify-jwt --use-api`
- [x] Secrets present for Content Insight (not Synckerja Office): `LINKEDIN_CONTENT_CLIENT_ID` (= `86ai8f4j1twr9q`), `LINKEDIN_CONTENT_CLIENT_SECRET`, plus `APP_PUBLIC_URL` / encryption key. Settings shows API-approval messaging rather than “server not configured”.
- [x] Redirect URL on LinkedIn Auth tab: `https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/linkedin-content-api`
- [x] Tester role: org **owner** (or omnichannel admin) in Synckerja + LinkedIn Page admin/content admin for the page to connect.

**Fase 0 gate ops: DONE.**
**Fase 1 Connect: DONE** (page `97448293` PT INTEGRASI VISUAL DIGITAL INDONESIA).
**Fase 2 Insights: DONE** (`linkedin-content-api` v60; scope `r_organization_social` added + reconnect).
**Fase 3 Comments read: DONE** (inbox loads; page has no posts in lookback — empty state clean; reply deferred to Fase 4).
**Fase 4 Reply: DONE** (`linkedin-content-api` v63; Rest.li `%28/%29` encoding for nested comment URNs; reply + View replies verified live).
**Fase 5 Publish: DONE** (`linkedin-content-publish` v43 multipart Videos API; `linkedin-content-api` v64 metrics merge for lagging finder).
**Fase 6 Multi-page: DONE** (`linkedin-content-api` v65; metrics merge scoped by `platform_account_open_id`).
**Fase 7 Report: DONE** (live QA §4; no code patch — pipeline already wired).
**Fase 8 Impressions: DONE** (`linkedin-content-api` v66; `organizationalEntityShareStatistics.impressionCount` → `view_count`; cache key `post-list-v2`).
**Fase 9 Authors: DONE** (`linkedin-content-api` v67; `hydrateLinkedInCommentAuthors` — owner page label + org lookup + person soft-fallback).

## 1. OAuth & settings (`/digital-marketing/social-media-performance/linkedin/settings`)

- [x] Connect LinkedIn page — no `invalid_scope_error`
- [x] Scope status cards green for Comments, Insights, Pages (scopes include `r_organization_social`, `r_organization_social_feed`, `w_organization_social_feed`, `w_organization_social`, `rw_organization_admin`)
- [x] `granted_scopes` saved on `organization_linkedin_content_accounts`

## 2. Performance (`/digital-marketing/social-media-performance/linkedin`)

- [x] Collapsible account nav shows connected page(s); multi-page switch validated in §6
- [x] Summary bar: **Followers** + posts metrics load together (no `partnerApiPostsExternal.FINDER-author` error; empty period OK)
- [x] Posts table + date range (“No posts for this period” when empty)
- [x] Skeleton → content without flicker on hard refresh
- [x] **Views** from organic impressions (`impressionCount`) — page A summary Views **36**, avg engagement **9.52%** (This month); page B empty

## 3. Manage Comments (`/manage-comments/linkedin`)

- [x] LinkedIn tab enabled in platform picker (`enabled: true`)
- [x] Post list + filters work (All / Unread / With comments / No comments); empty: “No posts found for this account” (no API error). Click-through deferred until page has posts.
- [x] Thread panel empty state clean (“Select a post”); wired for comments/replies when posts exist (`listComments` / `listReplies` + View replies UI)
- [x] Reply from app → appears on LinkedIn (**Fase 4**) — live: “Synckerja reply test” on share `7528037901234925568`
- [x] Nested replies load via View replies (`listReplies`) — shows page reply under parent comment
- [x] "Open on LinkedIn" wired via `permalink`/`share_url` on post list + thread header label
- [x] Author names hydrated (no raw URN / bare `User` for owner) — see §8

## 4. Report (`/digital-marketing/social-media-performance/report`)

- [x] LinkedIn audience not Hidden — shows `0 followers` (not Hidden) for both pages
- [x] Metrics load with other platforms — A: content 3 / comments 2; B: 0/0 (no bleed); filter LinkedIn OK
- [x] Target progress includes LinkedIn accounts — monthly Nov 2026 `comments` target page `97448293` → filter LinkedIn shows `2 / 3` (prorated); use **This month** (not All time) for progress bars
- [x] LinkedIn Views on Report — page A **36** views / 9.52% engagement; page B **0** (no bleed)

## 5. Publish (`linkedin-content-publish` + Social Media Publish Setup)

- [x] Edge `linkedin-content-publish` ACTIVE (`verify_jwt=false`); Publish scope `w_organization_social` granted
- [x] Reel plan eligible + service required platform LinkedIn mapped to page `97448293`
- [x] **Post Now** → `published` + `social_media_links` row (`urn:li:ugcPost:7528043429348548608`)
- [x] Video visible on LinkedIn Page feed
- [x] Performance posts table shows published ugcPost (read-after-write; merges Synckerja links when Posts finder lags)
- Note: carousel→LinkedIn done in §11; schedule-via-cron follow-up OK

## 6. Multi-page switch

- [x] ≥2 pages connected on one org: `97448293` PT INTEGRASI VISUAL DIGITAL INDONESIA + `97445669` Vialdi Wedding (tokens per `page_id`)
- [x] Performance nav A↔B: page B empty/clean; page A keeps 3 posts (no token/post bleed). Fix: metrics Synckerja-link merge filtered by `platform_account_open_id` (`linkedin-content-api` v65)
- [x] Manage Comments nav A↔B: page B “No posts found”; selection/`videoId` cleared on switch; page A posts restore
- [x] Set default → hard refresh Performance lands on default page; default restored to page A after test

## 7. Impressions → Views

- [x] `fetchShareImpressionCounts` via `/rest/organizationalEntityShareStatistics` (lifetime `impressionCount`)
- [x] Metrics merge stubs also get impressions; cache `post-list-v2`
- [x] Live QA Performance A/B + Report (see §2 / §4)

## 8. Author hydrate

- [x] Server hydrate via `supabase/functions/_shared/linkedinCommentAuthorHydrate.ts` after `listComments` / `listReplies`
- [x] Page owner reply → **PT INTEGRASI VISUAL DIGITAL INDONESIA** (account label)
- [x] Person comment → readable name or fallback **LinkedIn member** (not URN); People API may be limited on Development Tier
- [x] UI guard: strip `urn:li:*` display names in `LinkedInCommentItem`
- [x] Live QA share `7528037901234925568` + View replies

## 9. Persist last-selected page

- [x] Helper `linkedinContentLastPageId` (read/write/resolve per `organizationId`)
- [x] Performance + Manage Comments: init from stored active page; `onPageIdChange` writes storage
- [x] Live QA: switch B → refresh still B; switch A → refresh still A; invalid/missing stored → default A, no crash

## 10. Post Now page B

- [x] `upsertLinkedInLink` keyed by `platform_account_open_id` (no overwrite of other page’s link); `linkedin-content-publish` v44
- [x] Service required platform: LinkedIn A `97448293` + LinkedIn B `97445669` (Vialdi Wedding)
- [x] Post Now B on plan `5f3295d5-…` → `published` + link `urn:li:ugcPost:7528056539052544002` (`platform_account_open_id=97445669`)
- [x] Link A on same plan intact (`7528043429348548608`); Performance B shows 1 post after refresh; A still 3 posts

## 11. Carousel → LinkedIn

- [x] Eligibility carousel branch + `linkedinImagePublishApi` (Images API + single/`multiImage`)
- [x] Execute `linkedin_publish_path=carousel` before Reel/Drive; edge `mediaSource=carousel_images`; publish v45
- [x] UI: LinkedIn in carousel photo platforms; path-lock + lock tests updated
- [x] Live QA plan `6dbc3bd3-…` (8 images) → Post Now LinkedIn A → `published` + `urn:li:ugcPost:7528059086471499777`; Performance shows post

## 12. AI Content Plan Carousel → LinkedIn (Content Planner path)

Ops only — **no** Publish button on AI Employee UI (that remains Story → IG/FB only).

- [x] Flow: AI Employee SOP1 creates `social_media_plans` (Carousel/Post) → Canva fills `social_media_plan_carousel_images` → Content Planner **Social Media Publish Setup** → Post Now LinkedIn (`linkedin-content-publish` carousel path, §11)
- [x] Service map (sandbox org): **Synckerja Office** → LinkedIn A `97448293`; **Vialdi Wedding** → A+B; **etix** has carousel plans but **no** LinkedIn required platform (map before publishing etix carousels)
- [x] Live proof same as §11: Synckerja Office plan `6dbc3bd3-…` → `urn:li:ugcPost:7528059086471499777` via Content Planner (not AI Employee page)

**Stop sebelum backlog opsional** (polish i18n `View {{count}}` / People name; UI Publish di AI Employee = scope B, deferred).

## 13. Personal / member profile (Kaizen)

### Fase 0 — Product + identity (DONE) — stop sebelum schema/OAuth UI

**Portal (app Synckerja Content Insight `86ai8f4j1twr9q`, numeric `252270359`):**

- [x] **Share on LinkedIn** already **Added** (Default Tier) on the **same** app as **Community Management API** (Development Tier). No separate app required for `w_member_social` in this sandbox.
- [x] Auth tab lists scope **`w_member_social`** (“Create, modify, and delete posts… on your behalf”) plus org scopes; also `r_basicprofile`, `w_member_social_feed`, member analytics scopes.
- [x] **Sign In with LinkedIn using OpenID Connect** is still **Available** (not Added) on Content Insight. Sister app **Synckerja Office** (`86zj936vmv73rq`) already has OpenID Added but **not** Share on LinkedIn — keep member publish on **Content Insight** credentials (current `LINKEDIN_CONTENT_*` secrets).
- [x] Redirect already whitelisted: `https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/linkedin-content-api`
- Note: some public blogs say Community Management cannot coexist with other products; **this app already coexists** with Share on LinkedIn — treat coexistence as verified for Synckerja.

**API spike (outside Page production path):**

- [x] Confirmed member publish needs `author: urn:li:person:{id}` + `w_member_social` (Posts API); page path stays `urn:li:organization:{page_id}`.
- [x] Authorize URL smoke: `scope=w_member_social%20r_basicprofile` on Content Insight → LinkedIn accepted flow (**no** `invalid_scope_error`; consent/login stage reached with those scopes in the OAuth flow payload). Proves scopes are requestable on this app.
- [x] Member OAuth connect path (Fase 2): separate `connect_kind=person` → `/v2/me` → save `account_kind=person`. Live text `POST /rest/posts` as person remains **Fase 3**.

**Identity model (locked):**

- Extend `organization_linkedin_content_accounts` with **`account_kind`**: `organization` | `person` (default `organization` for existing rows).
- Keep **`page_id`** as the stable subject key string: for org = LinkedIn organization numeric id; for person = LinkedIn **person id** (not full URN). Store display URN helpers in code: `urn:li:organization:{page_id}` vs `urn:li:person:{page_id}` by kind.
- Tokens: continue one row per `(organization_id, page_id)` in `organization_linkedin_content_connection_tokens`, but **all resolvers must branch on `account_kind`** so person ids never hit org ACL/metrics/inbox APIs.
- `platform_account_open_id` / `service_required_platforms.platform_account_id` = same subject key (`page_id`); UI label distinguishes “Page” vs “Personal”.
- Do **not** reuse org `page_id` values for persons without `account_kind` (collision risk with cache + comments tables).

### Fase 1 — schema + scope map: DONE

- [x] Migration `account_kind` (`organization` | `person`, default `organization`) on `organization_linkedin_content_accounts`
- [x] Unique default **per kind**: `idx_organization_linkedin_content_accounts_one_default_per_kind` on `(organization_id, account_kind) WHERE is_default AND is_active`
- [x] Token table PK unchanged `(organization_id, page_id)`
- [x] `LINKEDIN_SCOPE_FEATURE_MAP.memberPublish` = `w_member_social` (server + client mirror)
- [x] Production `LINKEDIN_CONTENT_OAUTH_SCOPES_DEFAULT` / `oauthStart` scopes **unchanged** (org-only)
- [x] Settings `getSettings` + `LinkedInContentAccountRow` expose `account_kind`
- [x] Helper `buildLinkedInAuthorUrn(kind, subjectId)` in `linkedinContentApi.ts`

### Fase 2 — OAuth connect member: DONE

- [x] Migration `linkedin_content_oauth_states.connect_kind` (`organization` | `person`)
- [x] Member scopes `w_member_social r_basicprofile` via `linkedinContentMemberOAuthScopes()` (page default scopes unchanged)
- [x] `fetchLinkedInAuthenticatedMember` + callback branch for person (no page picker)
- [x] Save `account_kind=person`; `setDefaultAccount` / first-default scoped per kind
- [x] Settings “Connect personal profile” + Page/Personal badge
- [x] Person accounts filtered out of org performance nav / insights (scheduler includes person for publish)

### Fase 3 — publish as person: DONE

- [x] `resolveLinkedInPublishAccount` → kind + `buildLinkedInAuthorUrn` + `memberPublish` / `publish`
- [x] `createPlatformScheduleRow` stores `account_kind` + person/org author URN
- [x] Execute Reel + carousel use author URN by kind (org path unchanged when kind missing/`organization`)
- [x] Content Planner picker includes Personal with `memberPublish` scope check
- [x] `planAutoSchedule` LinkedIn readiness kind-aware

### Fase 4 — scheduling polish: DONE

- [x] Publish last-account memory (`linkedinContentLastPublishAccountId`) includes person
- [x] `ServiceRequiredPlatformsModal` LinkedIn preselect + write on select/save
- [x] `useConnectedPlatformAccounts` exposes kind/default/sort; Page before Personal
- [x] Kind-aware reconnect copy (`w_member_social` vs `w_organization_social`)

### Fase 5 — member insights: BLOCKED (scopes not grantable)

- [x] Backend ready: person `getMetrics` path + `spikeMemberInsights`; `linkedin-content-api` **v70+**
- [x] `memberInsights` feature map kept for status UI (`r_member_social`, `r_member_postAnalytics`)
- [x] **Authorize smoke FAIL:** requesting those insights scopes → LinkedIn `invalid_scope` on Content Insight. Member OAuth defaults reverted to `w_member_social` + `r_basicprofile` only (publish connect works).
- [x] Performance nav still gated on insights scopes (person hidden until LinkedIn allows them)
- [x] Comments + Report stay org-only

**Unblock (LinkedIn product):** Auth tab must accept member insights scopes without `invalid_scope`, then add them back to `LINKEDIN_CONTENT_MEMBER_OAUTH_SCOPES_DEFAULT`, reconnect personal, spike `spikeMemberInsights`.

### Kaizen rule (Fase 6+)

- Satu fase = satu concern; **stop** setelah fase selesai; verifikasi live sebelum lanjut.
- Jangan campur page-path dengan person-path kecuali step eksplisit bilang boleh.
- Jangan ubah Comments/Report ke person sampai LinkedIn product + spike lolos.
- Deploy edge hanya setelah fase yang menyentuh edge selesai + smoke lokal/production singkat.

### Fase 6 — Stabilisasi token Company Page: DONE

**Masalah:** Setelah connect personal, Company Page Performance bisa `Could not authenticate` (LinkedIn revoke token page sibling).

**Steps:**
- [x] Ops: reconnect Company Page PT INTEGRASI (token `15:24` UTC setelah personal `15:00`)
- [x] Verify Performance live: **4 posts / 78 views** (local + production)
- [x] Deploy `linkedin-content-api` **v77**: REAUTH + force-refresh + `token_updated_at` di getSettings
- [x] Smoke API: error mengarahkan reconnect (bukan raw `Could not authenticate` saja)
- [x] Catat: page token setelah person-connect fragile → reconnect page *setelah* personal
- [x] Restore `is_default` org untuk PT INTEGRASI
- [x] Settings banner saat page token lebih lama dari personal — verified localhost

**Done when:** Company Page load metrics OK setelah ops reconnect; pesan reauth ter-deploy.

### Fase 7 — UX Performance / Settings clarity (CODE DONE — verify on local/frontend deploy)

**Tujuan:** User paham kenapa Personal ada di Settings tapi tidak di sidebar Performance.

**Steps:**
- [x] Settings: note di kartu PERSONAL (publish-only / insights blocked)
- [x] Toast setelah connect personal: hint reconnect Company Page
- [x] Scope status cards: `memberInsights` blocked copy (bukan hanya daftar missing scopes)
- [x] i18n EN + ID
- [x] Gate Performance nav tetap (person tanpa insights scopes disembunyikan) — production frontend belum tentu deploy terbaru

**Done when:** Settings + Performance menjelaskan status personal tanpa user harus tanya lagi.

### Fase 8 — Default account + last-page memory harden (CODE DONE)

**Masalah:** Bisa ada `is_default=true` ganda lintas kind (org + person); last-page memory bisa mengarah ke person yang disembunyikan di nav.

**Steps:**
- [x] Audit/fix: PT INTEGRASI `is_default=true` (org); person tetap default kind-nya
- [x] `filterLinkedInPerformanceNavAccounts` + `resolveLinkedInContentInitialPageId` hanya pakai person jika insights scopes ada
- [x] Performance page memakai filter bersama (bukan logic duplikat)
- [x] Publish memory person tetap terpisah (`linkedinContentLastPublishAccountId`)

**Done when:** Performance selalu land di page yang valid; publish memory person tidak merusak Performance nav.

### Fase 9 — Unblock member insights: BLOCKED (residual) — LinkedIn product

**Status batch:** STOP di sini untuk insights. Backend + nav gate siap; Auth Content Insight masih `invalid_scope` untuk `r_member_social` / `r_member_postAnalytics`.

**Prasyarat produk LinkedIn (bukan code-first):**
- [ ] Portal Content Insight: Auth menerima member insights scopes tanpa `invalid_scope`
- [ ] Dokumentasikan scope final yang diterima LinkedIn

**Steps engineering (hanya setelah prasyarat):**
- [ ] Tambah scope ke member OAuth defaults
- [ ] Reconnect personal → `spikeMemberInsights` → buka Performance nav bila OK

**Done when:** Personal metrics live **atau** tetap BLOCKED dengan alasan produk tercatat. → **BLOCKED tercatat.**

### Fase 10 — Harden publish / schedule person vs page: DONE (hardening)

**Steps:**
- [x] Reconnect person tidak overwrite token page row lain (`organization_id,page_id` upsert)
- [x] Toast hint setelah connect personal: page mungkin perlu reconnect
- [x] Metrics REAUTH + force-refresh; publish/scheduler **v47/v69** remap `linkedin_reauth_required`
- [~] Live Post Now person/page tidak di-ulang di batch ini — page token hidup terbukti via metrics (token yang sama)

**Done when:** Auth fail mengarahkan reconnect yang tepat; page token sehat. → **DONE** (Post Now smoke opsional residual).

### Fase 11 — Comments + Report isolation: DONE

**Steps:**
- [x] Comments nav = org only (live: PT INTEGRASI saja, tidak ada OCTA)
- [x] Report LinkedIn accounts filter `account_kind !== person` (code + pages list org-only)
- [x] Jangan longgarkan isolation demi insights

### Fase 12 — Live QA + deploy brief: DONE

**Steps:**
- [x] Matrix QA: Page metrics OK (4/78) | Settings personal hint | Performance nav gate (PT only) | Comments/Report exclusion
- [x] Deploy brief (2026-11-16): api **v77**, publish **v47**, scheduler **v69**; frontend local gate/banner/CTA
- [x] Residual risk (explicit):
  - **Member insights BLOCKED** (Fase 9) sampai LinkedIn mengizinkan scope
  - **Page token revoke** setelah personal OAuth → reconnect page setelah personal
  - Production frontend mungkin belum punya banner/CTA sampai deploy UI
  - Live Post Now person/page tidak di-smoke ulang di batch ini
