-- Rollback for 20261120100000_tighten_security_definer_execute.sql
-- Restores the exact EXECUTE ACL of every public SECURITY DEFINER function from the snapshot
-- taken by the forward migration (ops_backup.function_acl_20261120).

SET LOCAL search_path = public, extensions, pg_temp;

DO $$
DECLARE
  r record;
  g record;
  v_n int := 0;
BEGIN
  IF to_regclass('ops_backup.function_acl_20261120') IS NULL THEN
    RAISE EXCEPTION 'snapshot ops_backup.function_acl_20261120 not found';
  END IF;

  FOR r IN SELECT func, acl FROM ops_backup.function_acl_20261120 WHERE to_regprocedure(func) IS NOT NULL LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', r.func);
    IF r.acl IS NULL THEN
      -- NULL ACL means the built-in default: EXECUTE for PUBLIC.
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', r.func);
    ELSE
      FOR g IN SELECT grantee FROM aclexplode(r.acl::aclitem[]) WHERE privilege_type = 'EXECUTE' LOOP
        IF g.grantee = 0 THEN
          EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', r.func);
        ELSIF g.grantee::regrole::text IN ('anon', 'authenticated', 'service_role') THEN
          EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', r.func, g.grantee::regrole::text);
        END IF;
      END LOOP;
    END IF;
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE 'restored ACLs for % functions', v_n;
END $$;
