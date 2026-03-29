

-- ---------------------------------------------------------------------------
-- Stub RPCs for attendance (extend in a later migration)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_attendance_comprehensive(
  p_employee_id uuid,
  p_organization_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('ok', true);
$$;

CREATE OR REPLACE FUNCTION public.record_attendance_with_timezone(
  p_employee_id uuid,
  p_organization_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('ok', true, 'id', gen_random_uuid());
$$;

REVOKE ALL ON FUNCTION public.validate_attendance_comprehensive(uuid, uuid, jsonb) FROM PUBLIC;
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