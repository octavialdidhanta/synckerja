-- Allow employees to read their own reprimand records (mobile profile view-only).
-- HR/admin/owner policy reprimands_hr_management_all remains unchanged.

DROP POLICY IF EXISTS reprimands_employee_select_own ON public.reprimands;

CREATE POLICY reprimands_employee_select_own ON public.reprimands
  FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = reprimands.employee_id
        AND e.user_id = (SELECT auth.uid())
        AND e.organization_id = reprimands.organization_id
    )
  );
