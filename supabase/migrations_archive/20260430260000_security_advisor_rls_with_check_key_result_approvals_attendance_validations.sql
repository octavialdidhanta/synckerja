-- Security Advisor: RLS "Policy Always True" on INSERT/UPDATE — replace WITH CHECK (true)
-- with org-scoped checks matching USING, so writes cannot bypass tenant isolation.

DROP POLICY IF EXISTS "key_result_approvals_org_all" ON public.key_result_approvals;
CREATE POLICY "key_result_approvals_org_all"
  ON public.key_result_approvals FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.key_results kr
      WHERE kr.id = key_result_approvals.key_result_id
        AND COALESCE(
          (SELECT co.organization_id FROM public.company_objectives co WHERE co.id = kr.company_objective_id),
          (SELECT dbo.organization_id FROM public.department_objectives dbo WHERE dbo.id = kr.department_objective_id),
          (SELECT io.organization_id FROM public.individual_objectives io WHERE io.id = kr.individual_objective_id)
        ) IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.key_results kr
      WHERE kr.id = key_result_approvals.key_result_id
        AND COALESCE(
          (SELECT co.organization_id FROM public.company_objectives co WHERE co.id = kr.company_objective_id),
          (SELECT dbo.organization_id FROM public.department_objectives dbo WHERE dbo.id = kr.department_objective_id),
          (SELECT io.organization_id FROM public.individual_objectives io WHERE io.id = kr.individual_objective_id)
        ) IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "attendance_validations_org" ON public.attendance_validations;
CREATE POLICY "attendance_validations_org"
  ON public.attendance_validations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.id = attendance_validations.attendance_record_id
        AND ar.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.id = attendance_validations.attendance_record_id
        AND ar.organization_id IN (SELECT public.user_organization_ids())
    )
  );
