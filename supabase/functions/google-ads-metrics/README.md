# google-ads-metrics

Multi-tenant Google Ads reporting (campaign / ad group / ad / keyword) with dynamic metrics, column presets, and 10-minute DB cache.

## Deploy

```bash
# Apply migrations:
# 20260601120000_google_ads_metrics_schema.sql
# 20260529130000_google_ads_metrics_keyword_entity.sql
# 20260602120000_google_ads_column_sets.sql
# 20260602120000_google_ads_metrics_cache_cleanup.sql (if present)

npm run supabase:functions:deploy:google-ads-metrics
npm run supabase:functions:deploy:google-ads-config   # syncAccessibleAccounts
```

## Actions (POST, Bearer auth, org admin)

| Action | Body |
|--------|------|
| `fetchMetrics` | `organization_id`, `customer_id`, `entity`, `metrics[]`, `date_range`, `only_running`, `status_filter`, `page_token`, `sort: { field, direction }`, optional `campaign_filter_id`, optional `ad_group_filter_id` |
| `listMetricCatalog` | `organization_id`, optional `entity` — returns `max_metrics` (50), `identity_columns`, `recommended_keys`, `recommended`, `categories[]` |
| `listUiCustomColumns` | `organization_id`, `customer_id`, `entity` — formula Custom columns mirrored in DB (`ui_custom:{uuid}`) |
| `importUiCustomColumns` | `organization_id`, `customer_id`, `entity`, `names[]` (or multiline `text`), optional `replace_all` |
| `deleteUiCustomColumn` | `organization_id`, `id` (uuid) |
| `listCustomColumns` | *(legacy)* GAQL `conversion_action` — not used in Modify columns UI |
| `listColumnSets` | `organization_id`, `entity` |
| `saveColumnSet` | `organization_id`, `entity`, `name`, `metric_keys[]` (or `metrics[]`) — upsert by name; catalog keys validated per entity; `conv_action:*` keys allowed |
| `deleteColumnSet` | `organization_id`, `entity`, `id` or `name` |
| `listCampaigns` | `organization_id`, `customer_id`, `status_filter` |
| `listAdGroups` | `organization_id`, `customer_id`, `campaign_id`, `status_filter` |
| `getAccountDateBounds` | `organization_id`, `customer_id` |

## Metric catalog

Categories (English labels, GAQL-valid fields only per entity):

- Performance, Conversions, Attribution, Bid simulator, Competitive metrics, Viewability, Quality score, Call details, Message details, Gmail

Keyword tab excludes metrics not supported on `keyword_view` (`invalid_clicks`, `invalid_click_rate`, `avg_cpv`).

**Max selectable metrics:** 50 per request (frontend + `MAX_METRICS_PER_REQUEST`).

### Entity × locked identity columns

| Entity | Locked columns |
|--------|----------------|
| keyword | Keyword, Match type, Campaign, Ad group, Status |
| campaign | Campaign, Status, Type |
| ad_group | Ad group, Campaign, Status |
| ad | Ad, Status |

Recommended metric keys per entity are returned in `recommended_keys` / `recommended` for the Modify columns UI.

## Column sets

Table `organization_google_ads_column_sets` stores named presets (`metric_keys` ordered array) per user, org, and entity. Active table columns come from `organization_google_ads_metrics_preferences.selected_metrics` (also ordered).

## Ad previews

For `entity=ad`, creative headlines are enriched via a **separate GAQL query** (no date segment) after metrics fetch/cache read.

## UI

`/digital-marketing/google-ads` — **Modify columns** dialog (two-panel, drag-reorder, save/load column sets).

## Manager (MCC) accounts

If `customer_id` is a **manager** account, metrics cannot be queried on the MCC directly (`REQUESTED_METRICS_FOR_MANAGER`). The function will:

- Use the single linked **client** account automatically when there is only one, or
- **Aggregate** metrics across all enabled level-1 clients when there are multiple.

Prefer linking **client** customer IDs in settings.

## Manual QA checklist

- [ ] Keyword: 5 locked columns + metric reorder + Apply → table column order matches
- [ ] Refresh page → column order persists (`organization_google_ads_metrics_preferences`)
- [ ] Save column set → load preset from footer → order matches preset
- [ ] Campaign / ad_group / ad: different identity columns and filtered catalog
- [ ] Select 51 metrics → blocked in UI; backend rejects if > 50
- [ ] Keyword: `invalid_clicks`, `invalid_click_rate`, `avg_cpv` not in catalog
- [ ] Popular metric combinations fetch without GAQL errors
- [ ] Unsupported metric banner still works when API omits fields
- [ ] OAuth connected; date presets return data (approved developer token)
- [ ] Tab Ad shows headline preview when API allows
- [ ] Cache: second request within 10 min shows `(cached)`
