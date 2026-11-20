-- Antrean tugas dadakan dan revisi untuk karyawan AI.
-- Cron ai-employee-dispatch yang sudah ada memanggil fungsi dispatch yang diperbarui.
-- Tabel antrean tidak dibuka ke anon, authenticated, service_role, atau runner.

ALTER TABLE public.ai_employee_schedules
  ADD COLUMN IF NOT EXISTS last_claimed_at timestamptz;

ALTER TABLE public.ai_employee_schedules
  ADD COLUMN IF NOT EXISTS missed_notified_at timestamptz;

COMMENT ON COLUMN public.ai_employee_schedules.last_claimed_at IS
  'Waktu jadwal SOP1 terakhir diklaim. Dipakai untuk alarm bila run tidak muncul.';

CREATE TABLE public.ai_employee_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  source text NOT NULL,
  daily_task_id uuid,
  plan_id uuid,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  CONSTRAINT ai_employee_jobs_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_jobs_task_fkey
    FOREIGN KEY (daily_task_id)
    REFERENCES public.daily_tasks (id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_jobs_plan_fkey
    FOREIGN KEY (plan_id)
    REFERENCES public.social_media_plans (id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_jobs_run_fkey
    FOREIGN KEY (run_id)
    REFERENCES public.ai_employee_runs (id)
    ON DELETE SET NULL,
  CONSTRAINT ai_employee_jobs_source_check CHECK (
    (source = 'task' AND daily_task_id IS NOT NULL AND plan_id IS NULL)
    OR (source = 'revision' AND plan_id IS NOT NULL AND daily_task_id IS NULL)
  ),
  CONSTRAINT ai_employee_jobs_priority_check CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  CONSTRAINT ai_employee_jobs_status_check CHECK (
    status IN ('queued', 'claimed', 'running', 'done', 'failed', 'deferred', 'rejected')
  ),
  CONSTRAINT ai_employee_jobs_attempts_check CHECK (attempts >= 0 AND attempts <= 10),
  CONSTRAINT ai_employee_jobs_reason_length CHECK (char_length(reason) <= 500)
);

CREATE UNIQUE INDEX ai_employee_jobs_active_task_idx
  ON public.ai_employee_jobs (daily_task_id)
  WHERE source = 'task' AND status IN ('queued', 'claimed', 'running', 'deferred');

CREATE UNIQUE INDEX ai_employee_jobs_active_plan_idx
  ON public.ai_employee_jobs (plan_id)
  WHERE source = 'revision' AND status IN ('queued', 'claimed', 'running', 'deferred');

CREATE INDEX ai_employee_jobs_claim_idx
  ON public.ai_employee_jobs (employee_id, status, next_attempt_at);

ALTER TABLE public.ai_employee_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_employee_jobs FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

COMMENT ON TABLE public.ai_employee_jobs IS
  'Antrean tugas dadakan dan revisi plan. Dibaca dan diubah hanya lewat fungsi pintu.';

CREATE OR REPLACE FUNCTION public.ai_employee_in_work_hours(p_time_zone text, p_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $hours$
DECLARE
  v_zone text := COALESCE(NULLIF(btrim(p_time_zone), ''), 'Asia/Jakarta');
  v_local timestamp;
BEGIN
  IF p_at IS NULL THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zone) THEN
    v_zone := 'Asia/Jakarta';
  END IF;
  v_local := timezone(v_zone, p_at);
  RETURN EXTRACT(ISODOW FROM v_local) BETWEEN 1 AND 5
    AND v_local::time >= time '08:00'
    AND v_local::time < time '17:00';
END;
$hours$;

CREATE OR REPLACE FUNCTION public.ai_employee_next_morning(p_time_zone text, p_at timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $morning$
DECLARE
  v_zone text := COALESCE(NULLIF(btrim(p_time_zone), ''), 'Asia/Jakarta');
  v_local timestamp;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zone) THEN
    v_zone := 'Asia/Jakarta';
  END IF;
  v_local := timezone(v_zone, COALESCE(p_at, clock_timestamp()));
  RETURN (date_trunc('day', v_local) + interval '1 day' + time '08:00') AT TIME ZONE v_zone;
END;
$morning$;

CREATE OR REPLACE FUNCTION public.ai_employee_may_assign(
  p_actor_employee_id uuid,
  p_ai_employee_id uuid,
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $may$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees actor
    JOIN public.user_roles role
      ON role.user_id = actor.user_id
     AND role.organization_id = p_organization_id
    WHERE actor.id = p_actor_employee_id
      AND actor.organization_id = p_organization_id
      AND lower(btrim(role.role)) IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1
    FROM public.ai_employee_profiles profile
    WHERE profile.employee_id = p_ai_employee_id
      AND profile.organization_id = p_organization_id
      AND profile.reviewer_employee_id = p_actor_employee_id
  );
$may$;

CREATE OR REPLACE FUNCTION public.ai_employee_user_may_assign(
  p_user_id uuid,
  p_ai_employee_id uuid,
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $usermay$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = p_user_id
      AND role.organization_id = p_organization_id
      AND lower(btrim(role.role)) IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1
    FROM public.employees actor
    JOIN public.ai_employee_profiles profile
      ON profile.reviewer_employee_id = actor.id
     AND profile.organization_id = p_organization_id
     AND profile.employee_id = p_ai_employee_id
    WHERE actor.user_id = p_user_id
      AND actor.organization_id = p_organization_id
  );
$usermay$;

CREATE OR REPLACE FUNCTION public.ai_employee_notify_reviewer(
  p_employee_id uuid,
  p_organization_id uuid,
  p_title text,
  p_body text,
  p_task_id uuid,
  p_plan_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $notify$
DECLARE
  v_user uuid;
BEGIN
  SELECT reviewer.user_id
  INTO v_user
  FROM public.ai_employee_profiles profile
  JOIN public.employees reviewer
    ON reviewer.id = profile.reviewer_employee_id
   AND reviewer.organization_id = profile.organization_id
  WHERE profile.employee_id = p_employee_id
    AND profile.organization_id = p_organization_id;

  IF v_user IS NULL THEN
    RETURN;
  END IF;

  IF p_plan_id IS NOT NULL THEN
    INSERT INTO public.plan_status_change_notifications (
      user_id, social_media_plan_id, organization_id, title, body, change_kind
    ) VALUES (
      v_user,
      p_plan_id,
      p_organization_id,
      left(COALESCE(p_title, ''), 200),
      left(COALESCE(p_body, ''), 500),
      'ai_employee'
    );
  ELSE
    INSERT INTO public.daily_task_notifications (
      user_id, organization_id, title, body, daily_task_id
    ) VALUES (
      v_user,
      p_organization_id,
      left(COALESCE(p_title, ''), 200),
      left(COALESCE(p_body, ''), 500),
      p_task_id
    );
  END IF;
END;
$notify$;

CREATE OR REPLACE FUNCTION public.ai_employee_job_put(
  p_employee_id uuid,
  p_organization_id uuid,
  p_source text,
  p_task_id uuid,
  p_plan_id uuid,
  p_priority text,
  p_status text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $put$
BEGIN
  INSERT INTO public.ai_employee_jobs (
    employee_id, organization_id, source, daily_task_id, plan_id,
    priority, status, reason, finished_at
  ) VALUES (
    p_employee_id,
    p_organization_id,
    p_source,
    p_task_id,
    p_plan_id,
    p_priority,
    p_status,
    left(COALESCE(p_reason, ''), 500),
    CASE WHEN p_status IN ('rejected', 'failed', 'done') THEN clock_timestamp() ELSE NULL END
  );
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.ai_employee_jobs
    SET reason = left(COALESCE(NULLIF(p_reason, ''), reason), 500),
        updated_at = clock_timestamp()
    WHERE status = 'queued'
      AND organization_id = p_organization_id
      AND (
        (p_source = 'task' AND daily_task_id = p_task_id)
        OR (p_source = 'revision' AND plan_id = p_plan_id)
      );
END;
$put$;

CREATE OR REPLACE FUNCTION public.ai_employee_jobs_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $assign$
DECLARE
  v_priority text;
  v_ai boolean;
BEGIN
  SELECT COALESCE(employee.is_ai, false)
  INTO v_ai
  FROM public.employees employee
  WHERE employee.id = NEW.employee_id
    AND employee.organization_id = NEW.organization_id;

  IF NOT COALESCE(v_ai, false) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_employee_profiles profile
    WHERE profile.employee_id = NEW.employee_id
      AND profile.organization_id = NEW.organization_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT CASE lower(btrim(COALESCE(task.priority, 'medium')))
    WHEN 'urgent' THEN 'urgent'
    WHEN 'high' THEN 'high'
    WHEN 'low' THEN 'low'
    ELSE 'medium'
  END
  INTO v_priority
  FROM public.daily_tasks task
  WHERE task.id = NEW.daily_task_id
    AND task.organization_id = NEW.organization_id;

  IF public.ai_employee_may_assign(NEW.assigned_by, NEW.employee_id, NEW.organization_id) THEN
    PERFORM public.ai_employee_job_put(
      NEW.employee_id, NEW.organization_id, 'task', NEW.daily_task_id, NULL,
      COALESCE(v_priority, 'medium'), 'queued', ''
    );
  ELSE
    PERFORM public.ai_employee_job_put(
      NEW.employee_id, NEW.organization_id, 'task', NEW.daily_task_id, NULL,
      COALESCE(v_priority, 'medium'), 'rejected', 'Bukan owner, admin, atau reviewer.'
    );
  END IF;
  RETURN NEW;
END;
$assign$;

CREATE OR REPLACE FUNCTION public.ai_employee_jobs_on_task_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $request$
DECLARE
  v_priority text;
  v_ai boolean;
BEGIN
  IF NEW.requested_ai_employee_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.requested_ai_employee_id IS NOT DISTINCT FROM OLD.requested_ai_employee_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(employee.is_ai, false)
  INTO v_ai
  FROM public.employees employee
  WHERE employee.id = NEW.requested_ai_employee_id
    AND employee.organization_id = NEW.organization_id;
  IF NOT COALESCE(v_ai, false) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_employee_profiles profile
    WHERE profile.employee_id = NEW.requested_ai_employee_id
      AND profile.organization_id = NEW.organization_id
  ) THEN
    RETURN NEW;
  END IF;

  v_priority := CASE lower(btrim(COALESCE(NEW.priority, 'medium')))
    WHEN 'urgent' THEN 'urgent'
    WHEN 'high' THEN 'high'
    WHEN 'low' THEN 'low'
    ELSE 'medium'
  END;

  IF public.ai_employee_user_may_assign(NEW.created_by, NEW.requested_ai_employee_id, NEW.organization_id) THEN
    PERFORM public.ai_employee_job_put(
      NEW.requested_ai_employee_id, NEW.organization_id, 'task', NEW.id, NULL,
      v_priority, 'queued', ''
    );
  ELSE
    PERFORM public.ai_employee_job_put(
      NEW.requested_ai_employee_id, NEW.organization_id, 'task', NEW.id, NULL,
      v_priority, 'rejected', 'Bukan owner, admin, atau reviewer.'
    );
  END IF;
  RETURN NEW;
END;
$request$;

CREATE OR REPLACE FUNCTION public.ai_employee_jobs_on_plan_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $revision$
DECLARE
  v_ai boolean;
  v_done integer;
  v_reason text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'Request Revision' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.author_employee_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(employee.is_ai, false)
  INTO v_ai
  FROM public.employees employee
  WHERE employee.id = NEW.author_employee_id
    AND employee.organization_id = NEW.organization_id;
  IF NOT COALESCE(v_ai, false) THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::integer
  INTO v_done
  FROM public.ai_employee_jobs job
  WHERE job.plan_id = NEW.id
    AND job.source = 'revision'
    AND job.status = 'done';

  SELECT left(btrim(feedback.reason), 500)
  INTO v_reason
  FROM public.ai_employee_feedback feedback
  WHERE feedback.object_id = NEW.id
    AND feedback.organization_id = NEW.organization_id
    AND feedback.object_type = 'plan'
    AND feedback.employee_id = NEW.author_employee_id
  ORDER BY feedback.created_at DESC
  LIMIT 1;

  IF COALESCE(v_done, 0) >= 2 OR COALESCE(NEW.revision_count, 0) > 2 THEN
    PERFORM public.ai_employee_job_put(
      NEW.author_employee_id, NEW.organization_id, 'revision', NULL, NEW.id,
      'high', 'rejected', 'Revisi sudah 2 kali. Plan kembali ke reviewer.'
    );
    PERFORM public.ai_employee_notify_reviewer(
      NEW.author_employee_id,
      NEW.organization_id,
      'Revisi plan berhenti',
      'Revisi sudah 2 kali. Plan kembali ke reviewer.',
      NULL,
      NEW.id
    );
  ELSE
    PERFORM public.ai_employee_job_put(
      NEW.author_employee_id, NEW.organization_id, 'revision', NULL, NEW.id,
      'high', 'queued', COALESCE(NULLIF(v_reason, ''), 'Plan ditolak reviewer.')
    );
  END IF;
  RETURN NEW;
END;
$revision$;

DROP TRIGGER IF EXISTS ai_employee_jobs_assignment_trg ON public.daily_tasks_assigned;
CREATE TRIGGER ai_employee_jobs_assignment_trg
  AFTER INSERT OR UPDATE OF employee_id ON public.daily_tasks_assigned
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_employee_jobs_on_assignment();

DROP TRIGGER IF EXISTS ai_employee_jobs_task_request_trg ON public.daily_tasks;
CREATE TRIGGER ai_employee_jobs_task_request_trg
  AFTER INSERT OR UPDATE OF requested_ai_employee_id ON public.daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_employee_jobs_on_task_request();

DROP TRIGGER IF EXISTS ai_employee_jobs_plan_revision_trg ON public.social_media_plans;
CREATE TRIGGER ai_employee_jobs_plan_revision_trg
  AFTER UPDATE OF status ON public.social_media_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_employee_jobs_on_plan_revision();

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
AS $claimsched$
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
        ),
        last_claimed_at = clock_timestamp()
    FROM public.ai_employee_profiles AS profile
    WHERE schedule.id = v_id
      AND profile.employee_id = schedule.employee_id
      AND profile.organization_id = schedule.organization_id
      AND schedule.next_run_at <= clock_timestamp()
    RETURNING schedule.id, schedule.employee_id, schedule.organization_id, schedule.sop_code;
  END LOOP;
END;
$claimsched$;

CREATE OR REPLACE FUNCTION public.ai_employee_claim_due_jobs(
  p_at timestamptz DEFAULT clock_timestamp(),
  p_exclude uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE (
  job_id uuid,
  employee_id uuid,
  organization_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $claimjob$
DECLARE
  v_job_id uuid;
  v_employee uuid;
  v_org uuid;
  v_count integer := 0;
BEGIN
  LOOP
    EXIT WHEN v_count >= 3;
    v_job_id := NULL;
    SELECT job.id
    INTO v_job_id
    FROM public.ai_employee_jobs AS job
    JOIN public.ai_employee_profiles AS profile
      ON profile.employee_id = job.employee_id
     AND profile.organization_id = job.organization_id
    JOIN public.employees AS employee
      ON employee.id = job.employee_id
     AND employee.organization_id = job.organization_id
    WHERE job.status IN ('queued', 'deferred')
      AND job.next_attempt_at <= p_at
      AND profile.is_active
      AND COALESCE(employee.is_ai, false)
      AND COALESCE(profile.performance_status, '') <> 'disabled'
      AND NOT (job.employee_id = ANY (COALESCE(p_exclude, '{}'::uuid[])))
      AND NOT EXISTS (
        SELECT 1
        FROM public.ai_employee_jobs busy
        WHERE busy.employee_id = job.employee_id
          AND busy.status IN ('claimed', 'running')
      )
      AND (
        job.priority = 'urgent'
        OR public.ai_employee_in_work_hours(
          COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta'),
          p_at
        )
      )
    ORDER BY CASE job.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      job.created_at,
      job.id
    FOR UPDATE OF job SKIP LOCKED
    LIMIT 1;

    EXIT WHEN v_job_id IS NULL;

    v_employee := NULL;
    v_org := NULL;
    UPDATE public.ai_employee_jobs AS job
    SET status = 'claimed',
        claimed_at = p_at,
        updated_at = clock_timestamp()
    WHERE job.id = v_job_id
      AND job.status IN ('queued', 'deferred')
    RETURNING job.employee_id, job.organization_id
    INTO v_employee, v_org;

    EXIT WHEN v_employee IS NULL;

    job_id := v_job_id;
    employee_id := v_employee;
    organization_id := v_org;
    RETURN NEXT;
    v_count := v_count + 1;
  END LOOP;
END;
$claimjob$;

CREATE OR REPLACE FUNCTION public.ai_employee_requeue_stuck_jobs(p_at timestamptz DEFAULT clock_timestamp())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $stuck$
DECLARE
  v_job public.ai_employee_jobs%ROWTYPE;
  v_count integer := 0;
  v_attempts integer;
BEGIN
  FOR v_job IN
    SELECT job.*
    FROM public.ai_employee_jobs AS job
    WHERE job.status IN ('claimed', 'running')
      AND job.claimed_at IS NOT NULL
      AND job.claimed_at <= p_at - interval '15 minutes'
    ORDER BY job.claimed_at, job.id
    FOR UPDATE OF job SKIP LOCKED
  LOOP
    v_attempts := v_job.attempts + 1;
    v_count := v_count + 1;
    IF v_attempts >= 3 THEN
      UPDATE public.ai_employee_jobs
      SET status = 'failed',
          attempts = v_attempts,
          reason = 'Job macet 3 kali.',
          finished_at = p_at,
          updated_at = clock_timestamp()
      WHERE id = v_job.id;
      PERFORM public.ai_employee_notify_reviewer(
        v_job.employee_id,
        v_job.organization_id,
        'Job karyawan AI gagal',
        'Job macet 3 kali.',
        v_job.daily_task_id,
        v_job.plan_id
      );
    ELSE
      UPDATE public.ai_employee_jobs
      SET status = 'queued',
          attempts = v_attempts,
          claimed_at = NULL,
          next_attempt_at = p_at,
          updated_at = clock_timestamp()
      WHERE id = v_job.id;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$stuck$;

CREATE OR REPLACE FUNCTION public.ai_employee_notify_missed_sop1(p_at timestamptz DEFAULT clock_timestamp())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $missed$
DECLARE
  v_row record;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT schedule.id, schedule.employee_id, schedule.organization_id, schedule.last_claimed_at
    FROM public.ai_employee_schedules AS schedule
    WHERE schedule.sop_code = 'SOP1'
      AND schedule.last_claimed_at IS NOT NULL
      AND schedule.last_claimed_at <= p_at - interval '15 minutes'
      AND (schedule.missed_notified_at IS NULL OR schedule.missed_notified_at < schedule.last_claimed_at)
      AND NOT EXISTS (
        SELECT 1
        FROM public.ai_employee_runs run
        WHERE run.employee_id = schedule.employee_id
          AND run.organization_id = schedule.organization_id
          AND run.sop_code = 'SOP1'
          AND run.started_at >= schedule.last_claimed_at
          AND run.started_at < schedule.last_claimed_at + interval '15 minutes'
      )
    ORDER BY schedule.last_claimed_at, schedule.id
  LOOP
    PERFORM public.ai_employee_notify_reviewer(
      v_row.employee_id,
      v_row.organization_id,
      'SOP1 tidak berjalan',
      'Jadwal SOP1 sudah diklaim, tetapi tidak ada log run dalam 15 menit.',
      NULL,
      NULL
    );
    UPDATE public.ai_employee_schedules
    SET missed_notified_at = p_at
    WHERE id = v_row.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$missed$;

CREATE OR REPLACE FUNCTION public.ai_employee_dispatch()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $dispatch$
DECLARE
  v_url text;
  v_secret text;
  v_row record;
  v_count integer := 0;
  v_busy uuid[] := '{}'::uuid[];
BEGIN
  PERFORM public.ai_employee_requeue_stuck_jobs();
  PERFORM public.ai_employee_notify_missed_sop1();

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
    v_busy := v_busy || v_row.employee_id;
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

  FOR v_row IN
    SELECT claimed.job_id, claimed.employee_id
    FROM public.ai_employee_claim_due_jobs(clock_timestamp(), v_busy) AS claimed
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
        'mode', 'job',
        'job_id', v_row.job_id
      ),
      timeout_milliseconds := 120000
    );
  END LOOP;

  RETURN v_count;
END;
$dispatch$;

COMMENT ON FUNCTION public.ai_employee_dispatch() IS
  'Cron tiap menit. Jadwal SOP1 diklaim lebih dulu. Tanpa jatuh tempo dan tanpa job, tidak ada HTTP.';

CREATE OR REPLACE FUNCTION public.ai_employee_job_take(p_employee_id uuid, p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $take$
DECLARE
  v_job public.ai_employee_jobs%ROWTYPE;
  v_task public.daily_tasks%ROWTYPE;
  v_plan public.social_media_plans%ROWTYPE;
  v_done integer := 0;
BEGIN
  UPDATE public.ai_employee_jobs
  SET status = 'running',
      updated_at = clock_timestamp()
  WHERE id = p_job_id
    AND employee_id = p_employee_id
    AND status = 'claimed'
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_job.source = 'task' THEN
    SELECT * INTO v_task FROM public.daily_tasks WHERE id = v_job.daily_task_id;
  ELSE
    SELECT * INTO v_plan FROM public.social_media_plans WHERE id = v_job.plan_id;
    SELECT count(*)::integer INTO v_done
    FROM public.ai_employee_jobs job
    WHERE job.plan_id = v_job.plan_id
      AND job.source = 'revision'
      AND job.status = 'done';
  END IF;

  RETURN jsonb_build_object(
    'id', v_job.id,
    'source', v_job.source,
    'priority', v_job.priority,
    'reason', v_job.reason,
    'task_id', v_job.daily_task_id,
    'task_title', COALESCE(v_task.title, ''),
    'task_description', COALESCE(v_task.description, ''),
    'plan_id', v_job.plan_id,
    'plan_title', COALESCE(v_plan.title, ''),
    'plan_brief', COALESCE(v_plan.brief, ''),
    'revision_count', COALESCE(v_plan.revision_count, 0),
    'done_revisions', v_done
  );
END;
$take$;

CREATE OR REPLACE FUNCTION public.ai_employee_job_finish(
  p_employee_id uuid,
  p_job_id uuid,
  p_run_id uuid,
  p_status text,
  p_reason text,
  p_plan_id uuid,
  p_title text,
  p_brief text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $finish$
DECLARE
  v_job public.ai_employee_jobs%ROWTYPE;
  v_org uuid;
  v_zone text;
  v_step uuid;
  v_assigner uuid;
  v_done integer;
  v_rows bigint;
  v_token text;
  v_reason text := left(COALESCE(p_reason, ''), 500);
BEGIN
  IF p_status NOT IN ('done', 'failed', 'rejected', 'deferred') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_job
  FROM public.ai_employee_jobs
  WHERE id = p_job_id
    AND employee_id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_job.status IN ('done', 'failed', 'rejected') THEN
    RETURN jsonb_build_object('ok', true, 'status', v_job.status);
  END IF;
  IF p_status = 'deferred' AND v_job.status = 'deferred' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'deferred');
  END IF;
  IF v_job.status NOT IN ('claimed', 'running') THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  v_org := v_job.organization_id;

  IF p_status = 'deferred' THEN
    SELECT COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta')
    INTO v_zone
    FROM public.ai_employee_profiles profile
    WHERE profile.employee_id = p_employee_id
      AND profile.organization_id = v_org;
    UPDATE public.ai_employee_jobs
    SET status = 'deferred',
        run_id = COALESCE(p_run_id, run_id),
        reason = COALESCE(NULLIF(v_reason, ''), 'Kuota model habis.'),
        next_attempt_at = public.ai_employee_next_morning(COALESCE(v_zone, 'Asia/Jakarta'), clock_timestamp()),
        claimed_at = NULL,
        updated_at = clock_timestamp()
    WHERE id = v_job.id;
    PERFORM public.ai_employee_notify_reviewer(
      p_employee_id, v_org, 'Job ditunda', 'Kuota model habis. Job dilanjutkan besok pukul 08:00.',
      v_job.daily_task_id, v_job.plan_id
    );
    RETURN jsonb_build_object('ok', true, 'status', 'deferred');
  END IF;

  IF p_status = 'done' AND v_job.source = 'revision' THEN
    SELECT count(*)::integer INTO v_done
    FROM public.ai_employee_jobs job
    WHERE job.plan_id = v_job.plan_id
      AND job.source = 'revision'
      AND job.status = 'done';
    IF COALESCE(v_done, 0) >= 2 THEN
      p_status := 'rejected';
      v_reason := 'Revisi sudah 2 kali. Plan kembali ke reviewer.';
    ELSE
      v_token := gen_random_uuid()::text;
      INSERT INTO public.ai_employee_brief_tickets (plan_id, token)
      VALUES (v_job.plan_id, v_token)
      ON CONFLICT (plan_id) DO UPDATE
        SET token = EXCLUDED.token, created_at = clock_timestamp();
      PERFORM set_config('ai_employee.brief_write', v_token, true);
      UPDATE public.social_media_plans
      SET title = CASE
            WHEN NULLIF(btrim(COALESCE(p_title, '')), '') IS NULL THEN title
            ELSE left(btrim(p_title), 200)
          END,
          brief = CASE
            WHEN NULLIF(btrim(COALESCE(p_brief, '')), '') IS NULL THEN brief
            ELSE left(p_brief, 8000)
          END,
          updated_at = clock_timestamp()
      WHERE id = v_job.plan_id
        AND organization_id = v_org
        AND author_employee_id = p_employee_id
        AND status = 'Request Revision';
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows IS DISTINCT FROM 1 THEN
        PERFORM set_config('ai_employee.brief_write', '', true);
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      DELETE FROM public.ai_employee_brief_tickets
      WHERE plan_id = v_job.plan_id
        AND token = v_token;
      PERFORM set_config('ai_employee.brief_write', '', true);
    END IF;
  END IF;

  IF p_status = 'rejected' AND v_job.source = 'task' THEN
    INSERT INTO public.task_steps (task_id, title, description, "order")
    VALUES (
      v_job.daily_task_id,
      'Di luar job desk',
      left(COALESCE(NULLIF(v_reason, ''), 'Di luar job desk.'), 2000),
      1
    );
    UPDATE public.daily_tasks
    SET has_steps = true, updated_at = clock_timestamp()
    WHERE id = v_job.daily_task_id;
  END IF;

  IF p_status = 'done' AND v_job.source = 'task' AND p_plan_id IS NOT NULL THEN
    INSERT INTO public.task_steps (task_id, title, description, "order", social_media_plan_id)
    VALUES (
      v_job.daily_task_id,
      left(COALESCE(NULLIF(btrim(p_title), ''), 'Content plan'), 200),
      left(COALESCE(p_brief, ''), 2000),
      1,
      p_plan_id
    )
    RETURNING id INTO v_step;
    UPDATE public.daily_tasks
    SET has_steps = true, updated_at = clock_timestamp()
    WHERE id = v_job.daily_task_id
      AND status IS DISTINCT FROM 'completed';

    SELECT assigned.assigned_by
    INTO v_assigner
    FROM public.daily_tasks_assigned assigned
    WHERE assigned.daily_task_id = v_job.daily_task_id
    ORDER BY assigned.assigned_at DESC
    LIMIT 1;
    IF v_assigner IS NULL THEN
      SELECT profile.reviewer_employee_id
      INTO v_assigner
      FROM public.ai_employee_profiles profile
      WHERE profile.employee_id = p_employee_id
        AND profile.organization_id = v_org;
    END IF;
    IF v_assigner IS NOT NULL THEN
      INSERT INTO public.completion_approvals (
        organization_id, entity_type, daily_task_id, task_step_id,
        assignee_employee_id, assigner_employee_id, status
      ) VALUES (
        v_org, 'step', v_job.daily_task_id, v_step,
        p_employee_id, v_assigner, 'pending'
      );
    END IF;
  END IF;

  IF p_status = 'rejected' THEN
    PERFORM public.ai_employee_notify_reviewer(
      p_employee_id, v_org, 'Job ditolak', COALESCE(NULLIF(v_reason, ''), 'Job ditolak.'),
      v_job.daily_task_id, v_job.plan_id
    );
  ELSIF p_status = 'failed' THEN
    PERFORM public.ai_employee_notify_reviewer(
      p_employee_id, v_org, 'Job gagal', COALESCE(NULLIF(v_reason, ''), 'Job gagal.'),
      v_job.daily_task_id, v_job.plan_id
    );
  END IF;

  UPDATE public.ai_employee_jobs
  SET status = p_status,
      run_id = COALESCE(p_run_id, run_id),
      reason = COALESCE(NULLIF(v_reason, ''), reason),
      finished_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE id = v_job.id;

  RETURN jsonb_build_object('ok', true, 'status', p_status, 'plan_id', COALESCE(p_plan_id, v_job.plan_id));
END;
$finish$;

CREATE OR REPLACE FUNCTION public.mcp_list_ai_employee_jobs(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $list$
DECLARE
  v_rows jsonb;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = p_user_id
      AND role.organization_id = p_organization_id
      AND lower(btrim(role.role)) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees employee
    WHERE employee.id = p_employee_id
      AND employee.organization_id = p_organization_id
      AND COALESCE(employee.is_ai, false)
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT job.id, job.source, job.priority, job.status, job.attempts,
           job.reason, job.daily_task_id, job.plan_id, job.run_id,
           job.next_attempt_at, job.created_at, job.claimed_at, job.finished_at
    FROM public.ai_employee_jobs job
    WHERE job.employee_id = p_employee_id
      AND job.organization_id = p_organization_id
    ORDER BY job.created_at DESC
    LIMIT 20
  ) x;
  RETURN v_rows;
END;
$list$;

CREATE OR REPLACE FUNCTION public.mcp_ai_employee_job_counts(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $counts$
DECLARE
  v_done integer;
  v_rejected integer;
  v_failed integer;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_employee_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = p_user_id
      AND role.organization_id = p_organization_id
      AND lower(btrim(role.role)) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT
    count(*) FILTER (WHERE job.status = 'done')::integer,
    count(*) FILTER (WHERE job.status = 'rejected')::integer,
    count(*) FILTER (WHERE job.status = 'failed')::integer
  INTO v_done, v_rejected, v_failed
  FROM public.ai_employee_jobs job
  WHERE job.employee_id = p_employee_id
    AND job.organization_id = p_organization_id
    AND job.finished_at >= p_start
    AND job.finished_at < p_end;

  RETURN jsonb_build_object(
    'done', COALESCE(v_done, 0),
    'rejected', COALESCE(v_rejected, 0),
    'failed', COALESCE(v_failed, 0)
  );
END;
$counts$;

REVOKE ALL ON FUNCTION public.ai_employee_in_work_hours(text, timestamptz) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_next_morning(text, timestamptz) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_may_assign(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_user_may_assign(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_notify_reviewer(uuid, uuid, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_job_put(uuid, uuid, text, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_jobs_on_assignment() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_jobs_on_task_request() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_jobs_on_plan_revision() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_claim_due_schedules() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_claim_due_jobs(timestamptz, uuid[]) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_requeue_stuck_jobs(timestamptz) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_notify_missed_sop1(timestamptz) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_dispatch() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_job_take(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_job_finish(uuid, uuid, uuid, text, text, uuid, text, text) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_job_take(uuid, uuid) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_job_finish(uuid, uuid, uuid, text, text, uuid, text, text) TO ai_employee_runner;
REVOKE ALL ON FUNCTION public.mcp_list_ai_employee_jobs(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.mcp_ai_employee_job_counts(uuid, uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.mcp_list_ai_employee_jobs(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_ai_employee_job_counts(uuid, uuid, uuid, timestamptz, timestamptz) TO service_role;
