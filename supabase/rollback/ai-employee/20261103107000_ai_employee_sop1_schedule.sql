-- Rollback 20261103107000_ai_employee_sop1_schedule.sql

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-employee-dispatch') THEN
      PERFORM cron.unschedule('ai-employee-dispatch');
    END IF;
  END IF;
END
$cron$;

DROP TRIGGER IF EXISTS ai_employee_profiles_retarget_schedules ON public.ai_employee_profiles;
DROP TRIGGER IF EXISTS ai_employee_schedules_next_run ON public.ai_employee_schedules;

DROP FUNCTION IF EXISTS public.ai_employee_dispatch();
DROP FUNCTION IF EXISTS public.ai_employee_claim_due_schedules();
DROP FUNCTION IF EXISTS public.ai_employee_profiles_retarget_schedules();
DROP FUNCTION IF EXISTS public.ai_employee_schedules_set_next_run();
DROP FUNCTION IF EXISTS public.ai_employee_next_run_at(smallint, time, text, timestamptz);

DROP INDEX IF EXISTS public.ai_employee_schedules_due_idx;

ALTER TABLE public.ai_employee_schedules
  DROP CONSTRAINT IF EXISTS ai_employee_schedules_due_after_start;

ALTER TABLE public.ai_employee_schedules
  DROP COLUMN IF EXISTS next_run_at;

REVOKE UPDATE ON TABLE public.ai_employee_schedules FROM authenticated;
GRANT UPDATE ON TABLE public.ai_employee_schedules TO authenticated;
