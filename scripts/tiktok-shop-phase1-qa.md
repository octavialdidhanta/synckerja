# TikTok Shop Fase 1 — QA Checklist (Dashboard Orders & GMV)

Prasyarat Partner Center:

- [ ] Scope **Order information** (`seller.order.info`) enabled in Manage API
- [ ] Sandbox seller re-authorized after scope change (Settings → disconnect + Authorise app)
- [ ] Edge functions deployed: `tiktok-shop-metrics` (+ redeploy oauth if token expiry fix)
- [ ] Migration applied: `20260628130000_tiktok_shop_orders_cache.sql`

## Routing & tabs

- [ ] `/operations/sales/tiktok-shop` opens **Dashboard** (not redirect to Settings)
- [ ] `/operations/sales/tiktok-shop/settings` opens Settings
- [ ] Tab **Dashboard** navigates to dashboard (no “coming soon” toast)
- [ ] Tab **Settings** navigates to settings
- [ ] Legacy `/digital-marketing/tiktok-shop` redirects to dashboard

## Loading & skeleton

- [ ] Hard refresh on dashboard shows layout-matched skeleton (guard + Suspense)
- [ ] Single skeleton layer during initial load (no double flash)
- [ ] Header/tabs scroll with content (header-in-scroll shell)

## Empty states

- [ ] Not connected → CTA to Settings (“Connect seller”)
- [ ] Connected but no shops → “Sync shops” CTA / empty shop nav
- [ ] `serverConfigured === false` → server alert (same as Settings)
- [ ] Connected + shops but no orders in range → table empty state (not error)

## Dashboard data

- [ ] Default shop = org default shop from Settings
- [ ] Shop switch updates KPI + table
- [ ] Date range default last 30 days; clamp max 365 days
- [ ] KPI cards: GMV, order count, units sold
- [ ] Orders table: order ID, status, created, units, GMV
- [ ] Pagination Next/Previous when API returns `next_page_token`
- [ ] Refresh button forces cache bypass and reloads data

## Errors

- [ ] Missing `seller.order.info` scope → clear error + link to re-authorize in Settings
- [ ] Token expired → refresh path works (access_token_expire_in absolute unix fix)

## Non-admin

- [ ] User with page access but not omnichannel admin can view dashboard when connected
- [ ] Settings mutations still admin-only

## Sandbox notes

- Sandbox may have zero orders → verify empty state, not 500
- Optional: Partner Center Test functions to generate sample orders

## Deploy commands (reference)

```bash
supabase functions deploy tiktok-shop-metrics --project-ref wqdzqqshoifwyrltzgvx
supabase functions deploy tiktok-shop-oauth-callback --project-ref wqdzqqshoifwyrltzgvx
```

Apply migration manually if `db push` blocked by history drift.
