-- Allow owner/admin/hr to assign organization roles (admin/employee) to other members
-- without requiring service-role. Protects rows where role = 'owner'.

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "user_roles_org_staff_insert" ON public.user_roles';
  EXECUTE 'DROP POLICY IF EXISTS "user_roles_org_staff_update" ON public.user_roles';

  -- INSERT a role row for another user when they belong to the org (e.g. no row yet → app treats as employee)
  EXECUTE $sql$
    CREATE POLICY "user_roles_org_staff_insert"
      ON public.user_roles FOR INSERT TO authenticated
      WITH CHECK (
        role IN ('admin', 'employee')
        AND organization_id IN (SELECT public.user_organization_ids())
        AND EXISTS (
          SELECT 1
          FROM public.user_organizations uo
          WHERE uo.user_id = user_roles.user_id
            AND uo.organization_id = user_roles.organization_id
        )
        AND (
          EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid())
              AND ur.organization_id = user_roles.organization_id
              AND ur.role IN ('owner', 'admin', 'hr')
          )
          OR EXISTS (
            SELECT 1
            FROM public.organizations o
            WHERE o.id = user_roles.organization_id
              AND (
                o.user_id = (SELECT auth.uid())
                OR o.created_by = (SELECT auth.uid())
              )
          )
        )
      )
  $sql$;

  -- UPDATE: cannot modify role = 'owner' rows; new role must be admin or employee
  EXECUTE $sql$
    CREATE POLICY "user_roles_org_staff_update"
      ON public.user_roles FOR UPDATE TO authenticated
      USING (
        organization_id IN (SELECT public.user_organization_ids())
        AND user_roles.role IS DISTINCT FROM 'owner'
        AND (
          EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid())
              AND ur.organization_id = user_roles.organization_id
              AND ur.role IN ('owner', 'admin', 'hr')
          )
          OR EXISTS (
            SELECT 1
            FROM public.organizations o
            WHERE o.id = user_roles.organization_id
              AND (
                o.user_id = (SELECT auth.uid())
                OR o.created_by = (SELECT auth.uid())
              )
          )
        )
      )
      WITH CHECK (
        organization_id IN (SELECT public.user_organization_ids())
        AND user_roles.role IN ('admin', 'employee')
        AND (
          EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid())
              AND ur.organization_id = user_roles.organization_id
              AND ur.role IN ('owner', 'admin', 'hr')
          )
          OR EXISTS (
            SELECT 1
            FROM public.organizations o
            WHERE o.id = user_roles.organization_id
              AND (
                o.user_id = (SELECT auth.uid())
                OR o.created_by = (SELECT auth.uid())
              )
          )
        )
      )
  $sql$;
END;
$$;
