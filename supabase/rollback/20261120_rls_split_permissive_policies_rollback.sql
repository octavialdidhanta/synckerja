-- Rollback for 20261120080000_rls_split_permissive_policies_tenant_fix.sql
--
-- Restores the exact policies captured in ops_backup.rls_policies_20261120 for every
-- affected table. WARNING: this also restores the cross-tenant bug on
-- organization_whatsapp_templates / organization_whatsapp_web_id_accounts /
-- organization_omnichannel_api_settings. Only use it if the forward migration broke something,
-- and re-apply a tenant-scoped fix right after.

SET LOCAL search_path = public, extensions, pg_temp;

DO $$
DECLARE r record; v_sql text;
BEGIN
  IF to_regclass('ops_backup.rls_policies_20261120') IS NULL THEN
    RAISE EXCEPTION 'backup table ops_backup.rls_policies_20261120 not found';
  END IF;

  -- Drop every current policy on the affected tables.
  FOR r IN
    SELECT p.tablename, p.policyname FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename IN (SELECT DISTINCT tablename FROM ops_backup.rls_policies_20261120)
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;

  -- Recreate the originals.
  FOR r IN SELECT * FROM ops_backup.rls_policies_20261120 ORDER BY tablename, policyname LOOP
    v_sql := format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
      r.policyname, r.tablename, r.permissive, r.cmd,
      (SELECT string_agg(quote_ident(x), ', ') FROM unnest(r.roles) x));
    IF r.qual IS NOT NULL THEN v_sql := v_sql || ' USING (' || r.qual || ')'; END IF;
    IF r.with_check IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || r.with_check || ')'; END IF;
    EXECUTE v_sql;
  END LOOP;
END $$;
