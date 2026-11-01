-- Rollback 20261101151000_ai_employee_profile.sql

DROP TRIGGER IF EXISTS ai_employee_profiles_status_guard ON public.ai_employee_profiles;

DROP FUNCTION IF EXISTS public.ai_employee_set_performance_status(uuid, text);
DROP FUNCTION IF EXISTS public.ai_employee_status_guard();

DROP TABLE IF EXISTS public.ai_employee_status_tickets;
DROP TABLE IF EXISTS public.ai_employee_permissions;
DROP TABLE IF EXISTS public.ai_employee_schedules;
DROP TABLE IF EXISTS public.ai_employee_sop_steps;
DROP TABLE IF EXISTS public.ai_employee_sops;
DROP TABLE IF EXISTS public.ai_employee_profiles;
