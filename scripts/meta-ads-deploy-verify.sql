-- Meta Ads integration deploy verification (read-only checks)
SELECT 'tables' AS check_group, t.table_name, 'exists' AS status
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    'meta_ads_oauth_states',
    'organization_meta_ads_connections',
    'organization_meta_ads_connection_tokens',
    'organization_meta_ads_accounts',
    'meta_ads_conversion_uploads',
    'meta_ads_metrics_cache',
    'organization_meta_ads_metrics_preferences'
  )
ORDER BY t.table_name;

SELECT 'columns' AS check_group, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leads'
  AND column_name IN ('fbclid', 'meta_ads_account_id')
ORDER BY column_name;

SELECT 'rpc' AS check_group, p.proname AS function_name, 'exists' AS status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_meta_ads_integration_enabled', 'is_meta_ads_reporting_enabled')
ORDER BY p.proname;

SELECT 'permissions' AS check_group, page_path, is_active
FROM public.permission_configuration_defaults
WHERE page_path IN (
  '/digital-marketing/meta-ads',
  '/digital-marketing/meta-ads/settings',
  '/omnichannel/settings/offline-conversion'
)
ORDER BY page_path;
