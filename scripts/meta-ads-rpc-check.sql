SELECT p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_meta_ads_integration_enabled', 'is_meta_ads_reporting_enabled')
ORDER BY 1;
