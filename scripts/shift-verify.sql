-- Shift logic deploy smoke check (run after supabase db push)
-- Org demo: Synckerja 663c9336-8cb6-4a36-9ad9-313126e70a1a

SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'resolve_effective_schedule',
    'validate_attendance_comprehensive',
    'record_attendance_with_timezone',
    'payroll_calculate_overtime_pay',
    'apply_late_arrival_penalties',
    'payroll_count_shift_assigned_working_days',
    'pg_dow_to_app_dow',
    'is_app_working_day'
  )
ORDER BY proname;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'attendance_records'
  AND column_name IN ('shift_id', 'employee_shift_id');

-- Resolver: OCTA Shift Pagi 08:00, Aidah Shift Siang 13:00 (+ break_duration)
SELECT e.full_name, r.source, s.name AS shift_name, r.start_time, r.end_time,
       r.break_duration_minutes, r.is_working_day
FROM employees e
CROSS JOIN LATERAL public.resolve_effective_schedule(
  e.id,
  e.organization_id,
  CURRENT_DATE
) r
LEFT JOIN shifts s ON s.id = r.shift_id
WHERE e.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
  AND e.employee_id IN ('EMP-00001', 'EMP-00002')
ORDER BY e.full_name;

-- Overtime golden: checkout 18:30 on 2026-05-20
-- OCTA shift end 17:00 + break 60 = OT from 18:00 → 30 min (not 90)
-- Aidah shift end 22:00 → 0 min at 18:30 checkout
SELECT e.full_name,
       public.payroll_calculate_overtime_pay(
         '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
         e.id,
         '2026-05-01'::date,
         '2026-05-31'::date,
         CASE WHEN e.employee_id = 'EMP-00001' THEN 15000000 ELSE 8500000 END
       ) AS overtime
FROM employees e
WHERE e.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
  AND e.employee_id IN ('EMP-00001', 'EMP-00002');

-- DOW helper sanity
SELECT public.pg_dow_to_app_dow(0) AS sunday_is_7,
       public.is_app_working_day(ARRAY[1,2,3,4,5], CURRENT_DATE) AS weekday_check;
