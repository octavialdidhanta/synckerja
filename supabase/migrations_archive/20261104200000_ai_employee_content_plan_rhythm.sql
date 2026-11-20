-- Content Plan punya tiga ritme: harian, mingguan, dan bulanan.
-- Jam Mulai adalah saat draf dikerjakan. due_local tidak lagi menjadi batas.
-- Frekuensi (plan_count) adalah jumlah draf pada giliran itu, 1 sampai 7.
-- Baris SOP1 yang sudah ada menjadi mingguan dengan frekuensi 1.

ALTER TABLE public.ai_employee_schedules
  ADD COLUMN IF NOT EXISTS cadence text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS weekdays smallint[] NOT NULL DEFAULT ARRAY[]::smallint[],
  ADD COLUMN IF NOT EXISTS plan_count smallint NOT NULL DEFAULT 1;

ALTER TABLE public.ai_employee_schedules
  DROP CONSTRAINT IF EXISTS ai_employee_schedules_weekday_check;

ALTER TABLE public.ai_employee_schedules
  ALTER COLUMN weekday DROP NOT NULL;

ALTER TABLE public.ai_employee_schedules
  DROP CONSTRAINT IF EXISTS ai_employee_schedules_due_after_start;

UPDATE public.ai_employee_schedules AS schedule
SET due_local = schedule.start_local,
    plan_count = 1,
    weekdays = ARRAY[]::smallint[]
WHERE schedule.sop_code = 'SOP1'
  AND schedule.cadence = 'weekly'
  AND NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_schedules other
    WHERE other.employee_id = schedule.employee_id
      AND other.organization_id = schedule.organization_id
      AND other.sop_code = schedule.sop_code
      AND other.cadence = 'days'
  );

ALTER TABLE public.ai_employee_schedules
  ADD CONSTRAINT ai_employee_schedules_due_after_start
  CHECK (due_local >= start_local);

ALTER TABLE public.ai_employee_schedules
  DROP CONSTRAINT IF EXISTS ai_employee_schedules_cadence_check;

ALTER TABLE public.ai_employee_schedules
  ADD CONSTRAINT ai_employee_schedules_cadence_check
  CHECK (
    (cadence = 'days' AND weekday IS NULL)
    OR (cadence = 'weekly' AND weekday BETWEEN 1 AND 7)
    OR (cadence = 'monthly' AND weekday IS NULL)
  );

ALTER TABLE public.ai_employee_schedules
  DROP CONSTRAINT IF EXISTS ai_employee_schedules_plan_count_check;

ALTER TABLE public.ai_employee_schedules
  ADD CONSTRAINT ai_employee_schedules_plan_count_check
  CHECK (plan_count BETWEEN 1 AND 7);

ALTER TABLE public.ai_employee_schedules
  DROP CONSTRAINT IF EXISTS ai_employee_schedules_weekdays_check;

ALTER TABLE public.ai_employee_schedules
  ADD CONSTRAINT ai_employee_schedules_weekdays_check
  CHECK (weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]);

