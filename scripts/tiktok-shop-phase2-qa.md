# TikTok Shop Fase 2 — QA Checklist (Order Depth + Products Catalog)

Prasyarat Partner Center:

- [ ] Scope **Order information** (`seller.order.info`) enabled
- [ ] Scope **Product basic** (`seller.product.basic`) enabled in Manage API
- [ ] Sandbox seller re-authorized after scope changes (Settings → disconnect + Authorise app)
- [ ] Edge functions deployed: `tiktok-shop-metrics` (updated), `tiktok-shop-catalog` (new)
- [ ] Migrations applied:
  - `20260628130000_tiktok_shop_orders_cache.sql` (Fase 1)
  - `20260628140000_tiktok_shop_products_cache.sql` (Fase 2)

## Routing & tabs

- [ ] `/operations/sales/tiktok-shop` opens **Dashboard**
- [ ] `/operations/sales/tiktok-shop/products` opens **Products**
- [ ] `/operations/sales/tiktok-shop/settings` opens Settings
- [ ] Tab **Dashboard** | **Products** | **Settings** navigates correctly
- [ ] Products path is not treated as Dashboard (active tab highlights correctly)

## Loading & skeleton

- [ ] Hard refresh on dashboard shows layout-matched skeleton (guard + Suspense)
- [ ] Hard refresh on products shows `TikTokShopProductsPageSkeleton`
- [ ] Single skeleton layer during initial load (no double flash)
- [ ] Header/tabs scroll with content (header-in-scroll shell)

## Dashboard — period KPI

- [ ] KPI bar uses `getOrderPeriodSummary` (multi-page aggregation), not page-only summary
- [ ] GMV, order count, units sold match aggregated data for date range
- [ ] If `truncated === true`, footnote shows capped order count
- [ ] Refresh forces cache bypass for period summary + table

## Dashboard — order filters & table

- [ ] Status filter chips: All, Unpaid, Awaiting shipment, In transit, Completed, Cancelled, etc.
- [ ] Changing status filter resets pagination and reloads table
- [ ] Order row click opens detail drawer
- [ ] View column opens detail drawer
- [ ] Export CSV downloads current page with shop/date metadata

## Dashboard — order detail drawer

- [ ] Drawer shows overview: status, created, updated, GMV
- [ ] Line items: SKU, qty, price
- [ ] Recipient address and phone when available
- [ ] Payment breakdown: subtotal, shipping, tax, discount
- [ ] Tracking number when available
- [ ] Loading and error states handled

## Products page

- [ ] Shop nav (left column) matches dashboard behavior
- [ ] Product status filter chips work (All, Active, Draft, etc.)
- [ ] Table columns: product, status, SKU, price, stock
- [ ] Pagination Next/Previous when API returns `next_page_token`
- [ ] Empty state when sandbox has no products (not error)
- [ ] Refresh forces cache bypass

## Errors

- [ ] Missing `seller.order.info` scope → clear error + link to re-authorize
- [ ] Missing `seller.product.basic` scope → clear error + link to re-authorize
- [ ] `serverConfigured === false` → server alert (same as Settings)

## Non-admin

- [ ] User with page access can view dashboard and products when connected
- [ ] Settings mutations still admin-only

## Deploy commands (reference)

```bash
npx supabase functions deploy tiktok-shop-metrics --project-ref wqdzqqshoifwyrltzgvx
npx supabase functions deploy tiktok-shop-catalog --project-ref wqdzqqshoifwyrltzgvx
```

Apply migration manually if `db push` blocked by history drift.
