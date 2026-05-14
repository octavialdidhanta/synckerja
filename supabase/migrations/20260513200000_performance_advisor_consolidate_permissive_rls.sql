-- Performance Advisor: "Multiple Permissive Policies" — consolidate to one policy per (table, command, role).
-- Fixes overlapping authenticated policies on user_roles (insert/update) and clears duplicate/extra policies
-- on organizations and analytics_web_access, then reapplies canonical definitions from prior migrations.

-- ---------------------------------------------------------------------------
-- 1) user_roles — merge staff policies into the base insert/update policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_roles_org_staff_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_org_staff_update" ON public.user_roles;

DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_id = (SELECT auth.uid())
      AND (
        organization_id IN (
          SELECT o.id FROM public.organizations o
          WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
        )
        OR organization_id IN (SELECT public.user_organization_ids())
      )
    )
    OR (
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
  );

DROP POLICY IF EXISTS "user_roles_update_own" ON public.user_roles;
CREATE POLICY "user_roles_update_own"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      organization_id IN (SELECT public.user_organization_ids())
      AND user_roles.role IS DISTINCT FROM 'owner'
      AND public.user_roles_actor_can_manage_org(user_roles.organization_id)
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (
      organization_id IN (SELECT public.user_organization_ids())
      AND user_roles.role IN ('admin', 'employee')
      AND public.user_roles_actor_can_manage_org(user_roles.organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2) organizations — drop all policies on the table, then single set (authenticated)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RETURN;
  END IF;
  FOR pol IN
    SELECT p.polname AS policy_name
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'organizations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations', pol.policy_name);
  END LOOP;
END;
$$;

CREATE POLICY "organizations_select_member"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR user_id = (SELECT auth.uid())
    OR id IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "organizations_insert_creator"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND user_id = (SELECT auth.uid()));

CREATE POLICY "organizations_update_member"
  ON public.organizations FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR user_id = (SELECT auth.uid())
    OR id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR user_id = (SELECT auth.uid())
    OR id IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "organizations_delete_creator"
  ON public.organizations FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 3) analytics_web_access — drop all policies, then single set (authenticated)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.analytics_web_access') IS NULL THEN
    RETURN;
  END IF;
  FOR pol IN
    SELECT p.polname AS policy_name
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'analytics_web_access'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.analytics_web_access', pol.policy_name);
  END LOOP;
END;
$$;

CREATE POLICY "analytics_web_access_select_org"
  ON public.analytics_web_access FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.user_id = (SELECT auth.uid())
        AND pr.active_organization_id = analytics_web_access.organization_id
    )
  );

CREATE POLICY "analytics_web_access_insert_admin"
  ON public.analytics_web_access FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role_in_active_org() IN ('owner', 'admin')
  );

CREATE POLICY "analytics_web_access_update_admin"
  ON public.analytics_web_access FOR UPDATE TO authenticated
  USING (
    public.get_user_role_in_active_org() IN ('owner', 'admin')
  )
  WITH CHECK (
    public.get_user_role_in_active_org() IN ('owner', 'admin')
  );

CREATE POLICY "analytics_web_access_delete_admin"
  ON public.analytics_web_access FOR DELETE TO authenticated
  USING (
    public.get_user_role_in_active_org() IN ('owner', 'admin')
  );
