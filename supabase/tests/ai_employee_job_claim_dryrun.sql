-- Dry run perbaikan klaim antrean AI. Satu transaksi, diakhiri ROLLBACK. Jangan tambah COMMIT.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Perbaikan antrean 6+7. File 20261103110000 tidak diubah.
-- Penugas dibaca dari auth.uid(). Token klaim membatalkan proses yang kalah klaim.

ALTER TABLE public.ai_employee_jobs
  ADD COLUMN IF NOT EXISTS claim_token uuid;

ALTER TABLE public.ai_employee_runs
  ADD COLUMN IF NOT EXISTS job_id uuid;

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_employee_runs_job_id_fkey'
      AND conrelid = 'public.ai_employee_runs'::regclass
  ) THEN
    ALTER TABLE public.ai_employee_runs
      ADD CONSTRAINT ai_employee_runs_job_id_fkey
      FOREIGN KEY (job_id)
      REFERENCES public.ai_employee_jobs (id)
      ON DELETE SET NULL;
  END IF;
END
$fk$;

COMMENT ON COLUMN public.ai_employee_jobs.claim_token IS
  'Diganti setiap kali job diklaim. Proses dengan token lama ditolak.';

CREATE OR REPLACE FUNCTION public.ai_employee_caller_is_service()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $svc$
  SELECT COALESCE(auth.role(), '') = 'service_role';
$svc$;

