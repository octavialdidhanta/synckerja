
CREATE POLICY "key_results_org_all"
  ON public.key_results FOR ALL TO authenticated
  USING (
    COALESCE(
      (SELECT co.organization_id FROM public.company_objectives co WHERE co.id = key_results.company_objective_id),
      (SELECT dbo.organization_id FROM public.department_objectives dbo WHERE dbo.id = key_results.department_objective_id),
      (SELECT io.organization_id FROM public.individual_objectives io WHERE io.id = key_results.individual_objective_id)
    ) IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    COALESCE(
      (SELECT co.organization_id FROM public.company_objectives co WHERE co.id = key_results.company_objective_id),
      (SELECT dbo.organization_id FROM public.department_objectives dbo WHERE dbo.id = key_results.department_objective_id),
      (SELECT io.organization_id FROM public.individual_objectives io WHERE io.id = key_results.individual_objective_id)
    ) IN (SELECT public.user_organization_ids())
  );

ALTER TABLE public.key_result_approvals ENABLE ROW LEVEL SECURITY;
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
  WITH CHECK (true);

ALTER TABLE public.attendance_validations ENABLE ROW LEVEL SECURITY;
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
  WITH CHECK (true);
