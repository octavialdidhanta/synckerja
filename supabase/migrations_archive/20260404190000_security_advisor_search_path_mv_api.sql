-- Security Advisor (warnings):
-- 1) Function Search Path Mutable — set search_path on listed public functions (if present).
-- 2) Materialized View in API — revoke PostgREST access to kol_conversion_aggregates (refresh still via owner/service_role).
-- 3) Leaked password protection: enable in Supabase Dashboard → Authentication → Attack Protection
--    (“Check passwords against HaveIBeenPwned” / leaked password protection). Not configurable via SQL.

-- ---------------------------------------------------------------------------
-- 1) Immutable search_path on trigger/helper functions named by the linter
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc
    FROM pg_proc p
    INNER JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname IN (
        'update_organization_script_ai_config_updated_at',
        'update_kol_updated_at',
        'update_product_knowledge_style_updated_at',
        'update_kol_campaign_deliverables_updated_at',
        'auto_create_budget_allocation',
        'update_product_knowledge_hooks_updated_at',
        'update_product_knowledge_features_updated_at',
        'generate_contract_number',
        'trigger_refresh_conversion_aggregates',
        'update_target_progress',
        'log_target_progress_change',
        'check_carousel_images_limit'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO public', r.proc);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) kol_conversion_aggregates: not queryable via Data API (anon/authenticated)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'm'
      AND c.relname = 'kol_conversion_aggregates'
  ) THEN
    EXECUTE 'REVOKE ALL ON TABLE public.kol_conversion_aggregates FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.kol_conversion_aggregates FROM authenticated';
  END IF;
END;
$$;
