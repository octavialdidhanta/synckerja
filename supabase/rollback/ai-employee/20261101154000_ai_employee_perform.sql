-- Rollback 20261101154000_ai_employee_perform.sql

DROP FUNCTION IF EXISTS public.ai_employee_perform(uuid, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.ai_employee_refresh_krs(uuid);
DROP FUNCTION IF EXISTS public.ai_employee_context(uuid, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.ai_employee_reserve_model_call(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.ai_employee_run_finish(uuid, uuid, text, integer, integer, uuid[], text);
DROP FUNCTION IF EXISTS public.ai_employee_run_start(uuid, text);
DROP FUNCTION IF EXISTS public.ai_employee_notify_reviewer(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.ai_employee_assert_task(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.ai_employee_require_run(uuid, uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_employee_runner') THEN
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ai_employee_runner';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ai_employee_runner';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ai_employee_runner';
    EXECUTE 'REVOKE USAGE ON SCHEMA public FROM ai_employee_runner';
    EXECUTE 'REVOKE ai_employee_runner FROM authenticator';
    DROP ROLE ai_employee_runner;
  END IF;
END $$;
