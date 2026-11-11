-- Content Plan Carousel hanya Harian. Frekuensi adalah daftar jam.
-- Setiap jam membuat satu plan. Jarak melingkar antar jam minimal 60 menit.
-- Mingguan dan Bulanan tetap tersimpan, tetapi tidak aktif dan tidak diklaim.

ALTER TABLE public.ai_employee_schedules
  ADD COLUMN IF NOT EXISTS start_times time[];

UPDATE public.ai_employee_schedules AS schedule
SET start_times = ARRAY[schedule.start_local]
WHERE schedule.start_times IS NULL
   OR cardinality(schedule.start_times) = 0;

INSERT INTO public.ai_employee_schedules (
  employee_id, organization_id, sop_code, weekday, start_local, due_local,
  is_active, cadence, weekdays, plan_count, start_times
)
SELECT
  weekly.employee_id,
  weekly.organization_id,
  'SOP1',
  NULL,
  weekly.start_local,
  weekly.start_local,
  false,
  'days',
  ARRAY[]::smallint[],
  1,
  ARRAY[weekly.start_local]
FROM public.ai_employee_schedules AS weekly
WHERE weekly.sop_code = 'SOP1'
  AND weekly.cadence = 'weekly'
  AND NOT EXISTS (
    SELECT 1
    FROM public.ai_employee_schedules AS days
    WHERE days.employee_id = weekly.employee_id
      AND days.organization_id = weekly.organization_id
      AND days.sop_code = 'SOP1'
      AND days.cadence = 'days'
  );

UPDATE public.ai_employee_schedules AS days
SET
  weekdays = ARRAY[weekly.weekday]::smallint[],
  start_local = weekly.start_local,
  due_local = weekly.start_local,
  start_times = ARRAY[weekly.start_local],
  plan_count = 1,
  is_active = true
FROM public.ai_employee_schedules AS weekly
WHERE days.sop_code = 'SOP1'
  AND days.cadence = 'days'
  AND days.is_active IS NOT TRUE
  AND weekly.employee_id = days.employee_id
  AND weekly.organization_id = days.organization_id
  AND weekly.sop_code = 'SOP1'
  AND weekly.cadence = 'weekly'
  AND weekly.is_active IS TRUE
  AND weekly.weekday BETWEEN 1 AND 7;

UPDATE public.ai_employee_schedules AS schedule
SET is_active = false
WHERE schedule.sop_code = 'SOP1'
  AND schedule.cadence IN ('weekly', 'monthly')
  AND schedule.is_active IS TRUE;

UPDATE public.ai_employee_schedules AS schedule
SET
  plan_count = 1,
  start_times = COALESCE(
    NULLIF(schedule.start_times, ARRAY[]::time[]),
    ARRAY[schedule.start_local]
  ),
  start_local = (
    SELECT min(slot)
    FROM unnest(COALESCE(NULLIF(schedule.start_times, ARRAY[]::time[]), ARRAY[schedule.start_local])) AS slot
  ),
  due_local = (
    SELECT min(slot)
    FROM unnest(COALESCE(NULLIF(schedule.start_times, ARRAY[]::time[]), ARRAY[schedule.start_local])) AS slot
  )
WHERE schedule.sop_code = 'SOP1'
  AND schedule.cadence = 'days';

UPDATE public.ai_employee_schedules AS schedule
SET plan_count = 1
WHERE schedule.cadence = 'days'
  AND schedule.plan_count IS DISTINCT FROM 1;

ALTER TABLE public.ai_employee_schedules
  ALTER COLUMN start_times SET NOT NULL;

CREATE OR REPLACE FUNCTION public.ai_employee_schedules_fill_start_times()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fill$
BEGIN
  IF NEW.start_times IS NULL OR cardinality(NEW.start_times) = 0 THEN
    NEW.start_times := ARRAY[COALESCE(NEW.start_local, TIME '09:00')];
  END IF;
  RETURN NEW;
END;
$fill$;

DROP TRIGGER IF EXISTS ai_employee_schedules_fill_start_times ON public.ai_employee_schedules;
CREATE TRIGGER ai_employee_schedules_fill_start_times
  BEFORE INSERT OR UPDATE ON public.ai_employee_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_employee_schedules_fill_start_times();

