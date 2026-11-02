-- Mengembalikan antrean tugas AI.
-- Cron ai-employee-dispatch tetap ada. Dispatch kembali hanya mengurus jadwal SOP1.
-- Tidak menghapus Product Knowledge, brief, atau log run.

DROP TRIGGER IF EXISTS ai_employee_jobs_assignment_trg ON public.daily_tasks_assigned;
DROP TRIGGER IF EXISTS ai_employee_jobs_task_request_trg ON public.daily_tasks;
DROP TRIGGER IF EXISTS ai_employee_jobs_plan_revision_trg ON public.social_media_plans;

CREATE OR REPLACE FUNCTION public.ai_employee_claim_due_schedules()
RETURNS TABLE (
  schedule_id uuid,
  employee_id uuid,
  organization_id uuid,
  sop_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT schedule.id
    FROM public.ai_employee_schedules AS schedule
    JOIN public.ai_employee_profiles AS profile
      ON profile.employee_id = schedule.employee_id
     AND profile.organization_id = schedule.organization_id
    JOIN public.employees AS employee
      ON employee.id = schedule.employee_id
     AND employee.organization_id = schedule.organization_id
    WHERE schedule.is_active
      AND profile.is_active
      AND COALESCE(employee.is_ai, false)
      AND schedule.sop_code = 'SOP1'
      AND COALESCE(profile.performance_status, '') <> 'disabled'
      AND schedule.next_run_at IS NOT NULL
      AND schedule.next_run_at <= clock_timestamp()
    ORDER BY schedule.next_run_at, schedule.id
    FOR UPDATE OF schedule SKIP LOCKED
    LIMIT 5
  LOOP
    RETURN QUERY
    UPDATE public.ai_employee_schedules AS schedule
    SET next_run_at = public.ai_employee_next_run_at(
      schedule.weekday,
      schedule.start_local,
      COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta'),
      clock_timestamp()
    )
    FROM public.ai_employee_profiles AS profile
    WHERE schedule.id = v_id
      AND profile.employee_id = schedule.employee_id
      AND profile.organization_id = schedule.organization_id
      AND schedule.next_run_at <= clock_timestamp()
    RETURNING schedule.id, schedule.employee_id, schedule.organization_id, schedule.sop_code;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_dispatch()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_row record;
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN 0;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'ai_employee_project_url'
    LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'ai_employee_internal_secret'
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table OR invalid_schema_name THEN
      RETURN 0;
  END;

  IF v_url IS NULL OR btrim(v_url) = '' OR v_secret IS NULL OR btrim(v_secret) = '' THEN
    RAISE LOG 'ai_employee_dispatch: vault secret ai_employee_project_url or ai_employee_internal_secret is missing';
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT claimed.schedule_id, claimed.employee_id
    FROM public.ai_employee_claim_due_schedules() AS claimed
  LOOP
    v_count := v_count + 1;
    PERFORM net.http_post(
      url := rtrim(v_url, '/') || '/functions/v1/ai-employee-run',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-synckerja-internal-secret', v_secret
      ),
      body := jsonb_build_object(
        'employee_id', v_row.employee_id,
        'mode', 'sop1'
      ),
      timeout_milliseconds := 120000
    );
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_claim_due_schedules() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_dispatch() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

DROP FUNCTION IF EXISTS public.mcp_ai_employee_job_counts(uuid, uuid, uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.mcp_list_ai_employee_jobs(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.ai_employee_job_finish(uuid, uuid, uuid, text, text, uuid, text, text);
DROP FUNCTION IF EXISTS public.ai_employee_job_take(uuid, uuid);
DROP FUNCTION IF EXISTS public.ai_employee_notify_missed_sop1(timestamptz);
DROP FUNCTION IF EXISTS public.ai_employee_requeue_stuck_jobs(timestamptz);
DROP FUNCTION IF EXISTS public.ai_employee_claim_due_jobs(timestamptz, uuid[]);
DROP FUNCTION IF EXISTS public.ai_employee_jobs_on_plan_revision();
DROP FUNCTION IF EXISTS public.ai_employee_jobs_on_task_request();
DROP FUNCTION IF EXISTS public.ai_employee_jobs_on_assignment();
DROP FUNCTION IF EXISTS public.ai_employee_job_put(uuid, uuid, text, uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.ai_employee_notify_reviewer(uuid, uuid, text, text, uuid, uuid);
DROP FUNCTION IF EXISTS public.ai_employee_user_may_assign(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.ai_employee_may_assign(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.ai_employee_next_morning(text, timestamptz);
DROP FUNCTION IF EXISTS public.ai_employee_in_work_hours(text, timestamptz);

DROP TABLE IF EXISTS public.ai_employee_jobs;

ALTER TABLE public.ai_employee_schedules
  DROP COLUMN IF EXISTS missed_notified_at;

ALTER TABLE public.ai_employee_schedules
  DROP COLUMN IF EXISTS last_claimed_at;