CREATE OR REPLACE FUNCTION public.ai_employee_next_content_at(
  p_employee_id uuid,
  p_organization_id uuid,
  p_cadence text,
  p_weekday smallint,
  p_weekdays smallint[],
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
  v_month_end boolean;
  v_offset integer;
  v_weekly smallint;
  v_weekly_active boolean := false;
  v_monthly_active boolean := false;
BEGIN
  IF p_start IS NULL OR p_after IS NULL OR p_cadence NOT IN ('days', 'weekly', 'monthly') THEN
    RETURN NULL;
  END IF;
  IF p_cadence = 'days' AND COALESCE(cardinality(p_weekdays), 0) < 1 THEN
    RETURN NULL;
  END IF;
  IF p_cadence = 'weekly' AND (p_weekday IS NULL OR p_weekday < 1 OR p_weekday > 7) THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zone) THEN
    v_zone := 'Asia/Jakarta';
  END IF;

  SELECT schedule.weekday, schedule.is_active
  INTO v_weekly, v_weekly_active
  FROM public.ai_employee_schedules schedule
  WHERE schedule.employee_id = p_employee_id
    AND schedule.organization_id = p_organization_id
    AND schedule.sop_code = 'SOP1'
    AND schedule.cadence = 'weekly'
  LIMIT 1;

  SELECT schedule.is_active
  INTO v_monthly_active
  FROM public.ai_employee_schedules schedule
  WHERE schedule.employee_id = p_employee_id
    AND schedule.organization_id = p_organization_id
    AND schedule.sop_code = 'SOP1'
    AND schedule.cadence = 'monthly'
  LIMIT 1;

  v_weekly_active := COALESCE(v_weekly_active, false)
    AND v_weekly IS NOT NULL
    AND v_weekly BETWEEN 1 AND 7;
  v_monthly_active := COALESCE(v_monthly_active, false);
  v_local := timezone(v_zone, p_after);

  FOR v_offset IN 0..400 LOOP
    v_day := v_local::date + v_offset;
    v_candidate := v_day + p_start;
    IF v_candidate <= v_local THEN
      CONTINUE;
    END IF;
    v_dow := EXTRACT(ISODOW FROM v_day)::integer;
    v_month_end := v_day = (date_trunc('month', v_day::timestamp) + interval '1 month' - interval '1 day')::date;

    IF p_cadence = 'monthly' AND v_month_end THEN
      RETURN v_candidate AT TIME ZONE v_zone;
    END IF;

    IF p_cadence = 'weekly'
       AND v_dow = p_weekday
       AND NOT (v_month_end AND v_monthly_active) THEN
      RETURN v_candidate AT TIME ZONE v_zone;
    END IF;

    IF p_cadence = 'days'
       AND v_dow = ANY (p_weekdays)
       AND NOT (v_weekly_active AND v_dow = v_weekly)
       AND NOT (v_month_end AND v_monthly_active) THEN
      RETURN v_candidate AT TIME ZONE v_zone;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_next_content_at(uuid, uuid, text, smallint, smallint[], time, text, timestamptz) IS
  'Jam Mulai berikutnya untuk ritme content plan. Harian melewati hari mingguan yang aktif dan tanggal terakhir bila bulanan aktif.';

