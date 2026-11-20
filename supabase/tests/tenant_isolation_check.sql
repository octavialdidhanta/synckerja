-- Tenant isolation check (read-only: everything is rolled back).
--
-- For every identity (anon + every user in public.profiles) and every public table that has an
-- organization_id column, try to SELECT / UPDATE / DELETE rows that belong to organizations the
-- identity is NOT a member of (membership = user_organizations ∪ user_roles).
-- Writes run inside a sub-block that always raises, so nothing is ever persisted; the whole
-- statement also ends with RAISE EXCEPTION, so the outer transaction rolls back too.
--
-- Output: the final error message starts with TENANT_ISOLATION and lists every
-- identity/table/operation that reached foreign-org rows. "none" means isolation held.
-- Known findings (by table + operation), if any, are listed in docs/security-advisor-baseline.md.
--
-- Run with the Supabase MCP execute_sql tool (or psql as postgres). Takes ~1 minute.

SET LOCAL statement_timeout = '300s';

DO $$
DECLARE
  who record;
  t record;
  v_orgs uuid[];
  n bigint;
  findings text[] := ARRAY[]::text[];
  checked int := 0;
BEGIN
  FOR who IN
    SELECT 'anon'::text AS label, NULL::uuid AS uid
    UNION ALL
    SELECT 'user:' || left(p.user_id::text, 8), p.user_id FROM public.profiles p
  LOOP
    IF who.uid IS NULL THEN
      v_orgs := ARRAY[]::uuid[];
    ELSE
      SELECT coalesce(array_agg(DISTINCT o), ARRAY[]::uuid[]) INTO v_orgs FROM (
        SELECT organization_id o FROM public.user_organizations WHERE user_id = who.uid
        UNION SELECT organization_id FROM public.user_roles WHERE user_id = who.uid
      ) z WHERE o IS NOT NULL;
    END IF;

    FOR t IN
      SELECT c.relname AS tbl
      FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace AND ns.nspname = 'public'
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'organization_id' AND NOT a.attisdropped
      WHERE c.relkind = 'r'
      ORDER BY c.relname
    LOOP
      checked := checked + 1;

      -- switch identity
      IF who.uid IS NULL THEN
        PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
        EXECUTE 'SET LOCAL ROLE anon';
      ELSE
        PERFORM set_config('request.jwt.claims', json_build_object('sub', who.uid, 'role', 'authenticated')::text, true);
        EXECUTE 'SET LOCAL ROLE authenticated';
      END IF;

      -- SELECT
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I WHERE organization_id IS NOT NULL AND organization_id <> ALL ($1)', t.tbl)
          INTO n USING v_orgs;
        IF n > 0 THEN findings := findings || format('%s %s SELECT %s', who.label, t.tbl, n); END IF;
      EXCEPTION WHEN insufficient_privilege THEN NULL;
                WHEN OTHERS THEN findings := findings || format('%s %s SELECT_ERROR %s', who.label, t.tbl, left(SQLERRM, 60));
      END;

      -- UPDATE (rolled back by the forced exception)
      n := 0;
      BEGIN
        EXECUTE format('UPDATE public.%I SET organization_id = organization_id WHERE organization_id IS NOT NULL AND organization_id <> ALL ($1)', t.tbl)
          USING v_orgs;
        GET DIAGNOSTICS n = ROW_COUNT;
        RAISE EXCEPTION USING ERRCODE = 'P0099';
      EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
                WHEN OTHERS THEN n := 0;
      END;
      IF n > 0 THEN findings := findings || format('%s %s UPDATE %s', who.label, t.tbl, n); END IF;

      -- DELETE (rolled back by the forced exception)
      n := 0;
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE organization_id IS NOT NULL AND organization_id <> ALL ($1)', t.tbl)
          USING v_orgs;
        GET DIAGNOSTICS n = ROW_COUNT;
        RAISE EXCEPTION USING ERRCODE = 'P0099';
      EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
                WHEN OTHERS THEN n := 0;
      END;
      IF n > 0 THEN findings := findings || format('%s %s DELETE %s', who.label, t.tbl, n); END IF;

      EXECUTE 'RESET ROLE';
    END LOOP;
  END LOOP;

  RAISE EXCEPTION 'TENANT_ISOLATION checks=% findings=% :: %',
    checked, coalesce(array_length(findings, 1), 0),
    CASE WHEN array_length(findings, 1) IS NULL THEN 'none' ELSE array_to_string(findings, ' | ') END;
END $$;
