-- Hari laporan dipilih tenant. Harian menyimpan daftar weekday, mingguan satu hari,
-- bulanan tetap tanggal terakhir bulan berjalan. Baris Senin–Kamis yang sudah tersimpan
-- menjadi hari 1–4, bukan kunci untuk tenant lain.

ALTER TABLE public.ai_employee_routines
  ADD COLUMN IF NOT EXISTS weekdays smallint[] NOT NULL DEFAULT '{}'::smallint[];

CREATE OR REPLACE FUNCTION public.ai_employee_next_routine_at(
  p_cadence text,
  p_weekday smallint,
  p_time time,
  p_time_zone text,
  p_after timestamptz,
  p_weekdays smallint[]
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_zone text := COALESCE(NULLIF(btrim(p_time_zone), ''), 'Asia/Jakarta');
  v_local timestamp;
  v_dow integer;
  v_delta integer;
  v_month timestamp;
  v_candidate timestamp;
  v_guard integer := 0;
  v_days smallint[] := COALESCE(p_weekdays, '{}'::smallint[]);
BEGIN
  IF p_time IS NULL
     OR p_after IS NULL
     OR p_cadence NOT IN ('daily', 'mon_thu', 'days', 'weekly', 'monthly')
     OR (p_cadence = 'weekly' AND (p_weekday IS NULL OR p_weekday < 1 OR p_weekday > 7))
     OR (p_cadence = 'days' AND (cardinality(v_days) < 1 OR p_weekday IS NOT NULL))
     OR (p_cadence IN ('daily', 'mon_thu', 'monthly') AND p_weekday IS NOT NULL)
     OR EXISTS (SELECT 1 FROM unnest(v_days) AS day WHERE day < 1 OR day > 7)
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zone) THEN
    v_zone := 'Asia/Jakarta';
  END IF;

  v_local := timezone(v_zone, p_after);
  IF p_cadence = 'monthly' THEN
    v_month := date_trunc('month', v_local);
    v_candidate := date_trunc('day', v_month + interval '1 month' - interval '1 day') + p_time;
    IF v_candidate <= v_local THEN
      v_month := v_month + interval '1 month';
      v_candidate := date_trunc('day', v_month + interval '1 month' - interval '1 day') + p_time;
    END IF;
  ELSIF p_cadence = 'days' THEN
    v_candidate := date_trunc('day', v_local) + p_time;
    IF v_candidate <= v_local THEN
      v_candidate := v_candidate + interval '1 day';
    END IF;
    WHILE NOT (EXTRACT(ISODOW FROM v_candidate)::integer = ANY (v_days)) LOOP
      v_candidate := v_candidate + interval '1 day';
      v_guard := v_guard + 1;
      IF v_guard > 7 THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  ELSIF p_cadence IN ('daily', 'mon_thu') THEN
    v_candidate := date_trunc('day', v_local) + p_time;
    IF v_candidate <= v_local THEN
      v_candidate := v_candidate + interval '1 day';
    END IF;
    IF p_cadence = 'mon_thu' THEN
      WHILE EXTRACT(ISODOW FROM v_candidate)::integer NOT BETWEEN 1 AND 4 LOOP
        v_candidate := v_candidate + interval '1 day';
      END LOOP;
    END IF;
  ELSE
    v_dow := EXTRACT(ISODOW FROM v_local)::integer;
    v_delta := (p_weekday - v_dow + 7) % 7;
    v_candidate := date_trunc('day', v_local) + make_interval(days => v_delta) + p_time;
    IF v_candidate <= v_local THEN
      v_candidate := v_candidate + interval '7 days';
    END IF;
  END IF;

  RETURN v_candidate AT TIME ZONE v_zone;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_next_routine_at(text, smallint, time, text, timestamptz, smallint[]) IS
  'Slot berikutnya. days memakai weekday yang dipilih, weekly satu hari, monthly tanggal terakhir bulan berjalan.';

REVOKE ALL ON FUNCTION public.ai_employee_next_routine_at(text, smallint, time, text, timestamptz, smallint[]) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

