-- Flow sanity: RPC defaults when no Meta connection
SELECT public.is_meta_ads_integration_enabled(o.id) AS integration_enabled,
       public.is_meta_ads_reporting_enabled(o.id) AS reporting_enabled,
       o.id AS org_id
FROM public.organizations o
ORDER BY o.created_at
LIMIT 3;

SELECT COUNT(*) AS connection_count FROM public.organization_meta_ads_connections;
SELECT COUNT(*) AS account_count FROM public.organization_meta_ads_accounts;
