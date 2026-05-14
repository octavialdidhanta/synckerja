-- Employees: allow HR/admin/owner to manage employees within their organizations.
-- Fixes RLS 403 when creating employees for another user_id.

DO $$
BEGIN
  IF to_regclass('public.employees') IS NULL THEN
    RETURN;
  END IF;

  -- Remove legacy "own row only" write policies (blocks HR creating other users).
  EXECUTE 'DROP POLICY IF EXISTS "employees_insert_own" ON public.employees';
  EXECUTE 'DROP POLICY IF EXISTS "employees_update_own" ON public.employees';
  EXECUTE 'DROP POLICY IF EXISTS "employees_delete_own" ON public.employees';
  EXECUTE 'DROP POLICY IF EXISTS "employees_select_own" ON public.employees';

  -- Idempotent drop of org-management policies
  EXECUTE 'DROP POLICY IF EXISTS "employees_hr_management_insert" ON public.employees';
  EXECUTE 'DROP POLICY IF EXISTS "employees_hr_management_update" ON public.employees';
  EXECUTE 'DROP POLICY IF EXISTS "employees_hr_management_delete" ON public.employees';

  -- INSERT: HR/admin/owner can create employee rows for orgs they belong to.
  EXECUTE $sql$
    CREATE POLICY "employees_hr_management_insert"
      ON public.employees FOR INSERT TO authenticated
      WITH CHECK (
        organization_id IS NOT NULL
        AND organization_id IN (SELECT public.user_organization_ids())
        AND EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = (SELECT auth.uid())
            AND ur.organization_id = employees.organization_id
            AND ur.role IN ('owner', 'admin', 'hr')
        )
      )
  $sql$;

  -- UPDATE: HR/admin/owner can update employee rows in their org.
  EXECUTE $sql$
    CREATE POLICY "employees_hr_management_update"
      ON public.employees FOR UPDATE TO authenticated
      USING (
        organization_id IS NOT NULL
        AND organization_id IN (SELECT public.user_organization_ids())
        AND EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = (SELECT auth.uid())
            AND ur.organization_id = employees.organization_id
            AND ur.role IN ('owner', 'admin', 'hr')
        )
      )
      WITH CHECK (
        organization_id IS NOT NULL
        AND organization_id IN (SELECT public.user_organization_ids())
        AND EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = (SELECT auth.uid())
            AND ur.organization_id = employees.organization_id
            AND ur.role IN ('owner', 'admin', 'hr')
        )
      )
  $sql$;

  -- DELETE: HR/admin/owner can delete employee rows in their org.
  EXECUTE $sql$
    CREATE POLICY "employees_hr_management_delete"
      ON public.employees FOR DELETE TO authenticated
      USING (
        organization_id IS NOT NULL
        AND organization_id IN (SELECT public.user_organization_ids())
        AND EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = (SELECT auth.uid())
            AND ur.organization_id = employees.organization_id
            AND ur.role IN ('owner', 'admin', 'hr')
        )
      )
  $sql$;
END;
$$;