CREATE OR REPLACE FUNCTION public.ai_employee_next_routine_at(
  p_cadence text,
  p_weekday smallint,
  p_time time,
  p_time_zone text,
  p_after timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN public.ai_employee_next_routine_at(
    p_cadence,
    p_weekday,
    p_time,
    p_time_zone,
    p_after,
    NULL::smallint[]
  );
END;
$$;

COMMENT ON FUNCTION public.ai_employee_next_routine_at(text, smallint, time, text, timestamptz) IS
  'Pembungkus lima argumen. Hari pilihan dikirim lewat fungsi enam argumen.';

CREATE OR REPLACE FUNCTION public.ai_employee_routines_set_next_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone text;
BEGIN
  IF NEW.cadence IN ('weekly', 'monthly', 'daily', 'mon_thu') THEN
    NEW.weekdays := '{}'::smallint[];
  END IF;
  IF NEW.cadence IN ('days', 'monthly', 'daily', 'mon_thu') THEN
    NEW.weekday := NULL;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.next_run_at IS NOT NULL
     AND NEW.cadence IS NOT DISTINCT FROM OLD.cadence
     AND NEW.weekday IS NOT DISTINCT FROM OLD.weekday
     AND NEW.weekdays IS NOT DISTINCT FROM OLD.weekdays
     AND NEW.time_local IS NOT DISTINCT FROM OLD.time_local
     AND (NEW.is_active IS NOT TRUE OR OLD.is_active IS TRUE)
  THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(btrim(time_zone), ''), 'Asia/Jakarta')
  INTO v_zone
  FROM public.ai_employee_profiles
  WHERE employee_id = NEW.employee_id
    AND organization_id = NEW.organization_id;

  NEW.updated_at := clock_timestamp();
  NEW.next_run_at := public.ai_employee_next_routine_at(
    NEW.cadence,
    NEW.weekday,
    NEW.time_local,
    COALESCE(v_zone, 'Asia/Jakarta'),
    clock_timestamp(),
    NEW.weekdays
  );
  RETURN NEW;
END;
$$;

ALTER TABLE public.ai_employee_routines DROP CONSTRAINT IF EXISTS ai_employee_routines_action_check;
ALTER TABLE public.ai_employee_routines DROP CONSTRAINT IF EXISTS ai_employee_routines_cadence_check;
ALTER TABLE public.ai_employee_routines DROP CONSTRAINT IF EXISTS ai_employee_routines_weekday_check;

UPDATE public.ai_employee_routines
SET cadence = 'days',
    weekdays = ARRAY[1, 2, 3, 4]::smallint[],
    weekday = NULL
WHERE action_code = 'work_report.daily'
  AND cadence = 'mon_thu';

ALTER TABLE public.ai_employee_routines
  ADD CONSTRAINT ai_employee_routines_action_check
  CHECK (action_code IN ('work_report.daily', 'work_report.weekly', 'work_report.monthly'));

ALTER TABLE public.ai_employee_routines
  ADD CONSTRAINT ai_employee_routines_cadence_check
  CHECK (cadence IN ('days', 'weekly', 'monthly'));

ALTER TABLE public.ai_employee_routines
  ADD CONSTRAINT ai_employee_routines_weekday_check
  CHECK (
    (
      action_code = 'work_report.daily'
      AND cadence = 'days'
      AND weekday IS NULL
      AND cardinality(weekdays) BETWEEN 1 AND 7
      AND weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]
    )
    OR (
      action_code = 'work_report.weekly'
      AND cadence = 'weekly'
      AND weekday BETWEEN 1 AND 7
      AND cardinality(weekdays) = 0
    )
    OR (
      action_code = 'work_report.monthly'
      AND cadence = 'monthly'
      AND weekday IS NULL
      AND cardinality(weekdays) = 0
    )
  );

CREATE OR REPLACE FUNCTION public.ai_employee_routine_view(p_routine public.ai_employee_routines)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'action_code', p_routine.action_code,
    'cadence', p_routine.cadence,
    'weekday', p_routine.weekday,
    'weekdays', p_routine.weekdays,
    'time_local', to_char(p_routine.time_local, 'HH24:MI'),
    'is_active', p_routine.is_active,
    'next_run_at', p_routine.next_run_at,
    'last_sent_at', p_routine.last_sent_at,
    'last_status', p_routine.last_status
  );
