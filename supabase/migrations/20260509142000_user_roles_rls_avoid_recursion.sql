-- Fix 42P17 infinite recursion: policies on user_roles must not subquery user_roles under the same RLS.
-- Use a SECURITY DEFINER helper so the privilege check bypasses RLS on user_roles.

CREATE OR REPLACE FUNCTION public.user_roles_actor_can_manage_org(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.organization_id = p_organization_id
      AND ur.role IN ('owner', 'admin', 'hr')
  )
  OR EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = p_organization_id
      AND (
        o.user_id IS NOT DISTINCT FROM (SELECT auth.uid())
        OR o.created_by IS NOT DISTINCT FROM (SELECT auth.uid())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_roles_actor_can_manage_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_roles_actor_can_manage_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_roles_actor_can_manage_org(uuid) TO service_role;

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "user_roles_org_staff_insert" ON public.user_roles';
  EXECUTE 'DROP POLICY IF EXISTS "user_roles_org_staff_update" ON public.user_roles';

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
        AND public.user_roles_actor_can_manage_org(user_roles.organization_id)
      )
  $sql$;

  EXECUTE $sql$
    CREATE POLICY "user_roles_org_staff_update"
      ON public.user_roles FOR UPDATE TO authenticated
      USING (
        organization_id IN (SELECT public.user_organization_ids())
        AND user_roles.role IS DISTINCT FROM 'owner'
        AND public.user_roles_actor_can_manage_org(user_roles.organization_id)
      )
      WITH CHECK (
        organization_id IN (SELECT public.user_organization_ids())
        AND user_roles.role IN ('admin', 'employee')
        AND public.user_roles_actor_can_manage_org(user_roles.organization_id)
      )
  $sql$;
END;
$$;
