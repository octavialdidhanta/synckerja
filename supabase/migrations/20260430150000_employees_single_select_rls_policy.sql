-- Performance Advisor: "Multiple Permissive Policies" on public.employees (SELECT + authenticated).
-- Replace two permissive SELECT policies with one combined USING clause.

DROP POLICY IF EXISTS "employees_select_own" ON public.employees;
DROP POLICY IF EXISTS "employees_select_same_organization" ON public.employees;

CREATE POLICY "employees_select_self_or_org"
  ON public.employees FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      organization_id IS NOT NULL
      AND organization_id IN (SELECT public.user_organization_ids())
    )
  );
