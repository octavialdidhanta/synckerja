# google-ads-metrics

Multi-tenant Google Ads reporting (campaign / ad group / ad) with dynamic metrics and 10-minute DB cache.

## Deploy

```bash
# Apply migrations (including cache cleanup cron if pg_cron enabled):
# 20260601120000_google_ads_metrics_schema.sql
# 20260602120000_google_ads_metrics_cache_cleanup.sql

npm run supabase:functions:deploy:google-ads-metrics
npm run supabase:functions:deploy:google-ads-config   # syncAccessibleAccounts
```

## Actions (POST, Bearer auth, org admin)

- `fetchMetrics` — body: `organization_id`, `customer_id`, `entity`, `metrics[]`, `date_range`, `only_running`, `status_filter`, `page_token`, `sort: { field, direction }`
- `listMetricCatalog` — body: `organization_id`, optional `entity`

## Related: google-ads-config

- `syncAccessibleAccounts` — imports accessible customer IDs not yet in `organization_google_ads_accounts` (auto-picks first ENABLED conversion action)

## Ad previews

For `entity=ad`, creative headlines are enriched via a **separate GAQL query** (no date segment) after metrics fetch/cache read.

## Catalog

Categories: PERFORMANCE, CONVERSIONS, VIEWABILITY, COMPETITIVE, GMAIL.

## UI

`/digital-marketing/google-ads` (tab next to Web Traffic)

## Manual QA checklist

- [ ] OAuth connected; sync imports multiple customers (or explains test-token limit)
- [ ] Today / Last 7 / 30 date presets return data (with approved developer token)
- [ ] Unsupported metric selection shows banner + auto-removes from preferences
- [ ] Tab Ad shows headline preview when API allows
- [ ] 401 shows reconnect; 403 shows developer token + API Center link
- [ ] Cache: second request within 10 min shows `(cached)`
