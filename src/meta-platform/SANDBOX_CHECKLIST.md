# Meta Sandbox — Internal Test Checklist

## Prerequisites

1. Meta App in **Development** mode with test users as Page/IG admins.
2. Run migration `20260819120000_meta_content_platform.sql`.
3. Deploy edge functions: `meta-oauth-exchange`, `meta-content-config`, `meta-content-comments`, `meta-content-metrics`.
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
