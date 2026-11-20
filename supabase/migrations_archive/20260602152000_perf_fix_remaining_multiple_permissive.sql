-- Performance Advisor: fix remaining "Multiple Permissive Policies"
-- Remaining tables observed:
-- - public.employee_payroll_info
-- - public.reprimands
--
-- Root cause: a permissive FOR ALL policy also applies to SELECT, overlapping with a SELECT policy.
-- Fix: split write policies into INSERT/UPDATE/DELETE only (no SELECT).

-- ---------------------------------------------------------------------------
-- employee_payroll_info: split management writes (avoid SELECT overlap)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_payroll_info_write_management ON public.employee_payroll_info;

DROP POLICY IF EXISTS employee_payroll_info_insert_management ON public.employee_payroll_info;
CREATE POLICY employee_payroll_info_insert_management
  ON public.employee_payroll_info
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_info.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

DROP POLICY IF EXISTS employee_payroll_info_update_management ON public.employee_payroll_info;
CREATE POLICY employee_payroll_info_update_management
  ON public.employee_payroll_info
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_info.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_info.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

DROP POLICY IF EXISTS employee_payroll_info_delete_management ON public.employee_payroll_info;
CREATE POLICY employee_payroll_info_delete_management
  ON public.employee_payroll_info
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = employee_payroll_info.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

-- ---------------------------------------------------------------------------
-- reprimands: split HR management writes (avoid SELECT overlap)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS reprimands_hr_management_write ON public.reprimands;

DROP POLICY IF EXISTS reprimands_hr_management_insert ON public.reprimands;
CREATE POLICY reprimands_hr_management_insert ON public.reprimands
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = reprimands.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

DROP POLICY IF EXISTS reprimands_hr_management_update ON public.reprimands;
CREATE POLICY reprimands_hr_management_update ON public.reprimands
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = reprimands.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = reprimands.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

DROP POLICY IF EXISTS reprimands_hr_management_delete ON public.reprimands;
CREATE POLICY reprimands_hr_management_delete ON public.reprimands
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = reprimands.organization_id
        AND ur.role IN ('owner', 'admin', 'hr')
    )
  );