CREATE OR REPLACE FUNCTION public.ai_employee_queue_actor_reason(
  p_ai_employee_id uuid,
  p_organization_id uuid,
  p_fallback_user_id uuid,
  p_fallback_employee_id uuid,
  p_allow_service boolean
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $actor$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL THEN
    IF public.ai_employee_user_may_assign(v_uid, p_ai_employee_id, p_organization_id) THEN
      RETURN NULL;
    END IF;
    RETURN 'Bukan owner, admin, atau reviewer.';
  END IF;

  IF COALESCE(p_allow_service, false) AND public.ai_employee_caller_is_service() THEN
    IF p_fallback_user_id IS NOT NULL
      AND public.ai_employee_user_may_assign(p_fallback_user_id, p_ai_employee_id, p_organization_id) THEN
      RETURN NULL;
    END IF;
    IF p_fallback_employee_id IS NOT NULL
      AND public.ai_employee_may_assign(p_fallback_employee_id, p_ai_employee_id, p_organization_id) THEN
      RETURN NULL;
    END IF;
    IF p_fallback_user_id IS NULL AND p_fallback_employee_id IS NULL THEN
      RETURN 'Penugas tidak teridentifikasi.';
    END IF;
    RETURN 'Bukan owner, admin, atau reviewer.';
  END IF;

  RETURN 'Penugas tidak teridentifikasi.';
END;
$actor$;

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
    IF p_status = 'queued' THEN
      UPDATE public.ai_employee_jobs
      SET reason = left(COALESCE(NULLIF(p_reason, ''), reason), 500),
          updated_at = clock_timestamp()
      WHERE status = 'queued'
        AND organization_id = p_organization_id
        AND (
          (p_source = 'task' AND daily_task_id = p_task_id)
          OR (p_source = 'revision' AND plan_id = p_plan_id)
        );
    END IF;
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
  v_reason text;
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

  v_reason := public.ai_employee_queue_actor_reason(
    NEW.employee_id, NEW.organization_id, NULL, NEW.assigned_by, true
  );
  IF v_reason IS NULL THEN
    PERFORM public.ai_employee_job_put(
      NEW.employee_id, NEW.organization_id, 'task', NEW.daily_task_id, NULL,
      COALESCE(v_priority, 'medium'), 'queued', ''
    );
  ELSE
    PERFORM public.ai_employee_job_put(
      NEW.employee_id, NEW.organization_id, 'task', NEW.daily_task_id, NULL,
      COALESCE(v_priority, 'medium'), 'rejected', v_reason
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
  v_reason text;
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

  v_reason := public.ai_employee_queue_actor_reason(
    NEW.requested_ai_employee_id, NEW.organization_id, NEW.created_by, NULL, true
  );
  IF v_reason IS NULL THEN
    PERFORM public.ai_employee_job_put(
      NEW.requested_ai_employee_id, NEW.organization_id, 'task', NEW.id, NULL,
      v_priority, 'queued', ''
    );
  ELSE
    PERFORM public.ai_employee_job_put(
      NEW.requested_ai_employee_id, NEW.organization_id, 'task', NEW.id, NULL,
      v_priority, 'rejected', v_reason
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
  v_actor text;
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

  v_actor := public.ai_employee_queue_actor_reason(
    NEW.author_employee_id, NEW.organization_id, NULL, NULL, false
  );
  IF v_actor IS NOT NULL THEN
    PERFORM public.ai_employee_job_put(
      NEW.author_employee_id, NEW.organization_id, 'revision', NULL, NEW.id,
      'high', 'rejected', v_actor
    );
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
        claim_token = gen_random_uuid(),
        run_id = NULL,
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
          claim_token = NULL,
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
          claim_token = NULL,
          run_id = NULL,
          next_attempt_at = p_at,
          updated_at = clock_timestamp()
      WHERE id = v_job.id;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$stuck$;

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
    AND claim_token IS NOT NULL
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
    'claim_token', v_job.claim_token,
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

DROP FUNCTION IF EXISTS public.ai_employee_job_finish(uuid, uuid, uuid, text, text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.ai_employee_job_finish(
  p_employee_id uuid,
  p_job_id uuid,
  p_run_id uuid,
  p_status text,
  p_reason text,
  p_plan_id uuid,
  p_title text,
  p_brief text,
  p_claim_token uuid
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
  IF p_claim_token IS NULL OR v_job.claim_token IS DISTINCT FROM p_claim_token THEN
    RAISE EXCEPTION 'stale_claim' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.ai_employee_job_bind(
  p_employee_id uuid,
  p_job_id uuid,
  p_run_id uuid,
  p_claim_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $bind$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_runs run
    WHERE run.id = p_run_id
      AND run.employee_id = p_employee_id
      AND run.status = 'running'
  ) THEN
    RAISE EXCEPTION 'run_not_running' USING ERRCODE = '42501';
  END IF;

  UPDATE public.ai_employee_jobs
  SET run_id = p_run_id,
      updated_at = clock_timestamp()
  WHERE id = p_job_id
    AND employee_id = p_employee_id
    AND status = 'running'
    AND claim_token = p_claim_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stale_claim' USING ERRCODE = '42501';
  END IF;

  UPDATE public.ai_employee_runs
  SET job_id = p_job_id
  WHERE id = p_run_id
    AND employee_id = p_employee_id
    AND status = 'running';
END;
$bind$;

CREATE OR REPLACE FUNCTION public.ai_employee_assert_job_claim(
  p_employee_id uuid,
  p_run_id uuid,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $assert$
DECLARE
  v_job uuid;
  v_token uuid;
BEGIN
  SELECT run.job_id
  INTO v_job
  FROM public.ai_employee_runs run
  WHERE run.id = p_run_id
    AND run.employee_id = p_employee_id;

  IF v_job IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    v_token := NULLIF(p_payload->>'claim_token', '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_token := NULL;
  END;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'stale_claim' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.ai_employee_jobs job
  WHERE job.id = v_job
    AND job.employee_id = p_employee_id
    AND job.run_id = p_run_id
    AND job.status = 'running'
    AND job.claim_token = v_token
  FOR UPDATE OF job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stale_claim' USING ERRCODE = '42501';
  END IF;
END;
$assert$;

CREATE OR REPLACE FUNCTION public.ai_employee_perform(
  p_employee_id uuid,
  p_run_id uuid,
  p_action text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_payload_org uuid;
  v_id uuid;
  v_task uuid;
  v_parent uuid;
  v_assigner uuid;
  v_title text;
  v_brief text;
  v_pillar uuid;
  v_post timestamptz;
  v_order integer;
  v_entity text;
  v_brief_token text;
  v_service uuid;
  v_idea uuid;
  v_execution uuid;
  v_product uuid;
  v_fields text[];
BEGIN
  v_org := public.ai_employee_require_run(p_employee_id, p_run_id);
  PERFORM public.ai_employee_assert_job_claim(p_employee_id, p_run_id, v_payload);

  IF p_action = ANY (ARRAY[
    'content.plans.schedule',
    'tasks.delete',
    'tasks.steps.delete',
    'tasks.substeps.delete',
    'session.switchOrg'
  ]) OR p_action LIKE 'finance.%'
    OR p_action LIKE 'payroll.%'
    OR p_action LIKE 'hr.%'
    OR p_action LIKE 'crm.%'
    OR p_action LIKE 'ads.%'
  THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT (p_action = ANY (ARRAY[
    'content.plans.create',
    'content.plans.update',
    'content.briefs.create',
    'thinking.plan.save',
    'thinking.plan.direct',
    'thinking.execution.check',
    'tasks.update',
    'tasks.steps.create',
    'tasks.steps.update',
    'tasks.substeps.create',
    'tasks.completion.request'
  ])) THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_permissions perm
    WHERE perm.employee_id = p_employee_id
      AND perm.action_code = p_action
  ) THEN
    RAISE EXCEPTION 'action_forbidden' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_payload->>'approved', '') IN ('true', 't', '1')
    OR COALESCE(v_payload->>'production_approved', '') IN ('true', 't', '1')
    OR lower(btrim(COALESCE(v_payload->>'production_status', ''))) = 'approved'
    OR (
      p_action = 'tasks.completion.request'
      AND lower(btrim(COALESCE(v_payload->>'status', 'pending'))) <> 'pending'
    )
    OR (
      p_action LIKE 'tasks.%'
      AND p_action <> 'tasks.completion.request'
      AND lower(btrim(COALESCE(v_payload->>'status', ''))) IN ('completed', 'cancelled', 'approved')
    )
  THEN
    RAISE EXCEPTION 'approval_forbidden' USING ERRCODE = '42501';
  END IF;

  IF jsonb_exists(v_payload, 'organization_id') THEN
    BEGIN
      v_payload_org := NULLIF(v_payload->>'organization_id', '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
    END;
    IF v_payload_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_action = 'thinking.execution.check' THEN
    RETURN public.ai_employee_accept_execution(v_org, p_employee_id, v_payload);
  END IF;

  IF p_action IN ('content.plans.create', 'thinking.plan.save', 'thinking.plan.direct') THEN
    v_title := NULLIF(btrim(COALESCE(v_payload->>'title', '')), '');
    v_brief := NULLIF(v_payload->>'brief', '');
    IF v_title IS NULL OR char_length(v_title) > 200 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF v_brief IS NOT NULL AND char_length(v_brief) > 200000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(v_payload->>'post_date', '') IS NULL THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_post := ((v_payload->>'post_date')::date::timestamp) AT TIME ZONE 'Asia/Jakarta';

    IF NULLIF(v_payload->>'content_pillar_id', '') IS NOT NULL
      OR p_action LIKE 'thinking.%'
    THEN
      v_pillar := NULLIF(v_payload->>'content_pillar_id', '')::uuid;
      IF v_pillar IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.content_pillars c
        WHERE c.id = v_pillar
          AND c.is_active
          AND (c.organization_id = v_org OR c.is_default)
      ) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END IF;

    v_service := NULL;
    v_idea := NULL;
    v_execution := NULL;
    IF NULLIF(v_payload->>'service_id', '') IS NOT NULL THEN
      v_service := (v_payload->>'service_id')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.services svc
        WHERE svc.id = v_service
          AND svc.organization_id = v_org
          AND COALESCE(svc.is_active, true)
      ) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END IF;

    IF p_action = 'thinking.plan.save' THEN
      v_idea := NULLIF(v_payload->>'idea_id', '')::uuid;
      IF v_idea IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.thinking_lab_ideas idea
        WHERE idea.id = v_idea
          AND idea.organization_id = v_org
          AND idea.status = 'locked'
          AND idea.validation->>'decision' = 'LOLOS'
      ) THEN
        RAISE EXCEPTION 'idea_not_found' USING ERRCODE = 'P0002';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.social_media_plans existing
        WHERE existing.organization_id = v_org
          AND existing.thinking_idea_id = v_idea
      ) THEN
        RAISE EXCEPTION 'idea_used' USING ERRCODE = '23505';
      END IF;
      IF NULLIF(v_payload->>'execution_id', '') IS NOT NULL THEN
        v_execution := (v_payload->>'execution_id')::uuid;
        IF NOT EXISTS (
          SELECT 1 FROM public.thinking_lab_executions ex
          WHERE ex.id = v_execution
            AND ex.organization_id = v_org
            AND ex.idea_id = v_idea
            AND ex.admission = 'GENERATE_VALID'
            AND ex.creative_idea_id IS NULL
        ) THEN
          RAISE EXCEPTION 'execution_not_passed' USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;

    v_product := NULL;
    IF NULLIF(v_payload->>'product_knowledge_id', '') IS NOT NULL THEN
      v_product := (v_payload->>'product_knowledge_id')::uuid;
      IF NOT EXISTS (
        SELECT 1
        FROM public.product_knowledge knowledge
        LEFT JOIN public.sub_services sub
          ON sub.id = knowledge.sub_service_id
         AND sub.organization_id = knowledge.organization_id
        JOIN public.ai_employee_briefs brief
          ON brief.employee_id = p_employee_id
         AND brief.organization_id = v_org
        WHERE knowledge.id = v_product
          AND knowledge.organization_id = v_org
          AND (
            COALESCE(cardinality(brief.product_knowledge_ids), 0) = 0
            OR knowledge.id = ANY (brief.product_knowledge_ids)
          )
          AND (
            knowledge.service_id = ANY (brief.service_ids)
            OR sub.service_id = ANY (brief.service_ids)
          )
      ) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END IF;

    v_fields := NULL;
    IF v_product IS NOT NULL
      AND jsonb_typeof(v_payload->'product_knowledge_fields') = 'array'
    THEN
      SELECT array_agg(picked.field ORDER BY picked.field)
      INTO v_fields
      FROM (
        SELECT DISTINCT src.field
        FROM (
          SELECT left(btrim(element.item #>> '{}'), 80) AS field
          FROM jsonb_array_elements(v_payload->'product_knowledge_fields') WITH ORDINALITY AS element(item, ordinality)
          WHERE element.ordinality <= 13
            AND jsonb_typeof(element.item) = 'string'
        ) src
        JOIN public.product_knowledge knowledge
          ON knowledge.id = v_product
         AND knowledge.organization_id = v_org
        WHERE src.field IN (
          'feature_name', 'feature_description', 'problems_solved', 'impact', 'solusi',
          'competitive_advantage', 'target_audience', 'wants', 'needs', 'hidden_needs',
          'false_belief', 'false_belief_impact', 'what_makes_them_stop'
        )
          AND CASE src.field
            WHEN 'feature_name' THEN btrim(knowledge.feature_name) <> ''
            WHEN 'feature_description' THEN btrim(knowledge.feature_description) <> ''
            WHEN 'problems_solved' THEN EXISTS (
              SELECT 1 FROM unnest(COALESCE(knowledge.problems_solved, '{}'::text[])) AS piece
              WHERE btrim(piece) <> ''
            )
            WHEN 'impact' THEN btrim(knowledge.impact) <> ''
            WHEN 'solusi' THEN btrim(COALESCE(knowledge.solusi, '')) <> ''
            WHEN 'competitive_advantage' THEN btrim(COALESCE(public.ai_employee_product_clip(knowledge.competitive_advantage, 400), '')) <> ''
            WHEN 'target_audience' THEN btrim(COALESCE(public.ai_employee_product_clip(knowledge.target_audience, 240), '')) <> ''
            WHEN 'wants' THEN btrim(COALESCE(knowledge.wants, '')) <> ''
            WHEN 'needs' THEN btrim(COALESCE(knowledge.needs, '')) <> ''
            WHEN 'hidden_needs' THEN btrim(COALESCE(knowledge.hidden_needs, '')) <> ''
            WHEN 'false_belief' THEN btrim(COALESCE(knowledge.false_belief, '')) <> ''
            WHEN 'false_belief_impact' THEN btrim(COALESCE(knowledge.false_belief_impact, '')) <> ''
            WHEN 'what_makes_them_stop' THEN btrim(COALESCE(knowledge.what_makes_them_stop, '')) <> ''
            ELSE false
          END
      ) picked;
    END IF;

    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,
      product_knowledge_id, product_knowledge_fields, author_employee_id, production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,
      v_product, v_fields, p_employee_id, 'Need Review', false, false, 'draft'
    )
    RETURNING id INTO v_id;

    UPDATE public.ai_employee_runs
    SET object_ids = CASE WHEN v_id = ANY (object_ids) THEN object_ids ELSE object_ids || v_id END,
        plan_count = plan_count + 1
    WHERE id = p_run_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action IN ('content.plans.update', 'content.briefs.create') THEN
    v_id := NULLIF(v_payload->>'plan_id', '')::uuid;
    IF v_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.social_media_plans p
      WHERE p.id = v_id
        AND p.organization_id = v_org
        AND p.author_employee_id = p_employee_id
    ) THEN
      RAISE EXCEPTION 'not_assignee' USING ERRCODE = '42501';
    END IF;

    IF p_action = 'content.briefs.create' THEN
      v_brief := NULLIF(v_payload->>'brief', '');
      IF v_brief IS NULL THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_brief_token := gen_random_uuid()::text;
      INSERT INTO public.ai_employee_brief_tickets (plan_id, token)
      VALUES (v_id, v_brief_token)
      ON CONFLICT (plan_id) DO UPDATE
        SET token = EXCLUDED.token, created_at = now();
      PERFORM set_config('ai_employee.brief_write', v_brief_token, true);
      UPDATE public.social_media_plans
      SET brief = v_brief,
          production_status = 'Need Review',
          approved = false,
          production_approved = false,
          updated_at = now()
      WHERE id = v_id;
      DELETE FROM public.ai_employee_brief_tickets
      WHERE plan_id = v_id AND token = v_brief_token;
      PERFORM set_config('ai_employee.brief_write', '', true);
    ELSE
      IF jsonb_exists(v_payload, 'title') THEN
        v_title := NULLIF(btrim(v_payload->>'title'), '');
        IF v_title IS NULL OR char_length(v_title) > 200 THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF NULLIF(v_payload->>'post_date', '') IS NOT NULL THEN
        v_post := ((v_payload->>'post_date')::date::timestamp) AT TIME ZONE 'Asia/Jakarta';
      END IF;
      IF NULLIF(v_payload->>'content_pillar_id', '') IS NOT NULL THEN
        v_pillar := (v_payload->>'content_pillar_id')::uuid;
        IF NOT EXISTS (
          SELECT 1 FROM public.content_pillars c
          WHERE c.id = v_pillar
            AND c.is_active
            AND (c.organization_id = v_org OR c.is_default)
        ) THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
      END IF;
      v_brief_token := gen_random_uuid()::text;
      INSERT INTO public.ai_employee_brief_tickets (plan_id, token)
      VALUES (v_id, v_brief_token)
      ON CONFLICT (plan_id) DO UPDATE
        SET token = EXCLUDED.token, created_at = now();
      PERFORM set_config('ai_employee.brief_write', v_brief_token, true);
      UPDATE public.social_media_plans
      SET title = COALESCE(v_title, title),
          brief = CASE WHEN jsonb_exists(v_payload, 'brief') THEN v_payload->>'brief' ELSE brief END,
          post_date = COALESCE(v_post, post_date),
          content_pillar_id = COALESCE(v_pillar, content_pillar_id),
          author_employee_id = p_employee_id,
          production_status = 'Need Review',
          approved = false,
          production_approved = false,
          updated_at = now()
      WHERE id = v_id;
      DELETE FROM public.ai_employee_brief_tickets
      WHERE plan_id = v_id AND token = v_brief_token;
      PERFORM set_config('ai_employee.brief_write', '', true);
    END IF;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.update' THEN
    v_task := NULLIF(v_payload->>'task_id', '')::uuid;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    UPDATE public.daily_tasks
    SET title = COALESCE(NULLIF(v_payload->>'title', ''), title),
        description = CASE WHEN jsonb_exists(v_payload, 'description') THEN v_payload->>'description' ELSE description END,
        priority = COALESCE(NULLIF(v_payload->>'priority', ''), priority),
        due_date = CASE
          WHEN NULLIF(v_payload->>'due_date', '') IS NULL THEN due_date
          ELSE (v_payload->>'due_date')::timestamptz
        END,
        updated_at = now()
    WHERE id = v_task
      AND organization_id = v_org;
    RETURN jsonb_build_object('ok', true, 'id', v_task);
  END IF;

  IF p_action = 'tasks.steps.create' THEN
    v_task := NULLIF(v_payload->>'task_id', '')::uuid;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    v_title := COALESCE(NULLIF(v_payload->>'title', ''), '');
    v_order := COALESCE((NULLIF(v_payload->>'order', ''))::integer, 1);
    INSERT INTO public.task_steps (task_id, title, description, "order")
    VALUES (v_task, v_title, v_payload->>'description', v_order)
    RETURNING id INTO v_id;
    UPDATE public.daily_tasks
    SET has_steps = true, updated_at = now()
    WHERE id = v_task;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.steps.update' THEN
    v_id := NULLIF(v_payload->>'step_id', '')::uuid;
    SELECT task_id INTO v_task FROM public.task_steps WHERE id = v_id;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    UPDATE public.task_steps
    SET title = COALESCE(NULLIF(v_payload->>'title', ''), title),
        description = CASE WHEN jsonb_exists(v_payload, 'description') THEN v_payload->>'description' ELSE description END,
        "order" = COALESCE((NULLIF(v_payload->>'order', ''))::integer, "order"),
        is_completed = CASE
          WHEN jsonb_exists(v_payload, 'is_completed') THEN (v_payload->>'is_completed')::boolean
          ELSE is_completed
        END,
        updated_at = now()
    WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_action = 'tasks.substeps.create' THEN
    v_parent := NULLIF(v_payload->>'parent_step_id', '')::uuid;
    SELECT s.task_id INTO v_task
    FROM public.task_steps s
    JOIN public.daily_tasks t ON t.id = s.task_id
    WHERE s.id = v_parent
      AND t.organization_id = v_org;
    PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);
    v_order := COALESCE((NULLIF(v_payload->>'order', ''))::integer, 1);
    INSERT INTO public.task_steps_to_steps (parent_step_id, organization_id, title, "order")
    VALUES (v_parent, v_org, COALESCE(NULLIF(v_payload->>'title', ''), ''), v_order)
    RETURNING id INTO v_id;
    UPDATE public.daily_tasks
    SET has_substeps = true, updated_at = now()
    WHERE id = v_task;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  v_entity := COALESCE(NULLIF(v_payload->>'entity_type', ''), 'task');
  IF v_entity NOT IN ('task', 'step', 'substep') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_task := NULLIF(v_payload->>'task_id', '')::uuid;
  IF v_entity = 'step' THEN
    SELECT task_id INTO v_task
    FROM public.task_steps
    WHERE id = NULLIF(v_payload->>'step_id', '')::uuid;
  ELSIF v_entity = 'substep' THEN
    SELECT s.task_id INTO v_task
    FROM public.task_steps_to_steps sub
    JOIN public.task_steps s ON s.id = sub.parent_step_id
    WHERE sub.id = NULLIF(v_payload->>'substep_id', '')::uuid;
  END IF;

  PERFORM public.ai_employee_assert_task(p_employee_id, v_org, v_task);

  SELECT a.assigned_by INTO v_assigner
  FROM public.daily_tasks_assigned a
  WHERE a.daily_task_id = v_task
  ORDER BY a.assigned_at DESC
  LIMIT 1;

  IF v_assigner IS NULL THEN
    RAISE EXCEPTION 'not_assignee' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.completion_approvals (
    organization_id, entity_type, daily_task_id, task_step_id, task_steps_to_steps_id,
    assignee_employee_id, assigner_employee_id, status
  ) VALUES (
    v_org,
    v_entity,
    v_task,
    NULLIF(v_payload->>'step_id', '')::uuid,
    NULLIF(v_payload->>'substep_id', '')::uuid,
    p_employee_id,
    v_assigner,
    'pending'
  )
  RETURNING id INTO v_id;

  UPDATE public.ai_employee_runs
  SET object_ids = CASE WHEN v_id = ANY (object_ids) THEN object_ids ELSE object_ids || v_id END
  WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_caller_is_service() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_queue_actor_reason(uuid, uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_job_put(uuid, uuid, text, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_jobs_on_assignment() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_jobs_on_task_request() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_jobs_on_plan_revision() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_claim_due_jobs(timestamptz, uuid[]) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_requeue_stuck_jobs(timestamptz) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_job_take(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_job_finish(uuid, uuid, uuid, text, text, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_job_bind(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_assert_job_claim(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_job_take(uuid, uuid) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_job_finish(uuid, uuid, uuid, text, text, uuid, text, text, uuid) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_job_bind(uuid, uuid, uuid, uuid) TO ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_perform(uuid, uuid, text, jsonb) TO ai_employee_runner;

-- Badan uji perbaikan klaim antrean AI. Dipakai di dalam dry run.
-- Tidak punya BEGIN atau ROLLBACK sendiri.
-- Jangan panggil ai_employee_dispatch atau ai_employee_requeue_stuck_jobs.
-- Klaim memakai hari Sabtu supaya job non-urgent di production tidak ikut terambil.

CREATE OR REPLACE FUNCTION pg_temp.insert_auth_user(p_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_names text[] := ARRAY[
    'instance_id', 'id', 'aud', 'role', 'email', 'encrypted_password',
    'email_confirmed_at', 'raw_app_meta_data', 'raw_user_meta_data',
    'created_at', 'updated_at', 'confirmation_token', 'recovery_token',
    'email_change_token_new', 'email_change', 'is_sso_user', 'is_anonymous'
  ];
  v_name text;
  v_cols text[] := ARRAY[]::text[];
  v_vals text[] := ARRAY[]::text[];
  v_value text;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'auth'
        AND table_name = 'users'
        AND column_name = v_name
        AND COALESCE(is_generated, 'NEVER') = 'NEVER'
    ) THEN
      v_value := CASE v_name
        WHEN 'instance_id' THEN quote_literal('00000000-0000-0000-0000-000000000000')
        WHEN 'id' THEN quote_literal(p_id::text)
        WHEN 'aud' THEN quote_literal('authenticated')
        WHEN 'role' THEN quote_literal('authenticated')
        WHEN 'email' THEN quote_literal(p_email)
        WHEN 'encrypted_password' THEN quote_literal('test-not-a-real-password')
        WHEN 'email_confirmed_at' THEN 'now()'
        WHEN 'raw_app_meta_data' THEN quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb'
        WHEN 'raw_user_meta_data' THEN quote_literal('{}') || '::jsonb'
        WHEN 'created_at' THEN 'now()'
        WHEN 'updated_at' THEN 'now()'
        WHEN 'confirmation_token' THEN quote_literal('')
        WHEN 'recovery_token' THEN quote_literal('')
        WHEN 'email_change_token_new' THEN quote_literal('')
        WHEN 'email_change' THEN quote_literal('')
        WHEN 'is_sso_user' THEN 'false'
        WHEN 'is_anonymous' THEN 'false'
      END;
      v_cols := v_cols || quote_ident(v_name);
      v_vals := v_vals || v_value;
    END IF;
  END LOOP;

  EXECUTE format(
    'INSERT INTO auth.users (%s) VALUES (%s)',
    array_to_string(v_cols, ', '),
    array_to_string(v_vals, ', ')
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_user uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
AS $jwt$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', COALESCE(p_role, ''), true);
  PERFORM set_config('request.jwt.claims', '', true);
END;
$jwt$;

CREATE OR REPLACE FUNCTION pg_temp.assert_only_this_job(p_at timestamptz, p_keep uuid)
RETURNS void
LANGUAGE plpgsql
AS $clear$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
  INTO v_count
  FROM public.ai_employee_jobs job
  JOIN public.ai_employee_profiles profile
    ON profile.employee_id = job.employee_id
   AND profile.organization_id = job.organization_id
  JOIN public.employees employee
    ON employee.id = job.employee_id
   AND employee.organization_id = job.organization_id
  WHERE job.id IS DISTINCT FROM p_keep
    AND job.status IN ('queued', 'deferred')
    AND job.next_attempt_at <= p_at
    AND profile.is_active
    AND COALESCE(employee.is_ai, false)
    AND COALESCE(profile.performance_status, '') <> 'disabled'
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
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'antrean production punya % job yang ikut terambil. Uji berhenti sebelum klaim.', v_count;
  END IF;
END;
$clear$;

CREATE OR REPLACE FUNCTION pg_temp.claim_one(p_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql
AS $claimone$
DECLARE
  v_id uuid;
  v_count integer := 0;
  v_row record;
BEGIN
  FOR v_row IN
    SELECT claimed.job_id
    FROM public.ai_employee_claim_due_jobs(p_at, '{}'::uuid[]) claimed
  LOOP
    v_count := v_count + 1;
    v_id := v_row.job_id;
  END LOOP;
  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'klaim menghasilkan % job, uji dibatalkan', v_count;
  END IF;
  RETURN v_id;
END;
$claimone$;

DO $test$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_reviewer_user uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_owner_emp uuid := gen_random_uuid();
  v_member_emp uuid := gen_random_uuid();
  v_reviewer uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_spoof_task uuid := gen_random_uuid();
  v_owner_task uuid := gen_random_uuid();
  v_empty_task uuid := gen_random_uuid();
  v_service_task uuid := gen_random_uuid();
  v_service_bad_task uuid := gen_random_uuid();
  v_uid_wins_task uuid := gen_random_uuid();
  v_spoof_request uuid := gen_random_uuid();
  v_owner_request uuid := gen_random_uuid();
  v_empty_request uuid := gen_random_uuid();
  v_service_request uuid := gen_random_uuid();
  v_service_bad_request uuid := gen_random_uuid();
  v_token_task uuid := gen_random_uuid();
  v_plan_member uuid := gen_random_uuid();
  v_plan_server uuid := gen_random_uuid();
  v_plan_owner uuid := gen_random_uuid();
  v_plan_reviewer uuid := gen_random_uuid();
  v_job uuid;
  v_run_plain uuid;
  v_run_a uuid;
  v_run_b uuid;
  v_token_a uuid;
  v_token_b uuid;
  v_plan_id uuid;
  v_status text;
  v_reason text;
  v_count integer;
  v_when timestamptz := '2026-11-07 10:00:00+07';
  v_payload jsonb;
BEGIN
  IF public.ai_employee_in_work_hours('Asia/Jakarta', v_when) THEN
    RAISE EXCEPTION 'sabtu terhitung jam kerja';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'claim-owner-' || left(v_owner::text, 8) || '@example.com');
  PERFORM pg_temp.insert_auth_user(v_member, 'claim-member-' || left(v_member::text, 8) || '@example.com');
  PERFORM pg_temp.insert_auth_user(v_reviewer_user, 'claim-reviewer-' || left(v_reviewer_user::text, 8) || '@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Klaim Uji', 'software', v_owner);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES
    (v_owner, v_org, 'owner'),
    (v_member, v_org, 'employee'),
    (v_reviewer_user, v_org, 'employee');

  INSERT INTO public.employees (id, organization_id, full_name, user_id, is_ai)
  VALUES
    (v_owner_emp, v_org, 'Owner Klaim', v_owner, false),
    (v_member_emp, v_org, 'Anggota Klaim', v_member, false),
    (v_reviewer, v_org, 'Reviewer Klaim', v_reviewer_user, false),
    (v_ai, v_org, 'Naya Klaim', NULL, true);

  INSERT INTO public.ai_employee_profiles (
    employee_id, organization_id, reviewer_employee_id, time_zone, is_active, performance_status
  ) VALUES (
    v_ai, v_org, v_reviewer, 'Asia/Jakarta', true, 'on_track'
  );

  INSERT INTO public.ai_employee_permissions (employee_id, organization_id, action_code)
  VALUES (v_ai, v_org, 'content.plans.create');

  v_run_plain := public.ai_employee_run_start(v_ai, 'SOP2');
  v_payload := public.ai_employee_perform(
    v_ai,
    v_run_plain,
    'content.plans.create',
    jsonb_build_object('title', 'Plan tanpa job', 'brief', 'biasa', 'post_date', '2026-11-09')
  );
  IF v_payload->>'ok' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'run tanpa job ditolak';
  END IF;

  PERFORM pg_temp.as_user(v_member, 'authenticated');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_spoof_task, v_org, 'Tugas palsu', 'konten', 'medium', v_member);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_spoof_task, v_ai, v_owner_emp);
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_spoof_task;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'anggota yang mengisi assigned_by owner tidak ditolak: % %', v_status, v_reason;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_tasks_assigned
    WHERE daily_task_id = v_spoof_task AND employee_id = v_ai AND assigned_by = v_owner_emp
  ) THEN
    RAISE EXCEPTION 'baris penugasan tidak tersimpan';
  END IF;

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_owner_task, v_org, 'Tugas owner', 'konten', 'medium', v_owner);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_owner_task, v_ai, v_member_emp);
  SELECT status INTO v_status
  FROM public.ai_employee_jobs WHERE daily_task_id = v_owner_task AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'auth owner kalah dari assigned_by anggota';
  END IF;

  PERFORM pg_temp.as_user(NULL, 'authenticated');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_empty_task, v_org, 'Tugas tanpa uid', 'konten', 'medium', v_owner);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_empty_task, v_ai, v_owner_emp);
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_empty_task;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%tidak teridentifikasi%' THEN
    RAISE EXCEPTION 'uid kosong tetap percaya assigned_by: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(NULL, 'service_role');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_service_task, v_org, 'Tugas service', 'konten', 'medium', v_owner);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_service_task, v_ai, v_owner_emp);
  SELECT status INTO v_status
  FROM public.ai_employee_jobs WHERE daily_task_id = v_service_task AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'service_role tidak boleh memakai assigned_by owner';
  END IF;

  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_service_bad_task, v_org, 'Tugas service anggota', 'konten', 'medium', v_member);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_service_bad_task, v_ai, v_member_emp);
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_service_bad_task;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'service_role menerima assigned_by anggota: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(v_member, 'service_role');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_uid_wins_task, v_org, 'Tugas uid menang', 'konten', 'medium', v_member);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_uid_wins_task, v_ai, v_owner_emp);
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_uid_wins_task;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'uid anggota kalah dari service_role: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(v_member, 'authenticated');
  INSERT INTO public.daily_tasks (
    id, organization_id, title, description, priority, created_by, requested_ai_employee_id
  ) VALUES (
    v_spoof_request, v_org, 'Minta palsu', 'konten', 'high', v_owner, v_ai
  );
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_spoof_request;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'anggota yang mengisi created_by owner tidak ditolak: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  INSERT INTO public.daily_tasks (
    id, organization_id, title, description, priority, created_by, requested_ai_employee_id
  ) VALUES (
    v_owner_request, v_org, 'Minta owner', 'konten', 'high', v_member, v_ai
  );
  SELECT status INTO v_status
  FROM public.ai_employee_jobs WHERE daily_task_id = v_owner_request AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'auth owner kalah dari created_by anggota';
  END IF;

  PERFORM pg_temp.as_user(NULL, 'authenticated');
  INSERT INTO public.daily_tasks (
    id, organization_id, title, description, priority, created_by, requested_ai_employee_id
  ) VALUES (
    v_empty_request, v_org, 'Minta tanpa uid', 'konten', 'high', v_owner, v_ai
  );
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_empty_request;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%tidak teridentifikasi%' THEN
    RAISE EXCEPTION 'uid kosong tetap percaya created_by: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(NULL, 'service_role');
  INSERT INTO public.daily_tasks (
    id, organization_id, title, description, priority, created_by, requested_ai_employee_id
  ) VALUES (
    v_service_request, v_org, 'Minta service', 'konten', 'high', v_owner, v_ai
  );
  SELECT status INTO v_status
  FROM public.ai_employee_jobs WHERE daily_task_id = v_service_request AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'service_role tidak boleh memakai created_by owner';
  END IF;

  INSERT INTO public.daily_tasks (
    id, organization_id, title, description, priority, created_by, requested_ai_employee_id
  ) VALUES (
    v_service_bad_request, v_org, 'Minta service anggota', 'konten', 'high', v_member, v_ai
  );
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE daily_task_id = v_service_bad_request;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'service_role menerima created_by anggota: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(NULL, '');
  INSERT INTO public.social_media_plans (
    id, organization_id, title, brief, post_date, author_employee_id, status, approved
  ) VALUES
    (v_plan_member, v_org, 'Plan anggota', 'awal', '2026-11-10 00:00:00+07', v_ai, 'draft', false),
    (v_plan_server, v_org, 'Plan server', 'awal', '2026-11-10 00:00:00+07', v_ai, 'draft', false),
    (v_plan_owner, v_org, 'Plan owner', 'awal', '2026-11-10 00:00:00+07', v_ai, 'draft', false),
    (v_plan_reviewer, v_org, 'Plan reviewer', 'awal', '2026-11-10 00:00:00+07', v_ai, 'draft', false);

  PERFORM pg_temp.as_user(v_member, 'authenticated');
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 1
  WHERE id = v_plan_member;
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE plan_id = v_plan_member;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%owner, admin, atau reviewer%' THEN
    RAISE EXCEPTION 'revisi anggota masuk antrean: % %', v_status, v_reason;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ai_employee_jobs WHERE plan_id = v_plan_member AND status = 'queued'
  ) THEN
    RAISE EXCEPTION 'revisi anggota tetap queued';
  END IF;

  PERFORM pg_temp.as_user(NULL, '');
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 1
  WHERE id = v_plan_server;
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE plan_id = v_plan_server;
  IF v_status IS DISTINCT FROM 'rejected' OR v_reason NOT LIKE '%tidak teridentifikasi%' THEN
    RAISE EXCEPTION 'revisi tanpa uid masuk antrean: % %', v_status, v_reason;
  END IF;

  INSERT INTO public.ai_employee_feedback (
    employee_id, organization_id, object_type, object_id, reason, reviewer_employee_id
  ) VALUES (
    v_ai, v_org, 'plan', v_plan_owner, 'Hook kurang kuat', v_reviewer
  );

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 1
  WHERE id = v_plan_owner;
  SELECT status, reason INTO v_status, v_reason
  FROM public.ai_employee_jobs WHERE plan_id = v_plan_owner AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' OR v_reason NOT LIKE '%Hook kurang kuat%' THEN
    RAISE EXCEPTION 'revisi owner tidak masuk antrean: % %', v_status, v_reason;
  END IF;

  PERFORM pg_temp.as_user(v_member, 'authenticated');
  UPDATE public.social_media_plans SET status = 'draft' WHERE id = v_plan_owner;
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 1
  WHERE id = v_plan_owner;
  SELECT reason INTO v_reason
  FROM public.ai_employee_jobs
  WHERE plan_id = v_plan_owner AND status = 'queued';
  IF v_reason NOT LIKE '%Hook kurang kuat%' THEN
    RAISE EXCEPTION 'penolakan anggota menimpa alasan job yang sudah queued: %', v_reason;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_employee_jobs
    WHERE plan_id = v_plan_owner AND status = 'rejected'
      AND reason LIKE '%owner, admin, atau reviewer%'
  ) THEN
    RAISE EXCEPTION 'penolakan anggota tidak tersimpan terpisah';
  END IF;

  UPDATE public.ai_employee_jobs
  SET status = 'done', finished_at = clock_timestamp()
  WHERE plan_id = v_plan_owner AND status = 'queued';
  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  UPDATE public.social_media_plans SET status = 'draft' WHERE id = v_plan_owner;
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 2
  WHERE id = v_plan_owner;
  UPDATE public.ai_employee_jobs
  SET status = 'done', finished_at = clock_timestamp()
  WHERE plan_id = v_plan_owner AND status = 'queued';
  UPDATE public.social_media_plans SET status = 'draft' WHERE id = v_plan_owner;
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 3
  WHERE id = v_plan_owner;
  IF EXISTS (
    SELECT 1 FROM public.ai_employee_jobs WHERE plan_id = v_plan_owner AND status = 'queued'
  ) THEN
    RAISE EXCEPTION 'revisi ketiga tetap queued';
  END IF;
  SELECT reason INTO v_reason
  FROM public.ai_employee_jobs
  WHERE plan_id = v_plan_owner AND status = 'rejected'
  ORDER BY finished_at DESC NULLS LAST
  LIMIT 1;
  IF v_reason NOT LIKE '%sudah 2 kali%' THEN
    RAISE EXCEPTION 'revisi ketiga bukan batas: %', v_reason;
  END IF;

  PERFORM pg_temp.as_user(v_reviewer_user, 'authenticated');
  UPDATE public.social_media_plans
  SET status = 'Request Revision', revision_count = 1
  WHERE id = v_plan_reviewer;
  SELECT status INTO v_status
  FROM public.ai_employee_jobs WHERE plan_id = v_plan_reviewer AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' THEN
    RAISE EXCEPTION 'revisi reviewer tidak masuk antrean';
  END IF;

  PERFORM public.ai_employee_job_put(
    v_ai, v_org, 'task', v_owner_task, NULL, 'medium', 'queued', 'alasan baru'
  );
  PERFORM public.ai_employee_job_put(
    v_ai, v_org, 'task', v_owner_task, NULL, 'medium', 'rejected', 'bocor'
  );
  SELECT reason INTO v_reason
  FROM public.ai_employee_jobs
  WHERE daily_task_id = v_owner_task AND status = 'queued';
  IF v_reason IS DISTINCT FROM 'alasan baru' THEN
    RAISE EXCEPTION 'job ditolak menimpa alasan queued: %', v_reason;
  END IF;

  UPDATE public.ai_employee_jobs
  SET status = 'done', finished_at = clock_timestamp(), claim_token = NULL
  WHERE organization_id = v_org AND status IN ('queued', 'deferred');

  PERFORM pg_temp.as_user(v_owner, 'authenticated');
  INSERT INTO public.daily_tasks (id, organization_id, title, description, priority, created_by)
  VALUES (v_token_task, v_org, 'Buat content plan klaim', 'konten', 'urgent', v_owner);
  INSERT INTO public.daily_tasks_assigned (organization_id, daily_task_id, employee_id, assigned_by)
  VALUES (v_org, v_token_task, v_ai, v_member_emp);
  SELECT id, status INTO v_job, v_status
  FROM public.ai_employee_jobs
  WHERE daily_task_id = v_token_task AND status = 'queued';
  IF v_status IS DISTINCT FROM 'queued' OR v_job IS NULL THEN
    RAISE EXCEPTION 'job token tidak queued';
  END IF;
  UPDATE public.ai_employee_jobs
  SET next_attempt_at = '2026-10-01 00:00:00+07'
  WHERE id = v_job;

  PERFORM pg_temp.as_user(NULL, '');
  PERFORM pg_temp.assert_only_this_job(v_when, v_job);
  IF pg_temp.claim_one(v_when) IS DISTINCT FROM v_job THEN
    RAISE EXCEPTION 'klaim pertama bukan job uji';
  END IF;
  v_payload := public.ai_employee_job_take(v_ai, v_job);
  v_token_a := NULLIF(v_payload->>'claim_token', '')::uuid;
  IF v_token_a IS NULL OR v_payload->>'source' IS DISTINCT FROM 'task' THEN
    RAISE EXCEPTION 'take tidak mengembalikan token';
  END IF;
  v_run_a := public.ai_employee_run_start(v_ai, 'SOP2');
  PERFORM public.ai_employee_job_bind(v_ai, v_job, v_run_a, v_token_a);

  UPDATE public.ai_employee_jobs
  SET status = 'queued',
      claimed_at = NULL,
      claim_token = NULL,
      run_id = NULL,
      attempts = 0,
      next_attempt_at = '2026-10-01 00:00:00+07'
  WHERE id = v_job;

  PERFORM pg_temp.assert_only_this_job(v_when, v_job);
  IF pg_temp.claim_one(v_when) IS DISTINCT FROM v_job THEN
    RAISE EXCEPTION 'klaim ulang bukan job uji';
  END IF;
  SELECT claim_token, status INTO v_token_b, v_status
  FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_status IS DISTINCT FROM 'claimed' OR v_token_b IS NULL OR v_token_b = v_token_a THEN
    RAISE EXCEPTION 'token tidak diganti saat klaim ulang';
  END IF;

  BEGIN
    PERFORM public.ai_employee_job_finish(
      v_ai, v_job, v_run_a, 'done', '', NULL, 'Plan klaim lama', 'tidak boleh', v_token_a
    );
    RAISE EXCEPTION 'token lama menutup job';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'stale_claim' THEN
        RAISE;
      END IF;
  END;
  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_status IS DISTINCT FROM 'claimed' THEN
    RAISE EXCEPTION 'token lama mengubah status job: %', v_status;
  END IF;

  v_payload := public.ai_employee_job_take(v_ai, v_job);
  IF NULLIF(v_payload->>'claim_token', '')::uuid IS DISTINCT FROM v_token_b THEN
    RAISE EXCEPTION 'take kedua mengembalikan token lama';
  END IF;
  v_run_b := public.ai_employee_run_start(v_ai, 'SOP2');
  PERFORM public.ai_employee_job_bind(v_ai, v_job, v_run_b, v_token_b);

  BEGIN
    PERFORM public.ai_employee_perform(
      v_ai,
      v_run_a,
      'content.plans.create',
      jsonb_build_object(
        'title', 'Plan klaim lama',
        'brief', 'tidak boleh',
        'post_date', '2026-11-09',
        'claim_token', v_token_a
      )
    );
    RAISE EXCEPTION 'token lama membuat plan';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'stale_claim' THEN
        RAISE;
      END IF;
  END;
  BEGIN
    PERFORM public.ai_employee_perform(
      v_ai,
      v_run_b,
      'content.plans.create',
      jsonb_build_object(
        'title', 'Plan klaim rusak',
        'brief', 'tidak boleh',
        'post_date', '2026-11-09',
        'claim_token', 'bukan-uuid'
      )
    );
    RAISE EXCEPTION 'token rusak membuat plan';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'stale_claim' THEN
        RAISE;
      END IF;
  END;
  IF EXISTS (
    SELECT 1 FROM public.social_media_plans
    WHERE author_employee_id = v_ai
      AND title IN ('Plan klaim lama', 'Plan klaim rusak')
  ) THEN
    RAISE EXCEPTION 'plan dari klaim lama tersimpan';
  END IF;

  v_payload := public.ai_employee_perform(
    v_ai,
    v_run_b,
    'content.plans.create',
    jsonb_build_object(
      'title', 'Plan klaim baru',
      'brief', 'boleh',
      'post_date', '2026-11-09',
      'claim_token', v_token_b
    )
  );
  v_plan_id := NULLIF(v_payload->>'id', '')::uuid;
  IF v_payload->>'ok' IS DISTINCT FROM 'true' OR v_plan_id IS NULL THEN
    RAISE EXCEPTION 'token baru tidak membuat plan';
  END IF;

  BEGIN
    PERFORM public.ai_employee_job_finish(
      v_ai, v_job, v_run_a, 'failed', 'lama', NULL, '', '', v_token_a
    );
    RAISE EXCEPTION 'token lama menutup job yang sedang berjalan';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'stale_claim' THEN
        RAISE;
      END IF;
  END;
  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_status IS DISTINCT FROM 'running' THEN
    RAISE EXCEPTION 'job tertutup oleh token lama: %', v_status;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.task_steps WHERE task_id = v_token_task
  ) THEN
    RAISE EXCEPTION 'token lama menulis langkah task';
  END IF;

  PERFORM public.ai_employee_job_finish(
    v_ai, v_job, v_run_b, 'done', '', v_plan_id, 'Plan klaim baru', 'boleh', v_token_b
  );
  SELECT status INTO v_status FROM public.daily_tasks WHERE id = v_token_task;
  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'task ditandai selesai sendiri: %', v_status;
  END IF;
  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_status IS DISTINCT FROM 'done' THEN
    RAISE EXCEPTION 'token baru tidak menutup job: %', v_status;
  END IF;

  BEGIN
    PERFORM public.ai_employee_job_finish(
      v_ai, v_job, v_run_a, 'failed', 'lama', NULL, '', '', v_token_a
    );
    RAISE EXCEPTION 'token lama menutup job yang sudah selesai';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM IS DISTINCT FROM 'stale_claim' THEN
        RAISE;
      END IF;
  END;
  SELECT status INTO v_status FROM public.ai_employee_jobs WHERE id = v_job;
  IF v_status IS DISTINCT FROM 'done' THEN
    RAISE EXCEPTION 'status akhir berubah: %', v_status;
  END IF;

  IF to_regprocedure('public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'finish tanpa token masih ada';
  END IF;
  IF to_regprocedure('public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'finish dengan token tidak ada';
  END IF;
  IF NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_job_take(uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_job_bind(uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('ai_employee_runner', 'public.ai_employee_perform(uuid,uuid,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'runner tidak punya pintu klaim';
  END IF;
  IF has_function_privilege('anon', 'public.ai_employee_job_bind(uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ai_employee_job_bind(uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.ai_employee_job_bind(uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.ai_employee_job_finish(uuid,uuid,uuid,text,text,uuid,text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.ai_employee_perform(uuid,uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('ai_employee_runner', 'public.ai_employee_assert_job_claim(uuid,uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ai_employee_queue_actor_reason(uuid,uuid,uuid,uuid,boolean)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.ai_employee_caller_is_service()', 'EXECUTE') THEN
    RAISE EXCEPTION 'pintu klaim terbuka di luar runner';
  END IF;
  IF has_table_privilege('anon', 'public.ai_employee_jobs', 'SELECT')
     OR has_table_privilege('authenticated', 'public.ai_employee_jobs', 'SELECT')
     OR has_table_privilege('service_role', 'public.ai_employee_jobs', 'SELECT')
     OR has_table_privilege('ai_employee_runner', 'public.ai_employee_jobs', 'SELECT') THEN
    RAISE EXCEPTION 'tabel antrean bisa dibaca langsung';
  END IF;
END;
$test$;

ROLLBACK;
