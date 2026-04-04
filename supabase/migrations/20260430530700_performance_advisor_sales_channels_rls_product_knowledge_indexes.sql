-- Performance Advisor:
-- 1) Multiple permissive policies on public.sales_channels — legacy pricing_tools_sc_* overlap sales_channels_org_* (303).
-- 2) Duplicate btree indexes on public.product_knowledge_features — drop extras keeping idx_product_knowledge_features_org / _service.

-- ---------------------------------------------------------------------------
-- 1) sales_channels — single policy set (sales_channels_org_*)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "pricing_tools_sc_select" ON public.sales_channels;
DROP POLICY IF EXISTS "pricing_tools_sc_insert" ON public.sales_channels;
DROP POLICY IF EXISTS "pricing_tools_sc_update" ON public.sales_channels;
DROP POLICY IF EXISTS "pricing_tools_sc_delete" ON public.sales_channels;

-- ---------------------------------------------------------------------------
-- 2) product_knowledge_features — same column list as canonical indexes
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_product_knowledge_features_organization_id;
DROP INDEX IF EXISTS public.product_knowledge_features_organization_id_idx;
DROP INDEX IF EXISTS public.idx_product_knowledge_features_service_id;

-- Drop duplicate single-column indexes on organization_id / service_id (keep preferred names when possible).
DO $drop_dup_pkf_indexes$
DECLARE
  att_org smallint;
  att_svc smallint;
  r RECORD;
BEGIN
  IF to_regclass('public.product_knowledge_features') IS NULL THEN
    RETURN;
  END IF;

  SELECT a.attnum INTO att_org
  FROM pg_attribute a
  WHERE a.attrelid = 'public.product_knowledge_features'::regclass
    AND a.attname = 'organization_id'
    AND NOT a.attisdropped;

  SELECT a.attnum INTO att_svc
  FROM pg_attribute a
  WHERE a.attrelid = 'public.product_knowledge_features'::regclass
    AND a.attname = 'service_id'
    AND NOT a.attisdropped;

  IF att_org IS NOT NULL THEN
    FOR r IN
      WITH org_indexes AS (
        SELECT i.indkey, ic.relname AS idx_name
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_class ic ON ic.oid = i.indexrelid
        WHERE n.nspname = 'public'
          AND t.relname = 'product_knowledge_features'
          AND NOT i.indisprimary
          AND i.indnatts = 1
          AND i.indkey[1] = att_org
      ),
      keeper AS (
        SELECT DISTINCT ON (indkey)
          indkey,
          idx_name AS keep_name
        FROM org_indexes
        ORDER BY indkey,
          CASE idx_name WHEN 'idx_product_knowledge_features_org' THEN 0 ELSE 1 END,
          idx_name
      )
      SELECT o.idx_name
      FROM org_indexes o
      JOIN keeper k ON k.indkey = o.indkey
      WHERE o.idx_name <> k.keep_name
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS public.%I', r.idx_name);
    END LOOP;
  END IF;

  IF att_svc IS NOT NULL THEN
    FOR r IN
      WITH svc_indexes AS (
        SELECT i.indkey, ic.relname AS idx_name
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_class ic ON ic.oid = i.indexrelid
        WHERE n.nspname = 'public'
          AND t.relname = 'product_knowledge_features'
          AND NOT i.indisprimary
          AND i.indnatts = 1
          AND i.indkey[1] = att_svc
      ),
      keeper AS (
        SELECT DISTINCT ON (indkey)
          indkey,
          idx_name AS keep_name
        FROM svc_indexes
        ORDER BY indkey,
          CASE idx_name WHEN 'idx_product_knowledge_features_service' THEN 0 ELSE 1 END,
          idx_name
      )
      SELECT o.idx_name
      FROM svc_indexes o
      JOIN keeper k ON k.indkey = o.indkey
      WHERE o.idx_name <> k.keep_name
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS public.%I', r.idx_name);
    END LOOP;
  END IF;
END
$drop_dup_pkf_indexes$;
