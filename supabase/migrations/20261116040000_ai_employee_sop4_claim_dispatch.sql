-- Fase 7: cron/dispatch SOP4 Design Story (separate next_story_at; do not overload SOP1 next_content_at).

CREATE OR REPLACE FUNCTION public.ai_employee_next_story_at(
  p_weekdays smallint[],
  p_start_times time[],
  p_start time,
  p_time_zone text,
  p_after timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_zone text := COALESCE(NULLIF(btrim(p_time_zone), ''), 'Asia/Jakarta');
  v_local timestamp;
  v_day date;
  v_candidate timestamp;
  v_dow integer;
  v_offset integer;
  v_times time[] := ARRAY[]::time[];
  v_time time;
BEGIN
  IF p_after IS NULL OR COALESCE(cardinality(p_weekdays), 0) < 1 THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zone) THEN
    v_zone := 'Asia/Jakarta';
  END IF;

  IF p_start_times IS NOT NULL AND cardinality(p_start_times) > 0 THEN
    SELECT COALESCE(array_agg(slot ORDER BY slot), ARRAY[]::time[])
    INTO v_times
    FROM unnest(p_start_times) AS slot
    WHERE slot IS NOT NULL;
  END IF;

  IF v_times IS NULL OR cardinality(v_times) = 0 THEN
    IF p_start IS NULL THEN
      RETURN NULL;
    END IF;
    v_times := ARRAY[p_start];
  END IF;

  v_local := timezone(v_zone, p_after);

  FOR v_offset IN 0..400 LOOP
    v_day := v_local::date + v_offset;
    v_dow := EXTRACT(ISODOW FROM v_day)::integer;
    IF v_dow = ANY (p_weekdays) THEN
      FOREACH v_time IN ARRAY v_times LOOP
        v_candidate := v_day + v_time;
        IF v_candidate > v_local THEN
          RETURN v_candidate AT TIME ZONE v_zone;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_next_story_at(smallint[], time[], time, text, timestamptz) IS
  'Next Design Story (SOP4) run: days cadence only, weekdays + start_times, no SOP1 weekly/monthly coupling.';