$$;

DROP FUNCTION IF EXISTS public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean, integer[]);

CREATE FUNCTION public.ai_employee_routine_write(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_action_code text,
  p_cadence text,
  p_weekday integer,
  p_time_local time,
  p_is_active boolean,
  p_weekdays integer[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $write$
DECLARE
  v_action text := NULLIF(btrim(COALESCE(p_action_code, '')), '');
  v_cadence text := NULLIF(btrim(COALESCE(p_cadence, '')), '');
  v_weekday smallint;
  v_weekdays smallint[] := '{}'::smallint[];
  v_previous public.ai_employee_routines;
  v_next public.ai_employee_routines;
BEGIN
  PERFORM public.ai_employee_require_owner(p_user_id, p_organization_id);
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees employee
    WHERE employee.id = p_employee_id
      AND employee.organization_id = p_organization_id
      AND COALESCE(employee.is_ai, false)
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF p_time_local IS NULL OR p_is_active IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF p_weekdays IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(p_weekdays) AS day WHERE day IS NULL OR day < 1 OR day > 7
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT day::smallint ORDER BY day::smallint), '{}'::smallint[])
  INTO v_weekdays
  FROM unnest(COALESCE(p_weekdays, ARRAY[]::integer[])) AS day;

  IF v_action = 'work_report.daily' AND v_cadence = 'days' AND cardinality(v_weekdays) BETWEEN 1 AND 7 THEN
    v_weekday := NULL;
  ELSIF v_action = 'work_report.weekly' AND v_cadence = 'weekly' AND p_weekday BETWEEN 1 AND 7 THEN
    v_weekday := p_weekday::smallint;
    v_weekdays := '{}'::smallint[];
  ELSIF v_action = 'work_report.monthly' AND v_cadence = 'monthly' THEN
    v_weekday := NULL;
    v_weekdays := '{}'::smallint[];
  ELSE
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT routine.*
  INTO v_previous
  FROM public.ai_employee_routines routine
  WHERE routine.employee_id = p_employee_id
    AND routine.organization_id = p_organization_id
    AND routine.action_code = v_action
  FOR UPDATE;

  BEGIN
    INSERT INTO public.ai_employee_routines (
      employee_id,
      organization_id,
      action_code,
      cadence,
      weekday,
      weekdays,
      time_local,
      is_active
    ) VALUES (
      p_employee_id,
      p_organization_id,
      v_action,
      v_cadence,
      v_weekday,
      v_weekdays,
      p_time_local,
      p_is_active
    )
    ON CONFLICT (employee_id, action_code) DO UPDATE
    SET cadence = EXCLUDED.cadence,
        weekday = EXCLUDED.weekday,
        weekdays = EXCLUDED.weekdays,
        time_local = EXCLUDED.time_local,
        is_active = EXCLUDED.is_active
    RETURNING *
    INTO v_next;
  EXCEPTION
    WHEN check_violation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'previous', CASE WHEN v_previous.id IS NULL THEN NULL ELSE public.ai_employee_routine_view(v_previous) END,
    'routine', public.ai_employee_routine_view(v_next)
  );
END;
$write$;

COMMENT ON FUNCTION public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean, integer[]) IS
  'Owner menyimpan satu irama. Harian memakai hari yang dipilih, mingguan satu hari, bulanan tanggal terakhir.';

REVOKE ALL ON FUNCTION public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean, integer[]) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean, integer[]) TO service_role;

DROP FUNCTION IF EXISTS public.ai_employee_page_routine_save(uuid, text, text, integer, time, boolean, integer[]);

