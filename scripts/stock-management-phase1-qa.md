# Stock Management Phase 0 + 1 — QA Checklist

## Prasyarat

- [ ] Migrations applied:
  - `20260628150000_inventory_stock_management_core.sql`
  - `20260628150100_inventory_stock_realtime.sql`
  - `20260628150200_stock_management_page_permission.sql`
- [ ] Edge function deployed: **`stock-management-api`** (includes sync worker + order ingest actions)
- [ ] TikTok Shop connected (Settings) + product write/inventory scope di Partner Center
- [ ] Re-authorize seller setelah scope inventory write aktif

## Routing & sidebar

- [ ] `/operations/sales/stock-management` — Inventory tab
- [ ] `/operations/sales/stock-management/mapping` — Platform mapping
- [ ] `/operations/sales/stock-management/sync-logs` — Sync logs
- [ ] Sidebar Operations → **Stock Management** visible
- [ ] Skeleton on hard refresh (guard + Suspense)

## Phase 0 — CRUD tanpa marketplace

- [ ] Add SKU: internal SKU `SUSU-1L`, initial qty **1000**
- [ ] Dashboard menampilkan available **1000**
- [ ] Restock +700 → available **1700** (or 1000 if started from 300 scenario)
- [ ] Adjust -200 → available berkurang, movement tercatat
- [ ] Offline sale 50 → available berkurang 50
- [ ] Import CSV (prompt) — minimal 2 SKU
- [ ] Stok negatif ditolak (adjust/sale melebihi available)
- [ ] Non-admin bisa lihat; owner/admin bisa mutate

## Phase 1 — TikTok mapping & sync

- [ ] Platform mapping: link internal SKU ↔ TikTok `seller_sku`, `platform_product_id`, `platform_sku_id`, shop
- [ ] Trigger sync (refresh icon) → entry di Sync logs
- [ ] TikTok Seller Center stok ter-update (butuh warehouse_id valid jika sandbox mensyaratkan)
- [ ] TikTok Products page: banner "Stock from Stock Management" + link mapping

## Phase 1 — Order deduct (shared pool)

- [ ] Mapping seller SKU pada order line item
- [ ] Refresh dashboard TikTok → poll order ingest (best-effort)
- [ ] Order status PAID/AWAITING_SHIPMENT → movement `sale`, available berkurang
- [ ] Idempotent: refresh ulang tidak double-deduct
- [ ] Cancel order → `cancel_restock` (jika status CANCELLED)
- [ ] Setelah deduct → sync queue push qty baru ke TikTok

## Skenario susu (shared pool)

1. Input stok susu **1000** di Stock Management
2. Map ke TikTok → sync → TikTok menampilkan **1000**
3. Simulasi penjualan (TikTok sandbox order atau offline sale 400)
4. Available **600** → sync → TikTok **600**
5. Restock +400 → available **1000** → semua platform ter-map **1000**

## Shopee / Tokopedia / BliBli

- [ ] Mapping platform bisa dibuat
- [ ] Sync log menampilkan "not implemented yet" (stub Phase 2–3)

## Deploy commands

```bash
npx supabase functions deploy stock-management-api --project-ref wqdzqqshoifwyrltzgvx
```

Cron (optional): POST `stock-management-api` with `{ "action": "processSyncQueue" }` and header `Authorization: Bearer $STOCK_CRON_SECRET`.