CREATE OR REPLACE FUNCTION public.ai_employee_content_schedules_retarget(
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
BEGIN
  SELECT COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta')
  INTO v_zone
  FROM public.ai_employee_profiles profile
  WHERE profile.employee_id = p_employee_id
    AND profile.organization_id = p_organization_id;

  v_zone := COALESCE(v_zone, 'Asia/Jakarta');

  FOR v_row IN
    SELECT schedule.id, schedule.cadence, schedule.weekday, schedule.weekdays, schedule.start_local
    FROM public.ai_employee_schedules schedule
    WHERE schedule.employee_id = p_employee_id
      AND schedule.organization_id = p_organization_id
      AND schedule.sop_code = 'SOP1'
  LOOP
    UPDATE public.ai_employee_schedules schedule
    SET next_run_at = public.ai_employee_next_content_at(
      p_employee_id,
      p_organization_id,
      v_row.cadence,
      v_row.weekday,
      v_row.weekdays,
      v_row.start_local,
      v_zone,
      clock_timestamp()
    )
    WHERE schedule.id = v_row.id
      AND schedule.next_run_at IS DISTINCT FROM public.ai_employee_next_content_at(
        p_employee_id,
        p_organization_id,
        v_row.cadence,
        v_row.weekday,
        v_row.weekdays,
        v_row.start_local,
        v_zone,
        clock_timestamp()
      );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_content_schedules_retarget(uuid, uuid) IS
  'Menghitung ulang next_run_at tiga ritme SOP1 milik satu karyawan.';

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

DROP TRIGGER IF EXISTS ai_employee_schedules_next_run ON public.ai_employee_schedules;
CREATE TRIGGER ai_employee_schedules_next_run
  AFTER INSERT OR UPDATE ON public.ai_employee_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_employee_schedules_set_next_run();

CREATE OR REPLACE FUNCTION public.ai_employee_profiles_retarget_schedules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone text;
BEGIN
  IF NEW.time_zone IS NOT DISTINCT FROM OLD.time_zone THEN
    RETURN NEW;
  END IF;

  v_zone := COALESCE(NULLIF(btrim(NEW.time_zone), ''), 'Asia/Jakarta');
  PERFORM public.ai_employee_content_schedules_retarget(NEW.employee_id, NEW.organization_id);

  UPDATE public.ai_employee_schedules AS schedule
  SET next_run_at = public.ai_employee_next_run_at(
    schedule.weekday,
    schedule.start_local,
    v_zone,
    clock_timestamp()
  )
  WHERE schedule.employee_id = NEW.employee_id
    AND schedule.organization_id = NEW.organization_id
    AND schedule.is_active
    AND schedule.sop_code IS DISTINCT FROM 'SOP1'
    AND schedule.weekday BETWEEN 1 AND 7;

  RETURN NEW;
END;
$$;

INSERT INTO public.ai_employee_schedules (
  employee_id, organization_id, sop_code, weekday, start_local, due_local,
  is_active, cadence, weekdays, plan_count
)
SELECT
  weekly.employee_id,
  weekly.organization_id,
  weekly.sop_code,
  NULL,
  weekly.start_local,
  weekly.start_local,
  false,
  'days',
  ARRAY[]::smallint[],
  1
FROM public.ai_employee_schedules weekly
WHERE weekly.sop_code = 'SOP1'
  AND weekly.cadence = 'weekly'
  AND NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_schedules other
    WHERE other.employee_id = weekly.employee_id
      AND other.organization_id = weekly.organization_id
      AND other.sop_code = weekly.sop_code
      AND other.cadence = 'days'
  );

INSERT INTO public.ai_employee_schedules (
  employee_id, organization_id, sop_code, weekday, start_local, due_local,
  is_active, cadence, weekdays, plan_count
)
SELECT
  weekly.employee_id,
  weekly.organization_id,
  weekly.sop_code,
  NULL,
  weekly.start_local,
  weekly.start_local,
  false,
  'monthly',
  ARRAY[]::smallint[],
  1
FROM public.ai_employee_schedules weekly
WHERE weekly.sop_code = 'SOP1'
  AND weekly.cadence = 'weekly'
  AND NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_schedules other
    WHERE other.employee_id = weekly.employee_id
      AND other.organization_id = weekly.organization_id
      AND other.sop_code = weekly.sop_code
      AND other.cadence = 'monthly'
  );

CREATE UNIQUE INDEX IF NOT EXISTS ai_employee_schedules_cadence_key
  ON public.ai_employee_schedules (employee_id, organization_id, sop_code, cadence);

DO $retarget$
DECLARE
  v_row record;
BEGIN
  FOR v_row IN
    SELECT DISTINCT schedule.employee_id, schedule.organization_id
    FROM public.ai_employee_schedules schedule
    WHERE schedule.sop_code = 'SOP1'
  LOOP
    PERFORM public.ai_employee_content_schedules_retarget(v_row.employee_id, v_row.organization_id);
  END LOOP;
