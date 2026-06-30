# Meta Sandbox — Internal Test Checklist

## Prerequisites

1. Meta App in **Development** mode with test users as Page/IG admins.
2. Run migration `20260819120000_meta_content_platform.sql`.
3. Deploy edge functions: `meta-oauth-exchange`, `meta-content-config`, `meta-content-comments`, `meta-content-metrics`, `instagram-webhook` (with `verify_jwt = false`).
4. Set `META_GRAPH_API_VERSION=v22.0` (optional, default v22).

## 1. OAuth reconnect (`/omnichannel/integrations/instagram`)

- [ ] Click **Connect with Facebook** — grant all scopes including comments, insights, messaging.
- [ ] Scope status cards show green for DM, Comments, Insights, Pages.
- [ ] `granted_scopes` saved on `organization_instagram_accounts`.

## 2. Comments sandbox (`instagram_manage_comments`)

- [ ] Post on connected IG Business account.
- [ ] Open `/digital-marketing/social-media-performance/manage-comments/instagram`.
- [ ] Sync posts → select post → comments load.
- [ ] Reply from app → verify on Instagram.

## 3. Insights sandbox (`instagram_manage_insights`)

- [ ] Open `/digital-marketing/social-media-performance/instagram`.
- [ ] Reach / Impressions cards populate (7-day default).
- [ ] Per-post table shows media metrics.

## 4. Facebook parity

- [ ] FB-only Page syncs to `organization_facebook_pages`.
- [ ] `/manage-comments/facebook` and `/social-media-performance/facebook` work.

## 5. Meta Ads (`ads_read`) — separate OAuth

- [ ] Connect at `/digital-marketing/meta-ads/settings`.
- [ ] Campaign spend loads on `/digital-marketing/meta-ads`.

## 6. Leads offline conversion (`fbclid`)

- [ ] Lead with `fbclid` → status **Converted**.
- [ ] `meta-ads-upload-conversion` invoked (check leads Meta sync cell / edge logs).
- [ ] Requires Meta Ads connected + Pixel/CAPI configured.

## 7. Live Chat (existing)

- [ ] DM to IG Business appears at `/omnichannel/livechat`.

## 8. Instagram comment webhook (`comments` field)

**Prerequisites:** Reconnect OAuth or click **Subscribe webhooks** on Connect Instagram so `subscribed_fields` includes `comments` (not only `messages`).

- [ ] `instagram-subscribe-webhooks` response shows `comments` in `subscribedFields`.
- [ ] Comment on IG Business post from a **tester account** (not the business account itself).
- [ ] Edge logs: `comments webhook received`, POST response `commentProcessedCount >= 1`.
- [ ] DB: new row in `meta_manage_comments_inbound_comments` for `(platform=instagram, media_id, comment_id)`.
- [ ] Open `/digital-marketing/social-media-performance/manage-comments/instagram` — post sidebar highlight within ~5s without full page refresh.
- [ ] Open post thread — new comment row highlighted (amber); highlight clears after engage/dismiss.
- [ ] **Regression:** DM to IG Business still appears at `/omnichannel/livechat`.
- [ ] **Negative:** Comment from business account itself → no inbound row / no highlight.