CREATE FUNCTION public.ai_employee_page_routine_save(
  p_employee_id uuid,
  p_action_code text,
  p_cadence text,
  p_weekday integer,
  p_time_local time,
  p_is_active boolean,
  p_weekdays integer[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $pagesave$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  RETURN public.ai_employee_routine_write(
    auth.uid(),
    v_org,
    p_employee_id,
    p_action_code,
    p_cadence,
    p_weekday,
    p_time_local,
    p_is_active,
    p_weekdays
  );
END;
$pagesave$;

COMMENT ON FUNCTION public.ai_employee_page_routine_save(uuid, text, text, integer, time, boolean, integer[]) IS
  'Owner menyimpan irama halaman, termasuk hari yang dipilih.';

REVOKE ALL ON FUNCTION public.ai_employee_page_routine_save(uuid, text, text, integer, time, boolean, integer[]) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_page_routine_save(uuid, text, text, integer, time, boolean, integer[]) TO authenticated;

DROP FUNCTION IF EXISTS public.ai_employee_page_routine_save(uuid, text, text, integer, time, boolean);
DROP FUNCTION IF EXISTS public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean);

CREATE OR REPLACE FUNCTION public.ai_employee_profiles_retarget_schedules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone text := COALESCE(NULLIF(btrim(NEW.time_zone), ''), 'Asia/Jakarta');
BEGIN
  IF NEW.time_zone IS NOT DISTINCT FROM OLD.time_zone THEN
    RETURN NEW;
  END IF;

  UPDATE public.ai_employee_schedules AS schedule
  SET next_run_at = public.ai_employee_next_run_at(
    schedule.weekday,
    schedule.start_local,
    v_zone,
    clock_timestamp()
  )
  WHERE schedule.employee_id = NEW.employee_id
    AND schedule.organization_id = NEW.organization_id
    AND schedule.is_active;

  UPDATE public.ai_employee_routines AS routine
  SET next_run_at = public.ai_employee_next_routine_at(
    routine.cadence,
    routine.weekday,
    routine.time_local,
    v_zone,
    clock_timestamp(),
    routine.weekdays
  )
  WHERE routine.employee_id = NEW.employee_id
    AND routine.organization_id = NEW.organization_id
    AND routine.is_active;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_claim_due_routines()
RETURNS TABLE (
  routine_id uuid,
  employee_id uuid,
  organization_id uuid,
  action_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT routine.id
    FROM public.ai_employee_routines AS routine
    JOIN public.ai_employee_profiles AS profile
      ON profile.employee_id = routine.employee_id
     AND profile.organization_id = routine.organization_id
    JOIN public.employees AS employee
      ON employee.id = routine.employee_id
     AND employee.organization_id = routine.organization_id
    WHERE routine.is_active
      AND profile.is_active
      AND COALESCE(employee.is_ai, false)
      AND routine.action_code IN ('work_report.daily', 'work_report.weekly', 'work_report.monthly')
      AND COALESCE(profile.performance_status, '') <> 'disabled'
      AND routine.next_run_at IS NOT NULL
      AND routine.next_run_at <= clock_timestamp()
    ORDER BY routine.next_run_at, routine.id
    FOR UPDATE OF routine SKIP LOCKED
    LIMIT 5
  LOOP
    RETURN QUERY
    UPDATE public.ai_employee_routines AS routine
    SET next_run_at = public.ai_employee_next_routine_at(
      routine.cadence,
      routine.weekday,
      routine.time_local,
      COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta'),
      clock_timestamp(),
      routine.weekdays
    )
    FROM public.ai_employee_profiles AS profile
    WHERE routine.id = v_id
      AND profile.employee_id = routine.employee_id
      AND profile.organization_id = routine.organization_id
      AND routine.next_run_at <= clock_timestamp()
    RETURNING routine.id, routine.employee_id, routine.organization_id, routine.action_code;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_claim_due_routines() IS
  'Mengunci laporan harian, mingguan, atau bulanan yang jatuh tempo dan memajukan next_run_at.';

CREATE OR REPLACE FUNCTION public.mcp_list_ai_employee_routines(
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

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'action_code', routine.action_code,
      'cadence', routine.cadence,
      'weekday', routine.weekday,
      'weekdays', routine.weekdays,
      'time_local', to_char(routine.time_local, 'HH24:MI'),
      'is_active', routine.is_active,
      'next_run_at', routine.next_run_at,
      'last_sent_at', routine.last_sent_at,
      'last_status', routine.last_status,
      'reviewer_name', reviewer.full_name,
      'deliveries', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'status', delivery.status,
          'period_start', delivery.period_start,
          'period_end', delivery.period_end,
          'created_at', delivery.created_at,
          'summary', delivery.summary,
          'error', left(delivery.error, 240)
        ) ORDER BY delivery.created_at DESC)
        FROM (
          SELECT status, period_start, period_end, created_at, summary, error
          FROM public.ai_employee_routine_deliveries delivery
          WHERE delivery.routine_id = routine.id
          ORDER BY delivery.created_at DESC, delivery.id DESC
          LIMIT 5
        ) delivery
      ), '[]'::jsonb)
    ) ORDER BY routine.action_code)
    FROM public.ai_employee_routines routine
    JOIN public.ai_employee_profiles profile
      ON profile.employee_id = routine.employee_id
     AND profile.organization_id = routine.organization_id
    LEFT JOIN public.employees reviewer
      ON reviewer.id = profile.reviewer_employee_id
     AND reviewer.organization_id = routine.organization_id
    WHERE routine.employee_id = p_employee_id
      AND routine.organization_id = p_organization_id
  ), '[]'::jsonb);
