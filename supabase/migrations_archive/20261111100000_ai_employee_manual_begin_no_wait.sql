-- Generate sekarang tidak menunggu satu jam.
-- Ditolak hanya bila Content Plan untuk karyawan ini masih berstatus berjalan.

CREATE OR REPLACE FUNCTION public.ai_employee_sop1_manual_begin(
  p_user_id uuid,
  p_employee_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $manual$
DECLARE
  v_org uuid;
  v_active boolean;
  v_performance text;
  v_run uuid;
BEGIN
  SELECT employee.organization_id, profile.is_active, profile.performance_status
  INTO v_org, v_active, v_performance
  FROM public.employees employee
  LEFT JOIN public.ai_employee_profiles profile
    ON profile.employee_id = employee.id
   AND profile.organization_id = employee.organization_id
  WHERE employee.id = p_employee_id
    AND COALESCE(employee.is_ai, false)
  FOR UPDATE OF employee;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.ai_employee_require_owner(p_user_id, v_org);

  IF v_active IS NOT TRUE OR v_performance = 'disabled' THEN
    RAISE EXCEPTION 'profile_inactive' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_employee_runs run
    WHERE run.employee_id = p_employee_id
      AND run.organization_id = v_org
      AND run.sop_code = 'SOP1'
      AND run.status = 'running'
  ) THEN
    RAISE EXCEPTION 'too_soon' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ai_employee_runs (employee_id, organization_id, sop_code, status, note)
  VALUES (p_employee_id, v_org, 'SOP1', 'running', 'manual')
  RETURNING id INTO v_run;

  RETURN v_run;
END;
$manual$;

COMMENT ON FUNCTION public.ai_employee_sop1_manual_begin(uuid, uuid) IS
  'Owner memulai satu Content Plan sekarang. Tidak menggeser jadwal. Ditolak hanya bila run SOP1 masih berstatus berjalan.';

REVOKE ALL ON FUNCTION public.ai_employee_sop1_manual_begin(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_sop1_manual_begin(uuid, uuid) TO ai_employee_runner;

NOTIFY pgrst, 'reload schema';
