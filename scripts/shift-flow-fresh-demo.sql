-- Fresh Employee Shift Settings demo + end-to-end verification
-- Org: Synckerja 663c9336-8cb6-4a36-9ad9-313126e70a1a
-- Run: npm run supabase:db:push:shift-flow-verify

-- ===========================================================================
-- 1) CLEANUP — hapus data shift & absensi demo lama
-- ===========================================================================
DELETE FROM public.attendance_penalties ap
WHERE ap.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND ap.employee_id IN (
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '485f1a2b-da0c-4464-8c22-ad9ca6e58942'::uuid
  );

DELETE FROM public.attendance_records ar
WHERE ar.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND ar.employee_id IN (
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '485f1a2b-da0c-4464-8c22-ad9ca6e58942'::uuid
  );

DELETE FROM public.employee_shifts es
WHERE es.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

DELETE FROM public.shifts s
WHERE s.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid;

-- ===========================================================================
-- 2) SEED — shift master + assignment baru (batch 2026-06-30 verify)
-- ===========================================================================
INSERT INTO public.shifts (
  id, organization_id, name, description,
  start_time, end_time, break_duration_minutes,
  late_tolerance_minutes, is_active
) VALUES
  (
    'f1f1f1f1-1111-4111-8111-111111111101'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    'Shift Pagi Verify',
    'Fresh demo — OCTA, 08:00-17:00, tol 15, break 60',
    '08:00', '17:00', 60, 15, true
  ),
  (
    'f1f1f1f1-1111-4111-8111-111111111102'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    'Shift Siang Verify',
    'Fresh demo — Aidah, 13:00-22:00, tol 10, break 60',
    '13:00', '22:00', 60, 10, true
  );

INSERT INTO public.employee_shifts (
  id, organization_id, employee_id, shift_id,
  effective_from_date, effective_to_date, is_active
) VALUES
  (
    'f2f2f2f2-2222-4222-8222-222222222201'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    'f1f1f1f1-1111-4111-8111-111111111101'::uuid,
    '2026-06-01', NULL, true
  ),
  (
    'f2f2f2f2-2222-4222-8222-222222222202'::uuid,
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '485f1a2b-da0c-4464-8c22-ad9ca6e58942'::uuid,
    'f1f1f1f1-1111-4111-8111-111111111102'::uuid,
    '2026-06-01', NULL, true
  );

-- ===========================================================================
-- 3) SEED — attendance golden scenarios (2026-06-20, weekday)
-- ===========================================================================
INSERT INTO public.attendance_records (
  id, employee_id, organization_id, attendance_date,
  check_in_time, check_out_time,
  shift_id, employee_shift_id, work_schedule_id,
  is_late, late_minutes, status
)
SELECT
  'a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  '2026-06-20'::date,
  '08:20:00'::time, '18:30:00'::time,
  'f1f1f1f1-1111-4111-8111-111111111101'::uuid,
  'f2f2f2f2-2222-4222-8222-222222222201'::uuid,
  r.work_schedule_id,
  true, 20, 'present'
FROM public.resolve_effective_schedule(
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  '2026-06-20'::date
) r
LIMIT 1;

INSERT INTO public.attendance_records (
  id, employee_id, organization_id, attendance_date,
  check_in_time, check_out_time,
  shift_id, employee_shift_id, work_schedule_id,
  is_late, late_minutes, status
)
SELECT
  'a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
  '485f1a2b-da0c-4464-8c22-ad9ca6e58942'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  '2026-06-20'::date,
  '12:50:00'::time, '18:30:00'::time,
  'f1f1f1f1-1111-4111-8111-111111111102'::uuid,
  'f2f2f2f2-2222-4222-8222-222222222202'::uuid,
  r.work_schedule_id,
  false, 0, 'present'
FROM public.resolve_effective_schedule(
  '485f1a2b-da0c-4464-8c22-ad9ca6e58942'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  '2026-06-20'::date
) r
LIMIT 1;

-- OCTA within tolerance: 08:10 (10 min late raw, deadline 08:15 → not late flag if using RPC; manual: not late)
INSERT INTO public.attendance_records (
  id, employee_id, organization_id, attendance_date,
  check_in_time, shift_id, employee_shift_id,
  is_late, late_minutes, status
) VALUES (
  'a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid,
  '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  '2026-06-19'::date,
  '08:10:00'::time,
  'f1f1f1f1-1111-4111-8111-111111111101'::uuid,
  'f2f2f2f2-2222-4222-8222-222222222201'::uuid,
  false, 10, 'present'
);

-- Enable penalties + canonical single late_arrival rule
INSERT INTO public.penalty_settings (
  organization_id, enable_automatic_penalties, default_calculation_type, default_hourly_rate
)
VALUES (
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid, true, 'fixed', 50000
)
ON CONFLICT (organization_id) DO UPDATE
SET enable_automatic_penalties = true, updated_at = now();

DELETE FROM public.penalty_rules pr
WHERE pr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND pr.rule_type = 'late_arrival'
  AND pr.name <> 'Telat melewati toleransi shift';