END;
$list$;

COMMENT ON FUNCTION public.mcp_list_ai_employee_routines(uuid, uuid, uuid) IS
  'Daftar rutinitas untuk owner atau admin. Tidak mengembalikan alamat email.';

CREATE OR REPLACE FUNCTION public.ai_employee_page_read(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $read$
DECLARE
  v_org uuid;
  v_can_edit boolean;
  v_name text;
  v_title text;
  v_reviewer text;
  v_status text;
  v_active boolean;
  v_brief jsonb;
  v_service_ids uuid[];
  v_persona_ids uuid[];
  v_pillar_ids uuid[];
  v_product_ids uuid[];
  v_key_results jsonb;
  v_runs jsonb;
  v_jobs jsonb;
  v_schedules jsonb;
  v_routines jsonb;
  v_services jsonb;
  v_personas jsonb;
  v_pillars jsonb;
  v_products jsonb;
  v_cap integer;
  v_used integer;
  v_remaining integer;
  v_date date;
  v_org_limit integer;
  v_org_used integer;
  v_org_date date;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, false);

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = auth.uid()
      AND role.organization_id = v_org
      AND lower(btrim(role.role)) = 'owner'
  )
  INTO v_can_edit;

  SELECT employee.full_name,
         profile.job_title,
         reviewer.full_name,
         profile.performance_status,
         profile.is_active
  INTO v_name, v_title, v_reviewer, v_status, v_active
  FROM public.employees employee
  LEFT JOIN public.ai_employee_profiles profile
    ON profile.employee_id = employee.id
   AND profile.organization_id = employee.organization_id
  LEFT JOIN public.employees reviewer
    ON reviewer.id = profile.reviewer_employee_id
   AND reviewer.organization_id = employee.organization_id
  WHERE employee.id = p_employee_id
    AND employee.organization_id = v_org;

  v_brief := public.ai_employee_brief_payload(p_employee_id);
  v_service_ids := public.ai_employee_brief_ids(v_brief->'service_ids');
  v_persona_ids := public.ai_employee_brief_ids(v_brief->'persona_ids');
  v_pillar_ids := public.ai_employee_brief_ids(v_brief->'pillar_ids');
  v_product_ids := public.ai_employee_brief_ids(v_brief->'product_knowledge_ids');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', kr.ai_kr_code,
    'title', kr.title,
    'current_value', kr.current_value,
    'target_value', kr.target_value,
    'unit', kr.unit,
    'progress_percentage', kr.progress_percentage
  ) ORDER BY kr.ai_kr_code, kr.title), '[]'::jsonb)
  INTO v_key_results
  FROM public.key_results kr
  JOIN public.individual_objectives objective
    ON objective.id = kr.individual_objective_id
  WHERE objective.organization_id = v_org
    AND objective.employee_id = p_employee_id
    AND kr.ai_kr_code IN ('KR1', 'KR2', 'KR3', 'KR4', 'KR5');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', run.id,
    'started_at', run.started_at,
    'finished_at', run.finished_at,
    'sop_code', run.sop_code,
    'status', run.status,
    'plan_count', run.plan_count,
    'note', left(COALESCE(run.note, ''), 240),
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', plan.id,
        'title', COALESCE(plan.title, '')
      ) ORDER BY plan.title)
      FROM public.social_media_plans plan
      WHERE plan.organization_id = v_org
        AND plan.id = ANY (run.object_ids)
    ), '[]'::jsonb)
  ) ORDER BY run.started_at DESC), '[]'::jsonb)
  INTO v_runs
  FROM (
    SELECT id, started_at, finished_at, sop_code, status, plan_count, note, object_ids
    FROM public.ai_employee_runs
    WHERE employee_id = p_employee_id
      AND organization_id = v_org
    ORDER BY started_at DESC, id DESC
    LIMIT 20
  ) run;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', job.id,
    'source', job.source,
    'priority', job.priority,
    'status', job.status,
    'attempts', job.attempts,
    'reason', job.reason,
    'daily_task_id', job.daily_task_id,
    'plan_id', job.plan_id,
    'run_id', job.run_id,
    'next_attempt_at', job.next_attempt_at,
    'created_at', job.created_at,
    'claimed_at', job.claimed_at,
    'finished_at', job.finished_at
  ) ORDER BY job.created_at DESC, job.id DESC), '[]'::jsonb)
  INTO v_jobs
  FROM (
    SELECT id, source, priority, status, attempts, reason, daily_task_id, plan_id,
           run_id, next_attempt_at, created_at, claimed_at, finished_at
    FROM public.ai_employee_jobs
    WHERE employee_id = p_employee_id
      AND organization_id = v_org
    ORDER BY created_at DESC, id DESC
    LIMIT 20
  ) job;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'sop_code', schedule.sop_code,
    'weekday', schedule.weekday,
    'start_local', to_char(schedule.start_local, 'HH24:MI'),
    'due_local', to_char(schedule.due_local, 'HH24:MI'),
    'is_active', schedule.is_active,
    'next_run_at', schedule.next_run_at
  ) ORDER BY schedule.sop_code), '[]'::jsonb)
  INTO v_schedules
  FROM public.ai_employee_schedules schedule
  WHERE schedule.employee_id = p_employee_id
    AND schedule.organization_id = v_org;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'action_code', routine.action_code,
    'cadence', routine.cadence,
    'weekday', routine.weekday,
    'weekdays', routine.weekdays,
    'time_local', to_char(routine.time_local, 'HH24:MI'),
    'is_active', routine.is_active,
    'next_run_at', routine.next_run_at,
    'last_sent_at', routine.last_sent_at,
    'last_status', routine.last_status,
    'last_error', left(routine.last_error, 240),
    'reviewer_name', reviewer.full_name,
    'reviewer_email', NULLIF(btrim(reviewer.email), '')
  ) ORDER BY routine.action_code), '[]'::jsonb)
  INTO v_routines
  FROM public.ai_employee_routines routine
  JOIN public.ai_employee_profiles profile
    ON profile.employee_id = routine.employee_id
   AND profile.organization_id = routine.organization_id
  LEFT JOIN public.employees reviewer
    ON reviewer.id = profile.reviewer_employee_id
   AND reviewer.organization_id = routine.organization_id
  WHERE routine.employee_id = p_employee_id
    AND routine.organization_id = v_org;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_services
  FROM (
    SELECT svc.id, left(btrim(svc.name), 80) AS label
    FROM public.services svc
    WHERE svc.organization_id = v_org
      AND (
        COALESCE(svc.is_active, true)
        OR svc.id = ANY (v_service_ids)
      )
      AND (
        svc.id = ANY (v_service_ids)
        OR svc.id IN (
          SELECT picked.id
          FROM public.services picked
          WHERE picked.organization_id = v_org
            AND COALESCE(picked.is_active, true)
          ORDER BY picked.name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_personas
  FROM (
    SELECT knowledge.id,
           left(btrim(COALESCE(NULLIF(btrim(knowledge.feature_name), ''), 'Persona')), 80) AS label
    FROM public.product_knowledge knowledge
    WHERE knowledge.organization_id = v_org
      AND (
        knowledge.id = ANY (v_persona_ids)
        OR knowledge.id IN (
          SELECT picked.id
          FROM public.product_knowledge picked
          WHERE picked.organization_id = v_org
          ORDER BY picked.feature_name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_pillars
  FROM (
    SELECT pillar.id, left(btrim(pillar.name), 80) AS label
    FROM public.content_pillars pillar
    WHERE (
        pillar.id = ANY (v_pillar_ids)
        OR (
          pillar.is_active
          AND (pillar.organization_id = v_org OR pillar.is_default)
        )
      )
      AND (
        pillar.id = ANY (v_pillar_ids)
        OR pillar.id IN (
          SELECT picked.id
          FROM public.content_pillars picked
          WHERE picked.is_active
            AND (picked.organization_id = v_org OR picked.is_default)
          ORDER BY picked.name
          LIMIT 200
        )
      )
  ) item;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'label', item.label,
    'service_id', item.service_id,
    'parent_service_id', item.parent_service_id
  ) ORDER BY item.label), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT knowledge.id,
           left(btrim(COALESCE(NULLIF(btrim(knowledge.feature_name), ''), 'Produk')), 80) AS label,
           knowledge.service_id,
           sub.service_id AS parent_service_id
    FROM public.product_knowledge knowledge
    LEFT JOIN public.sub_services sub
      ON sub.id = knowledge.sub_service_id
     AND sub.organization_id = knowledge.organization_id
    WHERE knowledge.organization_id = v_org
      AND (
        knowledge.id = ANY (v_product_ids)
        OR knowledge.id IN (
          SELECT picked.id
          FROM public.product_knowledge picked
          WHERE picked.organization_id = v_org
          ORDER BY picked.feature_name
          LIMIT 200
        )
      )
  ) item;

  v_date := (timezone('Asia/Jakarta', now()))::date;
  v_org_date := (timezone('UTC', now()))::date;

  SELECT CASE WHEN profile.performance_status = 'coaching' THEN 8 ELSE 15 END
  INTO v_cap
  FROM public.ai_employee_profiles profile
  WHERE profile.employee_id = p_employee_id
    AND profile.organization_id = v_org;

  SELECT calls.call_count
  INTO v_used
  FROM public.ai_employee_model_calls calls
  WHERE calls.employee_id = p_employee_id
    AND calls.usage_date = v_date;
  v_used := COALESCE(v_used, 0);
  IF v_cap IS NULL THEN
    v_remaining := NULL;
  ELSE
    v_remaining := GREATEST(v_cap - v_used, 0);
  END IF;

  SELECT COALESCE(config.daily_limit, 50)
  INTO v_org_limit
  FROM public.organization_script_ai_config config
  WHERE config.organization_id = v_org;
  IF v_org_limit IS NULL OR v_org_limit < 1 THEN
    v_org_limit := 50;
  END IF;

  SELECT COALESCE(usage."count", 0)
  INTO v_org_used
  FROM public.script_ai_daily_usage usage
  WHERE usage.organization_id = v_org
    AND usage.usage_date = v_org_date;
  v_org_used := COALESCE(v_org_used, 0);

  RETURN jsonb_build_object(
    'organization_id', v_org,
    'can_edit', v_can_edit,
    'summary', jsonb_build_object(
      'full_name', v_name,
      'job_title', v_title,
      'reviewer_name', v_reviewer,
      'performance_status', v_status,
      'is_active', v_active
    ),
    'key_results', v_key_results,
    'runs', v_runs,
    'jobs', v_jobs,
    'schedules', v_schedules,
    'routines', v_routines,
    'brief', v_brief,
    'options', jsonb_build_object(
      'services', v_services,
      'personas', v_personas,
      'pillars', v_pillars,
      'products', v_products
    ),
    'quota', jsonb_build_object(
      'usage_date', v_date,
      'used', v_used,
      'cap', v_cap,
      'remaining', v_remaining,
      'org_usage_date', v_org_date,
      'org_used', v_org_used,
      'org_limit', v_org_limit,
      'org_remaining', GREATEST(v_org_limit - v_org_used, 0)
    )
  );
END;
$read$;

COMMENT ON FUNCTION public.ai_employee_page_read(uuid) IS
  'Isi halaman karyawan AI untuk owner/admin organisasi itu. Termasuk rutinitas. Tidak menulis kuota dan tidak mengembalikan claim_token.';