CREATE OR REPLACE FUNCTION public.ai_employee_start_times_ok(p_times time[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $ok$
  SELECT COALESCE(cardinality(p_times), 0) BETWEEN 1 AND 7
    AND (
      SELECT count(DISTINCT slot)
      FROM unnest(p_times) AS slot
    ) = cardinality(p_times)
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(p_times) AS left_slot
      JOIN unnest(p_times) AS right_slot
        ON left_slot < right_slot
      WHERE LEAST(
        abs(extract(epoch FROM (right_slot - left_slot))),
        86400 - abs(extract(epoch FROM (right_slot - left_slot)))
      ) < 3600
    );
$ok$;

ALTER TABLE public.ai_employee_schedules
  DROP CONSTRAINT IF EXISTS ai_employee_schedules_days_plan_count_check;

ALTER TABLE public.ai_employee_schedules
  ADD CONSTRAINT ai_employee_schedules_days_plan_count_check
  CHECK (cadence <> 'days' OR plan_count = 1);

ALTER TABLE public.ai_employee_schedules
  DROP CONSTRAINT IF EXISTS ai_employee_schedules_days_start_times_check;

ALTER TABLE public.ai_employee_schedules
  ADD CONSTRAINT ai_employee_schedules_days_start_times_check
  CHECK (
    cadence <> 'days'
    OR sop_code <> 'SOP1'
    OR public.ai_employee_start_times_ok(start_times)
  );

COMMENT ON COLUMN public.ai_employee_schedules.start_times IS
  'Jam bangun Content Plan pada ritme harian. Setiap jam membuat satu plan. Jarak melingkar minimal 60 menit, paling banyak 7.';

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
  v_times time[] := ARRAY[]::time[];
  v_time time;
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

  IF p_cadence = 'days' THEN
    SELECT schedule.start_times
    INTO v_times
    FROM public.ai_employee_schedules schedule
    WHERE schedule.employee_id = p_employee_id
      AND schedule.organization_id = p_organization_id
      AND schedule.sop_code = 'SOP1'
      AND schedule.cadence = 'days'
    LIMIT 1;

    IF v_times IS NULL OR cardinality(v_times) = 0 THEN
      v_times := ARRAY[p_start];
    ELSE
      SELECT COALESCE(array_agg(slot ORDER BY slot), ARRAY[]::time[])
      INTO v_times
      FROM unnest(v_times) AS slot
      WHERE slot IS NOT NULL;
      IF v_times IS NULL OR cardinality(v_times) = 0 THEN
        v_times := ARRAY[p_start];
      END IF;
    END IF;
  END IF;

  v_local := timezone(v_zone, p_after);

  FOR v_offset IN 0..400 LOOP
    v_day := v_local::date + v_offset;
    v_dow := EXTRACT(ISODOW FROM v_day)::integer;
    v_month_end := v_day = (date_trunc('month', v_day::timestamp) + interval '1 month' - interval '1 day')::date;

    IF p_cadence = 'monthly' AND v_month_end THEN
      v_candidate := v_day + p_start;
      IF v_candidate > v_local THEN
        RETURN v_candidate AT TIME ZONE v_zone;
      END IF;
    END IF;

    IF p_cadence = 'weekly'
       AND v_dow = p_weekday
       AND NOT (v_month_end AND v_monthly_active) THEN
      v_candidate := v_day + p_start;
      IF v_candidate > v_local THEN
        RETURN v_candidate AT TIME ZONE v_zone;
      END IF;
    END IF;

    IF p_cadence = 'days'
       AND v_dow = ANY (p_weekdays)
       AND NOT (v_weekly_active AND v_dow = v_weekly)
       AND NOT (v_month_end AND v_monthly_active) THEN
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

COMMENT ON FUNCTION public.ai_employee_next_content_at(uuid, uuid, text, smallint, smallint[], time, text, timestamptz) IS
  'Jam berikutnya untuk content plan. Harian memakai setiap jam di start_times dan melewati slot yang sudah lewat.';

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
      AND schedule.cadence = 'days'
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
  'Mengunci jadwal Harian SOP1 yang jatuh tempo dan memajukan next_run_at ke jam berikutnya.';

DROP FUNCTION IF EXISTS public.ai_employee_page_schedule_save(uuid, text, text, integer, smallint[], time, integer, boolean);
DROP FUNCTION IF EXISTS public.ai_employee_schedule_write(uuid, uuid, uuid, text, text, integer, smallint[], time, integer, boolean);

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
  p_start_times time[],
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
  v_times time[];
  v_id uuid;
  v_prev jsonb;
  v_weekday smallint;
  v_start time;
  v_count smallint;
  v_active boolean;
  v_next timestamptz;
  v_saved_times time[];
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
  IF v_code = 'SOP1' AND v_cadence <> 'days' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT day ORDER BY day), ARRAY[]::smallint[])
  INTO v_days
  FROM unnest(COALESCE(p_weekdays, ARRAY[]::smallint[])) AS day
  WHERE day BETWEEN 1 AND 7;

  SELECT COALESCE(array_agg(DISTINCT slot ORDER BY slot), ARRAY[]::time[])
  INTO v_times
  FROM unnest(COALESCE(NULLIF(p_start_times, ARRAY[]::time[]), ARRAY[p_start_local])) AS slot
  WHERE slot IS NOT NULL;

  IF v_code = 'SOP1' THEN
    IF NOT public.ai_employee_start_times_ok(v_times) THEN
      RAISE EXCEPTION 'times_too_close' USING ERRCODE = '22023';
    END IF;
    p_plan_count := 1;
    p_start_local := v_times[1];
  ELSE
    v_times := ARRAY[p_start_local];
  END IF;

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
    'start_times', COALESCE((
      SELECT jsonb_agg(to_char(slot, 'HH24:MI') ORDER BY slot)
      FROM unnest(schedule.start_times) AS slot
    ), '[]'::jsonb),
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
        start_times = v_times,
        plan_count = p_plan_count::smallint,
        is_active = p_is_active
    WHERE schedule.id = v_id
    RETURNING schedule.weekday, schedule.start_local, schedule.plan_count, schedule.is_active, schedule.next_run_at, schedule.start_times
    INTO v_weekday, v_start, v_count, v_active, v_next, v_saved_times;
  EXCEPTION
    WHEN check_violation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END;

  IF v_code = 'SOP1' THEN
    UPDATE public.ai_employee_schedules schedule
    SET is_active = false
    WHERE schedule.employee_id = p_employee_id
      AND schedule.organization_id = p_organization_id
      AND schedule.sop_code = v_code
      AND schedule.cadence IN ('weekly', 'monthly');
  ELSIF v_cadence = 'weekly' AND p_is_active THEN
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
      'start_times', COALESCE((
        SELECT jsonb_agg(to_char(slot, 'HH24:MI') ORDER BY slot)
        FROM unnest(v_saved_times) AS slot
      ), '[]'::jsonb),
      'plan_count', v_count,
      'is_active', v_active,
      'next_run_at', v_next
    )
  );