END;
$retarget$;

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
    SET next_run_at = public.ai_employee_next_content_at(
          schedule.employee_id,
          schedule.organization_id,
          schedule.cadence,
          schedule.weekday,
          schedule.weekdays,
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

COMMENT ON FUNCTION public.ai_employee_claim_due_schedules() IS
  'Mengunci jadwal SOP1 yang jatuh tempo dan memajukan next_run_at menurut ritmenya.';

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
        'mode', 'sop1',
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
$dispatch$;

COMMENT ON FUNCTION public.ai_employee_dispatch() IS
  'Cron tiap menit. SOP1 membawa schedule_id, lalu job, lalu rutinitas.';

DROP FUNCTION IF EXISTS public.ai_employee_schedule_write(uuid, uuid, uuid, text, integer, time, time, boolean);

CREATE OR REPLACE FUNCTION public.ai_employee_schedule_write(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_sop_code text,
  p_cadence text,
  p_weekday integer,
  p_weekdays smallint[],
  p_start_local time,
  p_plan_count integer,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $schedule$
DECLARE
  v_code text := NULLIF(btrim(COALESCE(p_sop_code, '')), '');
  v_cadence text := NULLIF(btrim(COALESCE(p_cadence, '')), '');
  v_days smallint[];
  v_id uuid;
  v_prev jsonb;
  v_weekday smallint;
  v_start time;
  v_count smallint;
  v_active boolean;
  v_next timestamptz;
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
  IF v_code IS NULL
    OR v_cadence NOT IN ('days', 'weekly', 'monthly')
    OR p_start_local IS NULL
    OR p_plan_count IS NULL
    OR p_plan_count < 1
    OR p_plan_count > 7
    OR p_is_active IS NULL
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT day ORDER BY day), ARRAY[]::smallint[])
  INTO v_days
  FROM unnest(COALESCE(p_weekdays, ARRAY[]::smallint[])) AS day
  WHERE day BETWEEN 1 AND 7;

  IF v_cadence = 'weekly' AND (p_weekday IS NULL OR p_weekday < 1 OR p_weekday > 7) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF v_cadence = 'days' AND p_is_active AND COALESCE(cardinality(v_days), 0) < 1 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT schedule.id
  INTO v_id
  FROM public.ai_employee_schedules schedule
  WHERE schedule.employee_id = p_employee_id
    AND schedule.organization_id = p_organization_id
    AND schedule.sop_code = v_code
    AND schedule.cadence = v_cadence
  FOR UPDATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'schedule_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'sop_code', schedule.sop_code,
    'cadence', schedule.cadence,
    'weekday', schedule.weekday,
    'weekdays', schedule.weekdays,
    'start_local', to_char(schedule.start_local, 'HH24:MI'),
    'plan_count', schedule.plan_count,
    'is_active', schedule.is_active,
    'next_run_at', schedule.next_run_at
  )
  INTO v_prev
  FROM public.ai_employee_schedules schedule
  WHERE schedule.id = v_id;

  BEGIN
    UPDATE public.ai_employee_schedules schedule
    SET weekday = CASE WHEN v_cadence = 'weekly' THEN p_weekday::smallint ELSE NULL END,
        weekdays = CASE WHEN v_cadence = 'days' THEN v_days ELSE ARRAY[]::smallint[] END,
        start_local = p_start_local,
        due_local = p_start_local,
        plan_count = p_plan_count::smallint,
        is_active = p_is_active
    WHERE schedule.id = v_id
    RETURNING schedule.weekday, schedule.start_local, schedule.plan_count, schedule.is_active, schedule.next_run_at
    INTO v_weekday, v_start, v_count, v_active, v_next;
  EXCEPTION
    WHEN check_violation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END;

  IF v_cadence = 'weekly' AND p_is_active THEN
    UPDATE public.ai_employee_schedules schedule
    SET weekdays = COALESCE((
          SELECT array_agg(day ORDER BY day)
          FROM unnest(schedule.weekdays) AS day
          WHERE day IS DISTINCT FROM p_weekday::smallint
        ), ARRAY[]::smallint[]),
        is_active = CASE
          WHEN cardinality(array_remove(schedule.weekdays, p_weekday::smallint)) = 0 THEN false
          ELSE schedule.is_active
        END
    WHERE schedule.employee_id = p_employee_id
      AND schedule.organization_id = p_organization_id
      AND schedule.sop_code = v_code
      AND schedule.cadence = 'days';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'previous', v_prev,
    'schedule', jsonb_build_object(
      'sop_code', v_code,
      'cadence', v_cadence,
      'weekday', v_weekday,
      'weekdays', CASE WHEN v_cadence = 'days' THEN v_days ELSE ARRAY[]::smallint[] END,
      'start_local', to_char(v_start, 'HH24:MI'),
      'plan_count', v_count,
      'is_active', v_active,
      'next_run_at', v_next
    )
  );