REVOKE ALL ON FUNCTION public.ai_employee_next_story_at(smallint[], time[], time, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_employee_next_story_at(smallint[], time[], time, text, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ai_employee_story_schedules_retarget(
  p_employee_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone text;
  v_row record;
  v_next timestamptz;
BEGIN
  SELECT COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta')
  INTO v_zone
  FROM public.ai_employee_profiles profile
  WHERE profile.employee_id = p_employee_id
    AND profile.organization_id = p_organization_id;

  v_zone := COALESCE(v_zone, 'Asia/Jakarta');

  FOR v_row IN
    SELECT
      schedule.id,
      schedule.weekdays,
      schedule.start_times,
      schedule.start_local,
      schedule.is_active
    FROM public.ai_employee_schedules schedule
    WHERE schedule.employee_id = p_employee_id
      AND schedule.organization_id = p_organization_id
      AND schedule.sop_code = 'SOP4'
      AND schedule.cadence = 'days'
  LOOP
    IF v_row.is_active IS DISTINCT FROM TRUE THEN
      UPDATE public.ai_employee_schedules schedule
      SET next_run_at = NULL
      WHERE schedule.id = v_row.id
        AND schedule.next_run_at IS NOT NULL;
      CONTINUE;
    END IF;

    v_next := public.ai_employee_next_story_at(
      v_row.weekdays,
      v_row.start_times,
      v_row.start_local,
      v_zone,
      clock_timestamp()
    );

    UPDATE public.ai_employee_schedules schedule
    SET next_run_at = v_next
    WHERE schedule.id = v_row.id
      AND schedule.next_run_at IS DISTINCT FROM v_next;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_story_schedules_retarget(uuid, uuid) IS
  'Recalculate next_run_at for Design Story SOP4 day schedules.';

REVOKE ALL ON FUNCTION public.ai_employee_story_schedules_retarget(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_story_schedules_retarget(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ai_employee_schedules_set_next_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.cadence IS NOT DISTINCT FROM OLD.cadence
     AND NEW.weekday IS NOT DISTINCT FROM OLD.weekday
     AND NEW.weekdays IS NOT DISTINCT FROM OLD.weekdays
     AND NEW.start_local IS NOT DISTINCT FROM OLD.start_local
     AND NEW.start_times IS NOT DISTINCT FROM OLD.start_times
     AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active
     AND NEW.sop_code IS NOT DISTINCT FROM OLD.sop_code
     AND NEW.employee_id IS NOT DISTINCT FROM OLD.employee_id
     AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
  THEN
    RETURN NEW;
  END IF;

  IF NEW.sop_code = 'SOP1' THEN
    PERFORM public.ai_employee_content_schedules_retarget(NEW.employee_id, NEW.organization_id);
    RETURN NEW;
  END IF;

  IF NEW.sop_code = 'SOP4' THEN
    PERFORM public.ai_employee_story_schedules_retarget(NEW.employee_id, NEW.organization_id);
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta')
  INTO v_zone
  FROM public.ai_employee_profiles profile
  WHERE profile.employee_id = NEW.employee_id
    AND profile.organization_id = NEW.organization_id;

  UPDATE public.ai_employee_schedules schedule
  SET next_run_at = public.ai_employee_next_run_at(
    NEW.weekday,
    NEW.start_local,
    COALESCE(v_zone, 'Asia/Jakarta'),
    clock_timestamp()
  )
  WHERE schedule.id = NEW.id
    AND NEW.weekday BETWEEN 1 AND 7;

  RETURN NEW;
END;
$$;

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
      AND schedule.cadence = 'days'
      AND profile.is_active
      AND COALESCE(employee.is_ai, false)
      AND schedule.sop_code IN ('SOP1', 'SOP4')
      AND COALESCE(profile.performance_status, '') <> 'disabled'
      AND schedule.next_run_at IS NOT NULL
      AND schedule.next_run_at <= clock_timestamp()
    ORDER BY schedule.next_run_at, schedule.id
    FOR UPDATE OF schedule SKIP LOCKED
    LIMIT 5
  LOOP
    RETURN QUERY
    UPDATE public.ai_employee_schedules AS schedule
    SET next_run_at = CASE schedule.sop_code
          WHEN 'SOP4' THEN public.ai_employee_next_story_at(
            schedule.weekdays,
            schedule.start_times,
            schedule.start_local,
            COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta'),
            clock_timestamp()
          )
          ELSE public.ai_employee_next_content_at(
            schedule.employee_id,
            schedule.organization_id,
            schedule.cadence,
            schedule.weekday,
            schedule.weekdays,
            schedule.start_local,
            COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta'),
            clock_timestamp()
          )
        END,
        last_claimed_at = clock_timestamp()
    FROM public.ai_employee_profiles AS profile
    WHERE schedule.id = v_id
      AND profile.employee_id = schedule.employee_id
      AND profile.organization_id = schedule.organization_id
      AND schedule.next_run_at <= clock_timestamp()
    RETURNING schedule.id, schedule.employee_id, schedule.organization_id, schedule.sop_code;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_claim_due_schedules() IS
  'Locks due SOP1 or SOP4 day schedules and advances next_run_at (content_at vs story_at).';

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
  v_busy uuid[] := '{}'::uuid[];
  v_mode text;
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
    SELECT claimed.schedule_id, claimed.employee_id, claimed.sop_code
    FROM public.ai_employee_claim_due_schedules() AS claimed
  LOOP
    v_mode := lower(btrim(COALESCE(v_row.sop_code, 'SOP1')));
    IF v_mode NOT IN ('sop1', 'sop4') THEN
      v_mode := 'sop1';
    END IF;
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
        'mode', v_mode,
        'schedule_id', v_row.schedule_id
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

  FOR v_row IN
    SELECT claimed.routine_id, claimed.employee_id
    FROM public.ai_employee_claim_due_routines() AS claimed
  LOOP
    v_count := v_count + 1;
    PERFORM net.http_post(
      url := rtrim(v_url, '/') || '/functions/v1/ai-employee-routine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-synckerja-internal-secret', v_secret
      ),
      body := jsonb_build_object(
        'employee_id', v_row.employee_id,
        'routine_id', v_row.routine_id
      ),
      timeout_milliseconds := 60000
    );
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_dispatch() IS
  'Dispatches due SOP1/SOP4 schedules (mode from sop_code), jobs, and routines.';

-- One-shot: fill next_run_at for active SOP4 schedules that are still null.
DO $retarget$
DECLARE
  v_row record;
BEGIN
  FOR v_row IN
    SELECT DISTINCT schedule.employee_id, schedule.organization_id
    FROM public.ai_employee_schedules schedule
    WHERE schedule.sop_code = 'SOP4'
      AND schedule.cadence = 'days'
  LOOP
    PERFORM public.ai_employee_story_schedules_retarget(v_row.employee_id, v_row.organization_id);
  END LOOP;
END;
$retarget$;
