-- Fix Performance Advisor: Auth RLS Initialization Plan
-- Rewrites public RLS policy expressions to use initplan-friendly auth calls:
--   auth.uid() -> (SELECT auth.uid())
--   auth.jwt() -> (SELECT auth.jwt())
DO $$
DECLARE
  policy_record record;
  cmd_text text;
  roles_text text;
  qual_text text;
  with_check_text text;
  create_sql text;
BEGIN
  FOR policy_record IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      p.polname AS policy_name,
      p.polcmd AS policy_cmd,
      p.polpermissive AS is_permissive,
      pg_catalog.pg_get_expr(p.polqual, p.polrelid) AS using_expr,
      pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr,
      COALESCE(
        (
          SELECT string_agg(quote_ident(r.rolname), ', ' ORDER BY r.rolname)
          FROM pg_catalog.pg_roles r
          WHERE r.oid = ANY (p.polroles)
        ),
        'PUBLIC'
      ) AS roles_clause
    FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        COALESCE(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '') LIKE '%auth.uid()%'
        OR COALESCE(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '') LIKE '%auth.jwt()%'
        OR COALESCE(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), '') LIKE '%auth.uid()%'
        OR COALESCE(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), '') LIKE '%auth.jwt()%'
      )
  LOOP
    cmd_text := CASE policy_record.policy_cmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      ELSE 'ALL'
    END;

    roles_text := policy_record.roles_clause;

    qual_text := CASE
      WHEN policy_record.using_expr IS NULL THEN NULL
      ELSE replace(
        replace(policy_record.using_expr, 'auth.uid()', '(SELECT auth.uid())'),
        'auth.jwt()', '(SELECT auth.jwt())'
      )
    END;

    with_check_text := CASE
      WHEN policy_record.check_expr IS NULL THEN NULL
      ELSE replace(
        replace(policy_record.check_expr, 'auth.uid()', '(SELECT auth.uid())'),
        'auth.jwt()', '(SELECT auth.jwt())'
      )
    END;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policy_name,
      policy_record.schema_name,
      policy_record.table_name
    );

    create_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      policy_record.policy_name,
      policy_record.schema_name,
      policy_record.table_name,
      CASE WHEN policy_record.is_permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd_text,
      roles_text
    );

    IF qual_text IS NOT NULL THEN
      create_sql := create_sql || format(' USING (%s)', qual_text);
    END IF;

    IF with_check_text IS NOT NULL THEN
      create_sql := create_sql || format(' WITH CHECK (%s)', with_check_text);
    END IF;

    EXECUTE create_sql;
  END LOOP;
END;
$$;
