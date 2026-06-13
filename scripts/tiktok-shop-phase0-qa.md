# TikTok Shop — Fase 0 Manual QA Checklist

Prasyarat sebelum uji:
- Migration `20260628120000` dan `20260628120100` sudah di-push ke Supabase
- Edge functions deployed: `tiktok-shop-oauth-start`, `tiktok-shop-oauth-callback`, `tiktok-shop-config`
- Secrets di Supabase Edge Functions:
  - `TIKTOK_SHOP_APP_KEY`
  - `TIKTOK_SHOP_APP_SECRET`
  - `TIKTOK_SHOP_SERVICE_ID`
  - `TIKTOK_SHOP_CONFIG_ENCRYPTION_KEY` (atau fallback `TIKTOK_ADS_CONFIG_ENCRYPTION_KEY`)
  - `APP_PUBLIC_URL`
- Redirect URL di Partner Center: `{SUPABASE_URL}/functions/v1/tiktok-shop-oauth-callback`

## Connect & OAuth

- [ ] Buka `/operations/sales/tiktok-shop/settings` sebagai owner/admin
- [ ] Klik **Connect seller** → redirect ke TikTok authorization
- [ ] Setelah authorize → kembali ke settings dengan toast sukses (`?connected=1`)
- [ ] Daftar seller + shop muncul (`shop_id`, `shop_cipher`, nama toko, region)

## Multi-seller

- [ ] Klik **Connect another seller** dengan akun seller berbeda
- [ ] Seller pertama tetap ada; seller kedua muncul sebagai grup terpisah
- [ ] Re-authorize seller yang sama → toast info `existing=1`, token di-update

## Sync & test

- [ ] **Sync shops** pada satu seller memperbarui daftar toko tanpa duplikasi `shop_id`
- [ ] **Test connection** → `last_test_ok = true` (alert hijau di UI)
- [ ] Token tidak terlihat di Network tab / response `getSettings`

## Disconnect

- [ ] **Disconnect** per seller → hanya seller tersebut + tokonya yang hilang
- [ ] **Disconnect all** → semua seller/token/shop terhapus, `oauth_connected_at` null

## Database RPC

- [ ] Setelah connect: `is_tiktok_shop_connected(org_id)` → `true`
- [ ] Setelah disconnect all: `is_tiktok_shop_connected(org_id)` → `false`

## Signing (opsional, Partner Center API Testing Tool)

- [ ] Unit test lokal: `npm test -- src/tiktok-shop/lib/tiktokShopSigning.test.ts`
- [ ] Signed GET `/authorization/202309/shops` lolos di API Testing Tool
