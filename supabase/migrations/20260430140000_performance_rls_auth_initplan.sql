-- Performance Advisor: Auth RLS Initialization Plan
-- Wrap auth.uid() as (SELECT auth.uid()) in RLS expressions and in helpers used by policies
-- so Postgres evaluates auth once per statement, not per row.
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- Helpers referenced from policies
CREATE OR REPLACE FUNCTION public.user_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uo.organization_id
  FROM public.user_organizations uo
  WHERE uo.user_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_subscription(p_org_id uuid)
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
      AND ur.organization_id = p_org_id
      AND lower(trim(ur.role)) IN ('owner', 'admin')
  );
$$;

-- email_verification_tokens
DROP POLICY IF EXISTS "email_verification_tokens_select_own" ON public.email_verification_tokens;
CREATE POLICY "email_verification_tokens_select_own"
  ON public.email_verification_tokens
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

-- organizations
DROP POLICY IF EXISTS "organizations_select_member" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_creator" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_member" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete_creator" ON public.organizations;

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

-- departments
DROP POLICY IF EXISTS "departments_select" ON public.departments;
DROP POLICY IF EXISTS "departments_insert" ON public.departments;
DROP POLICY IF EXISTS "departments_update" ON public.departments;
DROP POLICY IF EXISTS "departments_delete" ON public.departments;

CREATE POLICY "departments_select"
  ON public.departments FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND (
      organization_id IN (SELECT public.user_organization_ids())
      OR organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "departments_insert"
  ON public.departments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND (
      organization_id IN (SELECT public.user_organization_ids())
      OR organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "departments_update"
  ON public.departments FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND (
      organization_id IN (SELECT public.user_organization_ids())
      OR organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND (
      organization_id IN (SELECT public.user_organization_ids())
      OR organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "departments_delete"
  ON public.departments FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND (
      organization_id IN (SELECT public.user_organization_ids())
      OR organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
      )
    )
  );

-- user_organizations
DROP POLICY IF EXISTS "user_organizations_select" ON public.user_organizations;
DROP POLICY IF EXISTS "user_organizations_insert" ON public.user_organizations;
DROP POLICY IF EXISTS "user_organizations_update_own" ON public.user_organizations;
DROP POLICY IF EXISTS "user_organizations_delete_own" ON public.user_organizations;

CREATE POLICY "user_organizations_select"
  ON public.user_organizations FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR organization_id IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "user_organizations_insert"
  ON public.user_organizations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
      )
      OR organization_id IN (SELECT public.user_organization_ids())
    )
  );

CREATE POLICY "user_organizations_update_own"
  ON public.user_organizations FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_organizations_delete_own"
  ON public.user_organizations FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_own" ON public.user_roles;

CREATE POLICY "user_roles_select"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR organization_id IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "user_roles_insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
      )
      OR organization_id IN (SELECT public.user_organization_ids())
    )
  );

CREATE POLICY "user_roles_update_own"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_roles_delete_own"
  ON public.user_roles FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- employees (row owned by user_id)
DROP POLICY IF EXISTS "employees_select_own" ON public.employees;
DROP POLICY IF EXISTS "employees_insert_own" ON public.employees;
DROP POLICY IF EXISTS "employees_update_own" ON public.employees;
DROP POLICY IF EXISTS "employees_delete_own" ON public.employees;

CREATE POLICY "employees_select_own"
  ON public.employees FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "employees_insert_own"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "employees_update_own"
  ON public.employees FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "employees_delete_own"
  ON public.employees FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- organization_subscriptions
DROP POLICY IF EXISTS "organization_subscriptions_select" ON public.organization_subscriptions;
DROP POLICY IF EXISTS "organization_subscriptions_insert" ON public.organization_subscriptions;
DROP POLICY IF EXISTS "organization_subscriptions_update" ON public.organization_subscriptions;
DROP POLICY IF EXISTS "organization_subscriptions_delete" ON public.organization_subscriptions;

CREATE POLICY "organization_subscriptions_select"
  ON public.organization_subscriptions FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    OR organization_id IN (
      SELECT o.id FROM public.organizations o
      WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "organization_subscriptions_insert"
  ON public.organization_subscriptions FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    OR organization_id IN (
      SELECT o.id FROM public.organizations o
      WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "organization_subscriptions_update"
  ON public.organization_subscriptions FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    OR organization_id IN (
      SELECT o.id FROM public.organizations o
      WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    OR organization_id IN (
      SELECT o.id FROM public.organizations o
      WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "organization_subscriptions_delete"
  ON public.organization_subscriptions FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    OR organization_id IN (
      SELECT o.id FROM public.organizations o
      WHERE o.created_by = (SELECT auth.uid()) OR o.user_id = (SELECT auth.uid())
    )
  );

-- subscription_change_requests (direct auth.uid in WITH CHECK)
DROP POLICY IF EXISTS "subscription_change_requests_insert" ON public.subscription_change_requests;
CREATE POLICY "subscription_change_requests_insert"
  ON public.subscription_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.user_can_manage_subscription(organization_id)
    AND requested_by = (SELECT auth.uid())
  );
