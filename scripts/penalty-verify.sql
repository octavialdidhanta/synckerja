-- Penalty auto-apply smoke check (run after supabase db push)
-- Org demo: Synckerja 663c9336-8cb6-4a36-9ad9-313126e70a1a

SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('apply_late_arrival_penalties', 'record_attendance_with_timezone')
ORDER BY proname;

-- Enable automatic penalties + seed fixed rule (threshold 5 min, Rp 50.000)
INSERT INTO public.penalty_settings (
  organization_id,
  enable_automatic_penalties,
  default_calculation_type,
  default_hourly_rate
)
VALUES (
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  true,
  'fixed',
  50000
)
ON CONFLICT (organization_id) DO UPDATE
SET enable_automatic_penalties = EXCLUDED.enable_automatic_penalties,
    updated_at = now();

-- Single canonical late_arrival rule (remove duplicates from prior verify runs)
DELETE FROM public.penalty_rules pr
WHERE pr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND pr.rule_type = 'late_arrival'
  AND pr.name <> 'Telat melewati toleransi shift';

INSERT INTO public.penalty_rules (
  organization_id,
  name,
  rule_type,
  threshold_minutes,
  penalty_amount,
  calculation_type,
  is_active,
  applies_to_all
)
SELECT
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'Telat melewati toleransi shift',
  'late_arrival',
  5,
  50000,
  'fixed',
  true,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.penalty_rules pr
  WHERE pr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND pr.name = 'Telat melewati toleransi shift'
    AND pr.rule_type = 'late_arrival'
);

-- Simulate OCTA late check-in: 08:20 (20 late min, 15 tol → 5 penalizable → Rp 50.000)
DO $$
DECLARE
  v_emp uuid := '001b6725-bf16-4a2f-81ae-8960cf86c46d';
  v_org uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_date date := '2026-06-02';
  v_ar_id uuid := gen_random_uuid();
  v_result jsonb;
BEGIN
  DELETE FROM public.attendance_penalties ap
  WHERE ap.employee_id = v_emp
    AND ap.applied_date = v_date;

  DELETE FROM public.attendance_records ar
  WHERE ar.employee_id = v_emp
    AND ar.attendance_date = v_date;

  INSERT INTO public.attendance_records (
    id, employee_id, organization_id, attendance_date,
    check_in_time, is_late, late_minutes, status
  )
  VALUES (
    v_ar_id, v_emp, v_org, v_date,
    '08:20:00'::time, true, 20, 'present'
  );

  v_result := public.apply_late_arrival_penalties(v_ar_id);

  RAISE NOTICE 'apply_late_arrival_penalties: %', v_result;
END $$;

SELECT e.full_name,
       ap.penalty_amount,
       ap.status,
       ap.violation_details->>'penalizable_minutes' AS penalizable_minutes,
       ap.violation_details->>'late_tolerance_minutes' AS tolerance
FROM public.attendance_penalties ap
JOIN public.employees e ON e.id = ap.employee_id
WHERE ap.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND ap.applied_date = '2026-06-02'::date
  AND e.employee_id = 'EMP-00001';

-- Aidah within tolerance should produce no penalty when not late
DO $$
DECLARE
  v_emp uuid := '485f1a2b-da0c-4464-8c22-ad9ca6e58942';
  v_org uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_date date := '2026-06-03';
  v_ar_id uuid := gen_random_uuid();
  v_result jsonb;
BEGIN
  DELETE FROM public.attendance_penalties ap
  WHERE ap.employee_id = v_emp AND ap.applied_date = v_date;

  DELETE FROM public.attendance_records ar
  WHERE ar.employee_id = v_emp AND ar.attendance_date = v_date;

  INSERT INTO public.attendance_records (
    id, employee_id, organization_id, attendance_date,
    check_in_time, is_late, late_minutes, status
  )
  VALUES (
    v_ar_id, v_emp, v_org, v_date,
    '12:50:00'::time, false, 0, 'present'
  );

  v_result := public.apply_late_arrival_penalties(v_ar_id);
  RAISE NOTICE 'Aidah not late: %', v_result;
END $$;

SELECT COUNT(*) AS aidah_penalties
FROM public.attendance_penalties ap
JOIN public.employees e ON e.id = ap.employee_id
WHERE e.employee_id = 'EMP-00002'
  AND ap.applied_date = '2026-06-03'::date;
