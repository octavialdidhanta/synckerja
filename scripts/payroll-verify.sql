-- Payroll deploy smoke check (run after supabase db push)
SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'process_payroll_run',
    'calculate_payroll_run_totals',
    'mark_payroll_run_paid',
    'payroll_calculate_employee',
    'payroll_calculate_pph21_ter_v2'
  )
ORDER BY proname;

SELECT has_function_privilege('authenticated', 'public.process_payroll_run(uuid)', 'EXECUTE') AS process_run_auth,
       has_function_privilege('authenticated', 'public.mark_payroll_run_paid(uuid, text, text)', 'EXECUTE') AS mark_paid_auth;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'employee_payroll_calculations'
  AND column_name IN ('payout_snapshot', 'tax_breakdown', 'calculation_details');

SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_ter_brackets') AS ter_brackets,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_audit_log') AS audit_log;