INSERT INTO public.penalty_rules (
  organization_id, name, rule_type, threshold_minutes,
  penalty_amount, calculation_type, is_active, applies_to_all
)
SELECT
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'Telat melewati toleransi shift',
  'late_arrival', 5, 50000, 'fixed', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.penalty_rules pr
  WHERE pr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND pr.name = 'Telat melewati toleransi shift'
    AND pr.rule_type = 'late_arrival'
);

DELETE FROM public.attendance_penalties ap
WHERE ap.attendance_record_id = 'a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid;

SELECT public.apply_late_arrival_penalties('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid) AS octa_penalty_result;

-- ===========================================================================
-- 4) VERIFICATION OUTPUT
-- ===========================================================================
SELECT '--- SHIFTS SEEDED ---' AS section;
SELECT id, name, start_time, end_time, late_tolerance_minutes, break_duration_minutes
FROM public.shifts
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
ORDER BY name;

SELECT '--- ASSIGNMENTS ---' AS section;
SELECT e.full_name, s.name AS shift_name, es.effective_from_date, es.is_active
FROM public.employee_shifts es
JOIN public.employees e ON e.id = es.employee_id
JOIN public.shifts s ON s.id = es.shift_id
WHERE es.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
ORDER BY e.full_name;

SELECT '--- RESOLVER (2026-06-20) ---' AS section;
SELECT e.full_name, r.source, s.name AS shift_name,
       r.start_time, r.end_time, r.late_tolerance_minutes,
       r.break_duration_minutes, r.is_working_day
FROM public.employees e
CROSS JOIN LATERAL public.resolve_effective_schedule(e.id, e.organization_id, '2026-06-20'::date) r
LEFT JOIN public.shifts s ON s.id = r.shift_id
WHERE e.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND e.employee_id IN ('EMP-00001', 'EMP-00002')
ORDER BY e.full_name;

SELECT '--- LATE SIMULATION (RPC logic mirror) ---' AS section;
SELECT e.full_name,
       ar.attendance_date,
       ar.check_in_time,
       ar.is_late,
       ar.late_minutes,
       r.start_time,
       r.late_tolerance_minutes,
       GREATEST(0, ar.late_minutes - COALESCE(r.late_tolerance_minutes, 0)) AS penalizable_minutes
FROM public.attendance_records ar
JOIN public.employees e ON e.id = ar.employee_id
CROSS JOIN LATERAL public.resolve_effective_schedule(
  ar.employee_id, ar.organization_id, ar.attendance_date
) r
WHERE ar.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND ar.attendance_date >= '2026-06-19'::date
ORDER BY e.full_name, ar.attendance_date;

SELECT '--- OVERTIME (June 2026, checkout 18:30 on 20-Jun) ---' AS section;
SELECT e.full_name,
       public.payroll_calculate_overtime_pay(
         '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
         e.id,
         '2026-06-01'::date,
         '2026-06-30'::date,
         CASE WHEN e.employee_id = 'EMP-00001' THEN 15000000 ELSE 8500000 END
       ) AS overtime
FROM public.employees e
WHERE e.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND e.employee_id IN ('EMP-00001', 'EMP-00002');

SELECT '--- PENALTY AUTO-APPLY ---' AS section;
SELECT e.full_name, ap.applied_date, ap.penalty_amount, ap.status,
       ap.violation_details->>'penalizable_minutes' AS penalizable,
       ap.violation_details->>'schedule_source' AS schedule_source
FROM public.attendance_penalties ap
JOIN public.employees e ON e.id = ap.employee_id
WHERE ap.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND ap.applied_date >= '2026-06-19'::date
ORDER BY e.full_name;

SELECT '--- PRORATE SHIFT DAYS (June 2026) ---' AS section;
SELECT e.full_name,
       public.payroll_count_shift_assigned_working_days(
         e.organization_id, e.id, '2026-06-01'::date, '2026-06-30'::date, false
       ) AS shift_assigned_days,
       public.payroll_employee_prorate_ratio(
         e.organization_id, '2026-06-01'::date, '2026-06-30'::date, e.id, false
       ) AS prorate_ratio
FROM public.employees e
WHERE e.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND e.employee_id IN ('EMP-00001', 'EMP-00002');

-- Overlap guard: must fail with SQLSTATE 23514
DO $$
BEGIN
  INSERT INTO public.employee_shifts (
    organization_id, employee_id, shift_id,
    effective_from_date, effective_to_date, is_active
  ) VALUES (
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    'f1f1f1f1-1111-4111-8111-111111111102'::uuid,
    '2026-06-15', '2026-06-25', true
  );
  RAISE EXCEPTION 'OVERLAP TEST FAILED: duplicate assignment was allowed';
EXCEPTION
  WHEN SQLSTATE '23514' THEN
    RAISE NOTICE 'OVERLAP GUARD OK: %', SQLERRM;
END $$;

SELECT '--- OVERLAP GUARD ---' AS section, 'PASS (23514 on duplicate range)' AS result;