END;
$schedule$;

COMMENT ON FUNCTION public.ai_employee_schedule_write(uuid, uuid, uuid, text, text, integer, smallint[], time, integer, boolean) IS
  'Mengubah satu ritme jadwal yang sudah ada. Jam selesai disamakan dengan jam mulai.';

DROP FUNCTION IF EXISTS public.ai_employee_page_schedule_save(uuid, text, integer, time, time, boolean);

CREATE OR REPLACE FUNCTION public.ai_employee_page_schedule_save(
  p_employee_id uuid,
  p_sop_code text,
  p_cadence text,
  p_weekday integer,
  p_weekdays smallint[],
  p_start_local time,
  p_plan_count integer,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $pageschedule$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  RETURN public.ai_employee_schedule_write(
    auth.uid(),
    v_org,
    p_employee_id,
    p_sop_code,
    p_cadence,
    p_weekday,
    p_weekdays,
    p_start_local,
    p_plan_count,
    p_is_active
  );
END;
$pageschedule$;

COMMENT ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, text, integer, smallint[], time, integer, boolean) IS
  'Owner mengubah satu ritme Content Plan.';

REVOKE ALL ON FUNCTION public.ai_employee_next_content_at(uuid, uuid, text, smallint, smallint[], time, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_content_schedules_retarget(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_employee_schedule_write(uuid, uuid, uuid, text, text, integer, smallint[], time, integer, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, text, integer, smallint[], time, integer, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

GRANT EXECUTE ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, text, integer, smallint[], time, integer, boolean) TO authenticated;

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
  v_copy_1 text;
  v_copy_2 text;
  v_sender text;
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
    'cadence', schedule.cadence,
    'weekday', schedule.weekday,
    'weekdays', schedule.weekdays,
    'start_local', to_char(schedule.start_local, 'HH24:MI'),
    'due_local', to_char(schedule.due_local, 'HH24:MI'),
    'plan_count', schedule.plan_count,
    'is_active', schedule.is_active,
    'next_run_at', schedule.next_run_at
  ) ORDER BY schedule.sop_code, schedule.cadence), '[]'::jsonb)
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

  SELECT profile.report_copy_email_1,
         profile.report_copy_email_2,
         COALESCE(
           NULLIF(btrim(sender.full_name), ''),
           NULLIF(btrim(v_reviewer), '')
         )
  INTO v_copy_1, v_copy_2, v_sender
  FROM public.ai_employee_profiles profile
  LEFT JOIN public.profiles sender
    ON sender.user_id = profile.report_sender_user_id
  WHERE profile.employee_id = p_employee_id
    AND profile.organization_id = v_org;

  RETURN jsonb_build_object(
    'organization_id', v_org,
    'can_edit', v_can_edit,
    'summary', jsonb_build_object(
      'full_name', v_name,
      'job_title', v_title,
      'reviewer_name', v_reviewer,
      'performance_status', v_status,
      'is_active', v_active,
      'report_copy_email_1', v_copy_1,
      'report_copy_email_2', v_copy_2,
      'report_sender_name', v_sender
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
  'Isi halaman karyawan AI. Jadwal Content Plan mengembalikan ritme, hari, dan frekuensi.';

NOTIFY pgrst, 'reload schema';