END;
$schedule$;

COMMENT ON FUNCTION public.ai_employee_schedule_write(uuid, uuid, uuid, text, text, integer, smallint[], time, integer, time[], boolean) IS
  'Mengubah jadwal yang sudah ada. SOP1 hanya harian, satu plan per jam, jarak minimal satu jam.';

CREATE OR REPLACE FUNCTION public.ai_employee_page_schedule_save(
  p_employee_id uuid,
  p_sop_code text,
  p_cadence text,
  p_weekday integer,
  p_weekdays smallint[],
  p_start_local time,
  p_plan_count integer,
  p_start_times time[],
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
    p_start_times,
    p_is_active
  );
END;
$pageschedule$;

COMMENT ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, text, integer, smallint[], time, integer, time[], boolean) IS
  'Owner mengubah jadwal Harian Content Plan.';

REVOKE ALL ON FUNCTION public.ai_employee_schedules_fill_start_times() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_start_times_ok(time[]) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_start_times_ok(time[]) TO authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_schedule_write(uuid, uuid, uuid, text, text, integer, smallint[], time, integer, time[], boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, text, integer, smallint[], time, integer, time[], boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_page_schedule_save(uuid, text, text, integer, smallint[], time, integer, time[], boolean) TO authenticated;

DO $page$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_page_read(uuid)'::regprocedure),
    E'\r',
    ''
  );
  marker text := $old$'due_local', to_char(schedule.due_local, 'HH24:MI'),$old$;
  insertion text := replace($new$'due_local', to_char(schedule.due_local, 'HH24:MI'),
    'start_times', COALESCE((
      SELECT jsonb_agg(to_char(slot, 'HH24:MI') ORDER BY slot)
      FROM unnest(COALESCE(schedule.start_times, ARRAY[schedule.start_local])) AS slot
    ), '[]'::jsonb),$new$, E'\r', '');
BEGIN
  IF position(marker IN def) = 0 THEN
    RAISE EXCEPTION 'schedule start_times snippet missing';
  END IF;
  IF position(
    $already$'start_times', COALESCE(($already$
    IN substring(def FROM position(marker IN def) FOR 500)
  ) = 0 THEN
    def := replace(def, marker, insertion);
    EXECUTE def;
  END IF;
END;
$page$;

CREATE OR REPLACE FUNCTION public.ai_employee_sop1_manual_begin(
  p_user_id uuid,
  p_employee_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $manual$
DECLARE
  v_org uuid;
  v_active boolean;
  v_performance text;
  v_run uuid;
BEGIN
  SELECT employee.organization_id, profile.is_active, profile.performance_status
  INTO v_org, v_active, v_performance
  FROM public.employees employee
  LEFT JOIN public.ai_employee_profiles profile
    ON profile.employee_id = employee.id
   AND profile.organization_id = employee.organization_id
  WHERE employee.id = p_employee_id
    AND COALESCE(employee.is_ai, false)
  FOR UPDATE OF employee;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.ai_employee_require_owner(p_user_id, v_org);

  IF v_active IS NOT TRUE OR v_performance = 'disabled' THEN
    RAISE EXCEPTION 'profile_inactive' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_employee_runs run
    WHERE run.employee_id = p_employee_id
      AND run.organization_id = v_org
      AND run.sop_code = 'SOP1'
      AND run.status = 'running'
  ) THEN
    RAISE EXCEPTION 'too_soon' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ai_employee_runs (employee_id, organization_id, sop_code, status, note)
  VALUES (p_employee_id, v_org, 'SOP1', 'running', 'manual')
  RETURNING id INTO v_run;

  RETURN v_run;
END;
$manual$;

COMMENT ON FUNCTION public.ai_employee_sop1_manual_begin(uuid, uuid) IS
  'Owner memulai satu Content Plan sekarang. Tidak menggeser jadwal. Ditolak hanya bila run SOP1 masih berstatus berjalan.';

REVOKE ALL ON FUNCTION public.ai_employee_sop1_manual_begin(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_sop1_manual_begin(uuid, uuid) TO ai_employee_runner;

NOTIFY pgrst, 'reload schema';
