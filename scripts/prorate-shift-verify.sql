-- Prorate shift-assigned days smoke check (run after supabase db push)
-- Org demo: Synckerja 663c9336-8cb6-4a36-9ad9-313126e70a1a

SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'payroll_count_working_days',
    'payroll_count_shift_assigned_working_days',
    'payroll_employee_prorate_ratio',
    'pg_dow_to_app_dow'
  )
ORDER BY proname;

-- DOW fix: Sunday should map to 7, not 0
SELECT public.pg_dow_to_app_dow(0) AS sunday_app_dow;

-- Mei 2026 prorate ratios for OCTA (shift) vs hypothetical non-shift
SELECT e.full_name,
       e.employee_id,
       public.payroll_count_shift_assigned_working_days(
         e.organization_id, e.id, '2026-05-01'::date, '2026-05-31'::date, false
       ) AS shift_assigned_days,
       public.payroll_employee_prorate_ratio(
         e.organization_id, '2026-05-01'::date, '2026-05-31'::date, e.id, false
       ) AS prorate_ratio
FROM public.employees e
WHERE e.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND e.employee_id IN ('EMP-00001', 'EMP-00002')
ORDER BY e.full_name;

-- Compare WSS-only count (legacy) vs shift count for OCTA
SELECT
  public.payroll_count_working_days(
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '2026-05-01'::date,
    '2026-05-31'::date,
    ARRAY[1,2,3,4,5,6,7],
    false
  ) AS wss_working_days_may,
  public.payroll_count_shift_assigned_working_days(
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid,
    '2026-05-01'::date,
    '2026-05-31'::date,
    false
  ) AS octa_shift_days_may;
