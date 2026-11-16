-- Fix: edge ai-employee-run invokes RPCs as ai_employee_runner (same as SOP1).
REVOKE ALL ON FUNCTION public.ai_employee_sop4_manual_begin(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_sop4_manual_begin(uuid, uuid) TO ai_employee_runner;
