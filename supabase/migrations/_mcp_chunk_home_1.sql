GRANT EXECUTE ON FUNCTION public.validate_attendance_comprehensive(uuid, uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.record_attendance_with_timezone(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_attendance_with_timezone(uuid, uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS templates for new org tables (SELECT/INSERT/UPDATE for members)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'okr_cycles',
    'company_objectives',
    'department_objectives',
    'individual_objectives',
    'weekly_checkins',
    'motivations',
    'motivation_likes',
    'employee_status',
    'training_programs',
    'training_participants',
    'attendance_records',
    'leave_requests',
    'office_locations',
    'work_schedule_settings',
    'employee_face_registrations',
    'allowed_ip_addresses'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "%I_org_all" ON public.%I', t || '_org_all', t);
    EXECUTE format(
      'CREATE POLICY "%I_org_all" ON public.%I FOR ALL TO authenticated USING (organization_id IN (SELECT public.user_organization_ids())) WITH CHECK (organization_id IN (SELECT public.user_organization_ids()))',
      t || '_org_all',
      t
    );
  END LOOP;
END $$;

-- key_results has no organization_id — link via parent objective
ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "key_results_org_all" ON public.key_results;
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
