BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
-- Prioritas satu tanggal: bulanan mengalahkan mingguan dan harian, mingguan mengalahkan harian.
-- Butuh 20261103115000. Hari mingguan yang aktif dibuang dari harian. Harian boleh kosong hanya saat tidak aktif.
-- Periode harian mulai tengah malam. Mingguan melewati tanggal terakhir bila bulanan aktif.

ALTER TABLE public.ai_employee_profiles
  ADD COLUMN IF NOT EXISTS report_copy_email_1 text,
  ADD COLUMN IF NOT EXISTS report_copy_email_2 text,
  ADD COLUMN IF NOT EXISTS report_sender_user_id uuid;

ALTER TABLE public.ai_employee_profiles
  DROP CONSTRAINT IF EXISTS ai_employee_profiles_report_copy_email_1_check,
  DROP CONSTRAINT IF EXISTS ai_employee_profiles_report_copy_email_2_check,
  DROP CONSTRAINT IF EXISTS ai_employee_profiles_report_copy_distinct_check;

ALTER TABLE public.ai_employee_profiles
  ADD CONSTRAINT ai_employee_profiles_report_copy_email_1_check
  CHECK (
    report_copy_email_1 IS NULL
    OR (
      char_length(report_copy_email_1) <= 320
      AND report_copy_email_1 = lower(report_copy_email_1)
      AND report_copy_email_1 ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  ),
  ADD CONSTRAINT ai_employee_profiles_report_copy_email_2_check
  CHECK (
    report_copy_email_2 IS NULL
    OR (
      char_length(report_copy_email_2) <= 320
      AND report_copy_email_2 = lower(report_copy_email_2)
      AND report_copy_email_2 ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  ),
  ADD CONSTRAINT ai_employee_profiles_report_copy_distinct_check
  CHECK (
    report_copy_email_1 IS NULL
    OR report_copy_email_2 IS NULL
    OR report_copy_email_1 <> report_copy_email_2
  );

CREATE OR REPLACE FUNCTION public.ai_employee_report_email(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(COALESCE(p_value, '')));
BEGIN
  IF v_email = '' THEN
    RETURN NULL;
  END IF;
  IF char_length(v_email) > 320
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;
  RETURN v_email;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_report_email(text) IS
  'Menormalisasi satu alamat laporan. Kosong menjadi null. Format salah ditolak.';

REVOKE ALL ON FUNCTION public.ai_employee_report_email(text) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

CREATE OR REPLACE FUNCTION public.ai_employee_report_day_counts(
  p_at timestamptz,
  p_time_zone text,
  p_exclude_weekday smallint,
  p_exclude_month_end boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_local timestamp;
BEGIN
  IF p_at IS NULL THEN
    RETURN false;
  END IF;
  v_local := timezone(p_time_zone, p_at);
  IF p_exclude_weekday IS NOT NULL
     AND EXTRACT(ISODOW FROM v_local)::integer = p_exclude_weekday
  THEN
    RETURN false;
  END IF;
  IF COALESCE(p_exclude_month_end, false)
     AND v_local::date = (date_trunc('month', v_local) + interval '1 month' - interval '1 day')::date
  THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_report_day_counts(timestamptz, text, smallint, boolean) IS
  'True bila waktu lokal itu masuk hitungan. Weekday atau tanggal terakhir yang dikecualikan tidak masuk.';

REVOKE ALL ON FUNCTION public.ai_employee_report_day_counts(timestamptz, text, smallint, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

CREATE OR REPLACE FUNCTION public.ai_employee_next_report_at(
  p_employee_id uuid,
  p_organization_id uuid,
  p_action_code text,
  p_cadence text,
  p_weekday smallint,
  p_weekdays smallint[],
  p_time time,
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
  v_weekly smallint := NULL;
  v_monthly boolean := false;
  v_slot timestamptz;
  v_local timestamp;
  v_blocked boolean;
  v_guard integer := 0;
BEGIN
  IF p_cadence = 'days' AND COALESCE(cardinality(p_weekdays), 0) < 1 THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zone) THEN
    v_zone := 'Asia/Jakarta';
  END IF;

  IF p_action_code IS DISTINCT FROM 'work_report.weekly' THEN
    SELECT routine.weekday
    INTO v_weekly
    FROM public.ai_employee_routines routine
    WHERE routine.employee_id = p_employee_id
      AND routine.organization_id = p_organization_id
      AND routine.action_code = 'work_report.weekly'
      AND routine.is_active;
  END IF;

  IF p_action_code IS DISTINCT FROM 'work_report.monthly' THEN
    SELECT true
    INTO v_monthly
    FROM public.ai_employee_routines routine
    WHERE routine.employee_id = p_employee_id
      AND routine.organization_id = p_organization_id
      AND routine.action_code = 'work_report.monthly'
      AND routine.is_active;
    v_monthly := COALESCE(v_monthly, false);
  END IF;

  v_slot := public.ai_employee_next_routine_at(
    p_cadence,
    p_weekday,
    p_time,
    v_zone,
    p_after,
    p_weekdays
  );

  IF p_cadence = 'monthly' OR (v_weekly IS NULL AND NOT v_monthly) THEN
    RETURN v_slot;
  END IF;

  LOOP
    v_local := timezone(v_zone, v_slot);
    v_blocked := false;
    IF v_monthly
       AND v_local::date = (date_trunc('month', v_local) + interval '1 month' - interval '1 day')::date
    THEN
      v_blocked := true;
    END IF;
    IF p_cadence = 'days'
       AND v_weekly IS NOT NULL
       AND EXTRACT(ISODOW FROM v_local)::integer = v_weekly
    THEN
      v_blocked := true;
    END IF;
    EXIT WHEN NOT v_blocked;

    IF p_cadence = 'weekly' THEN
      v_slot := (timezone(v_zone, v_slot) + interval '7 days') AT TIME ZONE v_zone;
    ELSE
      v_slot := public.ai_employee_next_routine_at(
        'days',
        NULL,
        p_time,
        v_zone,
        v_slot,
        p_weekdays
      );
    END IF;

    v_guard := v_guard + 1;
    IF v_guard > 370 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN v_slot;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_next_report_at(uuid, uuid, text, text, smallint, smallint[], time, text, timestamptz) IS
  'Slot berikutnya dengan prioritas saudara. Bulanan aktif menahan tanggal terakhir. Mingguan aktif menahan weekday-nya pada harian.';

REVOKE ALL ON FUNCTION public.ai_employee_next_report_at(uuid, uuid, text, text, smallint, smallint[], time, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

CREATE OR REPLACE FUNCTION public.ai_employee_report_apply_priority(
  p_employee_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weekday smallint;
  v_zone text;
BEGIN
  SELECT routine.weekday
  INTO v_weekday
  FROM public.ai_employee_routines routine
  WHERE routine.employee_id = p_employee_id
    AND routine.organization_id = p_organization_id
    AND routine.action_code = 'work_report.weekly'
    AND routine.is_active;

  IF v_weekday IS NOT NULL THEN
    UPDATE public.ai_employee_routines AS daily
    SET weekdays = COALESCE((
          SELECT array_agg(day::smallint ORDER BY day)
          FROM unnest(daily.weekdays) AS day
          WHERE day IS DISTINCT FROM v_weekday
        ), '{}'::smallint[]),
        is_active = CASE
          WHEN COALESCE((
            SELECT count(*)
            FROM unnest(daily.weekdays) AS day
            WHERE day IS DISTINCT FROM v_weekday
          ), 0) = 0 THEN false
          ELSE daily.is_active
        END
    WHERE daily.employee_id = p_employee_id
      AND daily.organization_id = p_organization_id
      AND daily.action_code = 'work_report.daily'
      AND v_weekday = ANY (daily.weekdays);
  END IF;

  SELECT COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta')
  INTO v_zone
  FROM public.ai_employee_profiles profile
  WHERE profile.employee_id = p_employee_id
    AND profile.organization_id = p_organization_id;
  v_zone := COALESCE(v_zone, 'Asia/Jakarta');

  UPDATE public.ai_employee_routines AS routine
  SET next_run_at = public.ai_employee_next_report_at(
    routine.employee_id,
    routine.organization_id,
    routine.action_code,
    routine.cadence,
    routine.weekday,
    routine.weekdays,
    routine.time_local,
    v_zone,
    clock_timestamp()
  )
  WHERE routine.employee_id = p_employee_id
    AND routine.organization_id = p_organization_id
    AND routine.is_active
    AND routine.action_code IN ('work_report.daily', 'work_report.weekly');
END;
$$;

COMMENT ON FUNCTION public.ai_employee_report_apply_priority(uuid, uuid) IS
  'Membuang hari mingguan dari harian, mematikan harian yang kosong, lalu menghitung ulang slot harian dan mingguan.';

REVOKE ALL ON FUNCTION public.ai_employee_report_apply_priority(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

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
  NEW.next_run_at := public.ai_employee_next_report_at(
    NEW.employee_id,
    NEW.organization_id,
    NEW.action_code,
    NEW.cadence,
    NEW.weekday,
    NEW.weekdays,
    NEW.time_local,
    COALESCE(v_zone, 'Asia/Jakarta'),
    clock_timestamp()
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_routine_summary(
  p_employee_id uuid,
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_weekday smallint,
  p_exclude_month_end boolean,
  p_time_zone text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $summary$
DECLARE
  v_zone text := COALESCE(NULLIF(btrim(p_time_zone), ''), 'Asia/Jakarta');
  v_succeeded integer;
  v_failed integer;
  v_other integer;
  v_plans integer;
  v_done integer;
  v_rejected integer;
  v_job_failed integer;
  v_key_results jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zone) THEN
    v_zone := 'Asia/Jakarta';
  END IF;

  SELECT
    count(*) FILTER (WHERE run.status = 'succeeded')::integer,
    count(*) FILTER (WHERE run.status = 'failed')::integer,
    count(*) FILTER (WHERE run.status NOT IN ('succeeded', 'failed'))::integer,
    COALESCE(sum(run.plan_count), 0)::integer
  INTO v_succeeded, v_failed, v_other, v_plans
  FROM public.ai_employee_runs run
  WHERE run.employee_id = p_employee_id
    AND run.organization_id = p_organization_id
    AND run.started_at >= p_start
    AND run.started_at < p_end
    AND public.ai_employee_report_day_counts(
      run.started_at,
      v_zone,
      p_exclude_weekday,
      p_exclude_month_end
    );

  SELECT
    count(*) FILTER (WHERE job.status = 'done')::integer,
    count(*) FILTER (WHERE job.status = 'rejected')::integer,
    count(*) FILTER (WHERE job.status = 'failed')::integer
  INTO v_done, v_rejected, v_job_failed
  FROM public.ai_employee_jobs job
  WHERE job.employee_id = p_employee_id
    AND job.organization_id = p_organization_id
    AND job.finished_at >= p_start
    AND job.finished_at < p_end
    AND public.ai_employee_report_day_counts(
      job.finished_at,
      v_zone,
      p_exclude_weekday,
      p_exclude_month_end
    );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', kr.ai_kr_code,
    'title', left(COALESCE(kr.title, ''), 120),
    'current_value', kr.current_value,
    'target_value', kr.target_value,
    'unit', kr.unit,
    'progress_percentage', kr.progress_percentage
  ) ORDER BY kr.ai_kr_code), '[]'::jsonb)
  INTO v_key_results
  FROM public.key_results kr
  JOIN public.individual_objectives objective
    ON objective.id = kr.individual_objective_id
  WHERE objective.organization_id = p_organization_id
    AND objective.employee_id = p_employee_id
    AND kr.ai_kr_code IN ('KR1', 'KR2', 'KR3', 'KR4', 'KR5');

  RETURN jsonb_build_object(
    'runs_succeeded', COALESCE(v_succeeded, 0),
    'runs_failed', COALESCE(v_failed, 0),
    'runs_other', COALESCE(v_other, 0),
    'plans_created', COALESCE(v_plans, 0),
    'jobs_done', COALESCE(v_done, 0),
    'jobs_rejected', COALESCE(v_rejected, 0),
    'jobs_failed', COALESCE(v_job_failed, 0),
    'key_results', COALESCE(v_key_results, '[]'::jsonb)
  );
END;
$summary$;

COMMENT ON FUNCTION public.ai_employee_routine_summary(uuid, uuid, timestamptz, timestamptz, smallint, boolean, text) IS
  'Hitungan pekerjaan content planner. Weekday atau tanggal terakhir yang dikecualikan tidak masuk. KR tetap snapshot saat ini.';

REVOKE ALL ON FUNCTION public.ai_employee_routine_summary(uuid, uuid, timestamptz, timestamptz, smallint, boolean, text) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

CREATE OR REPLACE FUNCTION public.ai_employee_routine_prepare(p_routine_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $prepare$
DECLARE
  v_routine public.ai_employee_routines;
  v_name text;
  v_reviewer_name text;
  v_email text;
  v_zone text;
  v_active boolean;
  v_performance text;
  v_sender_id uuid;
  v_sender text;
  v_copy_1 text;
  v_copy_2 text;
  v_start timestamptz;
  v_end timestamptz := clock_timestamp();
  v_exclude_weekday smallint := NULL;
  v_exclude_month_end boolean := false;
BEGIN
  IF p_routine_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT routine.*
  INTO v_routine
  FROM public.ai_employee_routines routine
  WHERE routine.id = p_routine_id;

  IF NOT FOUND OR v_routine.action_code NOT IN ('work_report.daily', 'work_report.weekly', 'work_report.monthly') THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT employee.full_name,
         profile.is_active,
         profile.performance_status,
         COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta'),
         NULLIF(btrim(reviewer.email), ''),
         NULLIF(btrim(reviewer.full_name), ''),
         profile.report_copy_email_1,
         profile.report_copy_email_2,
         profile.report_sender_user_id
  INTO v_name, v_active, v_performance, v_zone, v_email, v_reviewer_name, v_copy_1, v_copy_2, v_sender_id
  FROM public.employees employee
  JOIN public.ai_employee_profiles profile
    ON profile.employee_id = employee.id
   AND profile.organization_id = employee.organization_id
  LEFT JOIN public.employees reviewer
    ON reviewer.id = profile.reviewer_employee_id
   AND reviewer.organization_id = employee.organization_id
  WHERE employee.id = v_routine.employee_id
    AND employee.organization_id = v_routine.organization_id
    AND COALESCE(employee.is_ai, false);

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zone) THEN
    v_zone := 'Asia/Jakarta';
  END IF;

  SELECT NULLIF(btrim(sender.full_name), '')
  INTO v_sender
  FROM public.profiles sender
  WHERE sender.user_id = v_sender_id;
  v_sender := COALESCE(v_sender, v_reviewer_name, NULLIF(btrim(v_name), ''));

  IF v_routine.action_code = 'work_report.daily' THEN
    v_start := date_trunc('day', timezone(v_zone, v_end)) AT TIME ZONE v_zone;
    SELECT routine.weekday
    INTO v_exclude_weekday
    FROM public.ai_employee_routines routine
    WHERE routine.employee_id = v_routine.employee_id
      AND routine.organization_id = v_routine.organization_id
      AND routine.action_code = 'work_report.weekly'
      AND routine.is_active;
    SELECT true
    INTO v_exclude_month_end
    FROM public.ai_employee_routines routine
    WHERE routine.employee_id = v_routine.employee_id
      AND routine.organization_id = v_routine.organization_id
      AND routine.action_code = 'work_report.monthly'
      AND routine.is_active;
    v_exclude_month_end := COALESCE(v_exclude_month_end, false);
  ELSIF v_routine.cadence = 'weekly' THEN
    IF v_routine.last_sent_at IS NOT NULL AND v_routine.last_sent_at < v_end THEN
      v_start := v_routine.last_sent_at;
    ELSE
      v_start := v_end - interval '7 days';
    END IF;
    SELECT true
    INTO v_exclude_month_end
    FROM public.ai_employee_routines routine
    WHERE routine.employee_id = v_routine.employee_id
      AND routine.organization_id = v_routine.organization_id
      AND routine.action_code = 'work_report.monthly'
      AND routine.is_active;
    v_exclude_month_end := COALESCE(v_exclude_month_end, false);
  ELSIF v_routine.cadence = 'monthly' THEN
    IF v_routine.last_sent_at IS NOT NULL AND v_routine.last_sent_at < v_end THEN
      v_start := v_routine.last_sent_at;
    ELSE
      v_start := date_trunc('month', timezone(v_zone, v_end)) AT TIME ZONE v_zone;
    END IF;
  ELSE
    v_start := v_end - interval '24 hours';
  END IF;

  IF v_copy_1 IS NOT NULL AND lower(v_copy_1) = lower(COALESCE(v_email, '')) THEN
    v_copy_1 := NULL;
  END IF;
  IF v_copy_2 IS NOT NULL AND lower(v_copy_2) = lower(COALESCE(v_email, '')) THEN
    v_copy_2 := NULL;
  END IF;
  IF v_copy_1 IS NOT NULL AND v_copy_1 = v_copy_2 THEN
    v_copy_2 := NULL;
  END IF;

  RETURN jsonb_build_object(
    'routine_id', v_routine.id,
    'employee_id', v_routine.employee_id,
    'organization_id', v_routine.organization_id,
    'action_code', v_routine.action_code,
    'employee_name', COALESCE(v_name, ''),
    'sender_name', COALESCE(v_sender, ''),
    'recipient_email', v_email,
    'copy_emails', COALESCE((
      SELECT jsonb_agg(item.email ORDER BY item.slot)
      FROM (
        SELECT 1 AS slot, v_copy_1 AS email
        UNION ALL
        SELECT 2, v_copy_2
      ) item
      WHERE item.email IS NOT NULL
    ), '[]'::jsonb),
    'period_start', v_start,
    'period_end', v_end,
    'summary', public.ai_employee_routine_summary(
      v_routine.employee_id,
      v_routine.organization_id,
      v_start,
      v_end,
      v_exclude_weekday,
      v_exclude_month_end,
      v_zone
    ),
    'skip_reason', CASE
      WHEN v_active IS NOT TRUE OR v_performance = 'disabled' THEN 'profile_inactive'
      WHEN v_email IS NULL THEN 'reviewer_email_missing'
      ELSE NULL
    END
  );
END;
$prepare$;

COMMENT ON FUNCTION public.ai_employee_routine_prepare(uuid) IS
  'Menyiapkan satu irama. Harian mulai tengah malam. Nama pengirim dari profile yang menyimpan, atau nama reviewer. Email tambahan tidak menggantikan penerima utama.';

CREATE OR REPLACE FUNCTION public.ai_employee_routine_write(
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
  v_block smallint;
  v_active boolean := p_is_active;
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

  IF v_action = 'work_report.daily' AND v_cadence = 'days' THEN
    v_weekday := NULL;
    SELECT routine.weekday
    INTO v_block
    FROM public.ai_employee_routines routine
    WHERE routine.employee_id = p_employee_id
      AND routine.organization_id = p_organization_id
      AND routine.action_code = 'work_report.weekly'
      AND routine.is_active;
    IF v_block IS NOT NULL THEN
      SELECT COALESCE(array_agg(day::smallint ORDER BY day), '{}'::smallint[])
      INTO v_weekdays
      FROM unnest(v_weekdays) AS day
      WHERE day IS DISTINCT FROM v_block;
    END IF;
    IF COALESCE(cardinality(v_weekdays), 0) = 0 THEN
      v_active := false;
    ELSIF cardinality(v_weekdays) > 7 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
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
      v_active
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

  PERFORM public.ai_employee_report_apply_priority(p_employee_id, p_organization_id);

  SELECT routine.*
  INTO v_next
  FROM public.ai_employee_routines routine
  WHERE routine.id = v_next.id;

  RETURN jsonb_build_object(
    'ok', true,
    'previous', CASE WHEN v_previous.id IS NULL THEN NULL ELSE public.ai_employee_routine_view(v_previous) END,
    'routine', public.ai_employee_routine_view(v_next)
  );
END;
$write$;

COMMENT ON FUNCTION public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean, integer[]) IS
  'Owner menyimpan satu irama. Menyimpan mingguan membuang hari yang sama dari harian. Harian tanpa hari tersisa dimatikan.';

REVOKE ALL ON FUNCTION public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean, integer[]) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean, integer[]) TO service_role;

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
  SET next_run_at = public.ai_employee_next_report_at(
    routine.employee_id,
    routine.organization_id,
    routine.action_code,
    routine.cadence,
    routine.weekday,
    routine.weekdays,
    routine.time_local,
    v_zone,
    clock_timestamp()
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
    SET next_run_at = public.ai_employee_next_report_at(
      routine.employee_id,
      routine.organization_id,
      routine.action_code,
      routine.cadence,
      routine.weekday,
      routine.weekdays,
      routine.time_local,
      COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta'),
      clock_timestamp()
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
  'Mengunci laporan yang jatuh tempo dan memajukan next_run_at dengan prioritas saudara.';

CREATE OR REPLACE FUNCTION public.ai_employee_report_copies_write(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_email_1 text,
  p_email_2 text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $copies$
DECLARE
  v_one text;
  v_two text;
  v_reviewer text;
BEGIN
  PERFORM public.ai_employee_require_owner(p_user_id, p_organization_id);
  v_one := public.ai_employee_report_email(p_email_1);
  v_two := public.ai_employee_report_email(p_email_2);
  IF v_one IS NOT NULL AND v_one = v_two THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  SELECT lower(btrim(reviewer.email))
  INTO v_reviewer
  FROM public.ai_employee_profiles profile
  LEFT JOIN public.employees reviewer
    ON reviewer.id = profile.reviewer_employee_id
   AND reviewer.organization_id = profile.organization_id
  WHERE profile.employee_id = p_employee_id
    AND profile.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_reviewer IS NOT NULL AND v_reviewer <> '' AND (v_one = v_reviewer OR v_two = v_reviewer) THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ai_employee_profiles
  SET report_copy_email_1 = v_one,
      report_copy_email_2 = v_two,
      report_sender_user_id = p_user_id
  WHERE employee_id = p_employee_id
    AND organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'ok', true,
    'report_copy_email_1', v_one,
    'report_copy_email_2', v_two,
    'report_sender_user_id', p_user_id
  );
END;
$copies$;

COMMENT ON FUNCTION public.ai_employee_report_copies_write(uuid, uuid, uuid, text, text) IS
  'Owner menyimpan paling banyak dua email tambahan dan mengingat user yang menyimpan sebagai nama pengirim.';

REVOKE ALL ON FUNCTION public.ai_employee_report_copies_write(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

CREATE OR REPLACE FUNCTION public.ai_employee_page_report_copies_save(
  p_employee_id uuid,
  p_email_1 text,
  p_email_2 text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $page_copies$
DECLARE
  v_org uuid;
BEGIN
  v_org := public.ai_employee_page_gate(p_employee_id, true);
  RETURN public.ai_employee_report_copies_write(
    auth.uid(),
    v_org,
    p_employee_id,
    p_email_1,
    p_email_2
  );
END;
$page_copies$;

COMMENT ON FUNCTION public.ai_employee_page_report_copies_save(uuid, text, text) IS
  'Owner menyimpan email tambahan dari halaman. Penerima utama tetap email reviewer.';

REVOKE ALL ON FUNCTION public.ai_employee_page_report_copies_save(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
GRANT EXECUTE ON FUNCTION public.ai_employee_page_report_copies_save(uuid, text, text) TO authenticated;

ALTER TABLE public.ai_employee_routines DROP CONSTRAINT IF EXISTS ai_employee_routines_weekday_check;

DO $priority$
DECLARE
  v_row record;
BEGIN
  FOR v_row IN
    SELECT DISTINCT routine.employee_id, routine.organization_id
    FROM public.ai_employee_routines routine
    WHERE routine.action_code IN ('work_report.daily', 'work_report.weekly', 'work_report.monthly')
  LOOP
    PERFORM public.ai_employee_report_apply_priority(v_row.employee_id, v_row.organization_id);
  END LOOP;
END;
$priority$;

ALTER TABLE public.ai_employee_routines
  ADD CONSTRAINT ai_employee_routines_weekday_check
  CHECK (
    (
      action_code = 'work_report.daily'
      AND cadence = 'days'
      AND weekday IS NULL
      AND weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]
      AND (
        cardinality(weekdays) BETWEEN 1 AND 7
        OR (cardinality(weekdays) = 0 AND is_active IS NOT TRUE)
      )
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
  'Isi halaman karyawan AI. Dua email tambahan tampil untuk owner di halaman dan tidak dikembalikan ke MCP.';

-- Dry run rutinitas laporan kerja. Satu transaksi, diakhiri ROLLBACK. Jangan tambah COMMIT.
-- Butuh migration 20261103116000 sudah ada di database. Tidak memanggil dispatch, jadi tidak ada HTTP.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

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

DO $test$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_ai uuid := gen_random_uuid();
  v_disabled uuid := gen_random_uuid();
  v_reviewer uuid := gen_random_uuid();
  v_routine uuid;
  v_disabled_routine uuid;
  v_claimed uuid;
  v_next timestamptz;
  v_kept timestamptz;
  v_sent timestamptz;
  v_summary jsonb;
  v_prepare jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'ai_employee_next_report_at'
  ) THEN
    RAISE EXCEPTION 'migration 20261103116000 belum diterapkan';
  END IF;

  IF public.ai_employee_next_routine_at('daily', NULL, time '09:00', 'Asia/Jakarta', '2026-11-02 01:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-02 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION '08:59 WIB harus jatuh pada 09:00 hari yang sama';
  END IF;

  IF public.ai_employee_next_routine_at('daily', NULL, time '09:00', 'Asia/Jakarta', '2026-11-02 02:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-03 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat 09:00 WIB harus pindah ke hari berikutnya';
  END IF;

  IF public.ai_employee_next_routine_at('weekly', 5::smallint, time '09:00', 'Asia/Jakarta', '2026-11-06 01:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-06 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Jumat 08:59 WIB harus jatuh pada Jumat 09:00 yang sama';
  END IF;

  IF public.ai_employee_next_routine_at('weekly', 5::smallint, time '09:00', 'Asia/Jakarta', '2026-11-06 02:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-13 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat Jumat 09:00 WIB harus pindah ke Jumat berikutnya';
  END IF;

  IF public.ai_employee_next_routine_at('mon_thu', NULL, time '09:00', 'Asia/Jakarta', '2026-11-04 01:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-04 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Rabu 08:59 WIB harus jatuh pada Rabu 09:00';
  END IF;

  IF public.ai_employee_next_routine_at('mon_thu', NULL, time '09:00', 'Asia/Jakarta', '2026-11-05 02:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-09 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat Kamis 09:00 WIB harus pindah ke Senin';
  END IF;

  IF public.ai_employee_next_routine_at('mon_thu', NULL, time '09:00', 'Asia/Jakarta', '2026-11-06 01:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-09 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'Jumat pagi harus pindah ke Senin';
  END IF;

  IF public.ai_employee_next_routine_at('days', NULL, time '09:00', 'Asia/Jakarta', '2026-11-06 01:00:00+00'::timestamptz, ARRAY[5]::smallint[])
     IS DISTINCT FROM '2026-11-06 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'hari Jumat yang dipilih harus tetap Jumat';
  END IF;

  IF public.ai_employee_next_routine_at('days', NULL, time '09:00', 'Asia/Jakarta', '2026-11-05 02:00:00+00'::timestamptz, ARRAY[1, 6]::smallint[])
     IS DISTINCT FROM '2026-11-07 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat Kamis 09:00 harus pindah ke Sabtu bila Sabtu yang dipilih';
  END IF;

  IF public.ai_employee_next_routine_at('monthly', NULL, time '09:00', 'Asia/Jakarta', '2026-11-30 01:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-30 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION '08:59 WIB pada tanggal terakhir harus jatuh pada 09:00 hari itu';
  END IF;

  IF public.ai_employee_next_routine_at('monthly', NULL, time '09:00', 'Asia/Jakarta', '2026-11-30 02:00:00+00'::timestamptz)
     IS DISTINCT FROM '2026-12-31 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat akhir November 09:00 WIB harus pindah ke 31 Desember';
  END IF;

  IF public.ai_employee_next_routine_at('monthly', NULL, time '09:00', 'Asia/Jakarta', '2027-02-28 02:00:00+00'::timestamptz)
     IS DISTINCT FROM '2027-03-31 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'tepat 28 Februari 2027 09:00 WIB harus pindah ke 31 Maret';
  END IF;

  IF public.ai_employee_next_routine_at('daily', NULL, time '09:00', 'Not/AZone', '2026-11-02 01:59:00+00'::timestamptz)
     IS DISTINCT FROM '2026-11-02 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'zona tidak dikenal harus memakai Asia/Jakarta';
  END IF;

  PERFORM pg_temp.insert_auth_user(v_owner, 'routine-owner@example.com');
  PERFORM pg_temp.insert_auth_user(v_admin, 'routine-admin@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES (v_org, 'Routine Test', 'software', v_owner);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_owner, v_org, 'owner'), (v_admin, v_org, 'admin');

  INSERT INTO public.employees (id, organization_id, full_name, email, user_id, is_ai)
  VALUES
    (v_ai, v_org, 'Naya Uji', NULL, NULL, true),
    (v_disabled, v_org, 'Naya Mati', NULL, NULL, true),
    (v_reviewer, v_org, 'Reviewer Uji', NULL, v_owner, false);

  INSERT INTO public.ai_employee_profiles (
    employee_id, organization_id, reviewer_employee_id, time_zone, is_active, performance_status
  ) VALUES
    (v_ai, v_org, v_reviewer, 'Asia/Jakarta', true, 'on_track'),
    (v_disabled, v_org, v_reviewer, 'Asia/Jakarta', true, 'disabled');

  BEGIN
    PERFORM public.ai_employee_routine_write(
      v_admin, v_org, v_ai, 'work_report.daily', 'days', NULL, time '09:00', true, ARRAY[1, 2, 5]
    );
    RAISE EXCEPTION 'admin harus ditolak';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_routine_write(
      v_owner, v_org, v_ai, 'hr.report', 'daily', NULL, time '09:00', true
    );
    RAISE EXCEPTION 'kode aksi asing harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  PERFORM public.ai_employee_routine_write(
    v_owner, v_org, v_ai, 'work_report.daily', 'days', NULL, time '09:00', true, ARRAY[5, 1, 1]
  );

  SELECT id, next_run_at
  INTO v_routine, v_next
  FROM public.ai_employee_routines
  WHERE employee_id = v_ai
    AND action_code = 'work_report.daily';

  IF v_next IS NULL OR v_next <= clock_timestamp() THEN
    RAISE EXCEPTION 'rutinitas baru harus mendapat next_run_at di masa depan';
  END IF;

  IF (
    SELECT weekdays
    FROM public.ai_employee_routines
    WHERE id = v_routine
  ) IS DISTINCT FROM ARRAY[1, 5]::smallint[] THEN
    RAISE EXCEPTION 'hari harian harus tersimpan sesuai pilihan, tanpa dipaksa Senin–Kamis';
  END IF;

  BEGIN
    INSERT INTO public.ai_employee_routines (
      employee_id, organization_id, action_code, cadence, weekday, weekdays, time_local, is_active
    ) VALUES (
      v_ai, v_org, 'work_report.daily', 'days', NULL, ARRAY[1]::smallint[], time '08:00', true
    );
    RAISE EXCEPTION 'aksi yang sama tidak boleh punya dua baris';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_routine_write(
      v_owner, v_org, v_ai, 'work_report.email', 'weekly', 1, time '23:50', true
    );
    RAISE EXCEPTION 'kode lama work_report.email harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  PERFORM public.ai_employee_routine_write(
    v_owner, v_org, v_ai, 'work_report.weekly', 'weekly', 1, time '23:50', true
  );
  PERFORM public.ai_employee_routine_write(
    v_owner, v_org, v_ai, 'work_report.monthly', 'monthly', NULL, time '09:00', false
  );

  IF (
    SELECT weekday
    FROM public.ai_employee_routines
    WHERE employee_id = v_ai
      AND action_code = 'work_report.weekly'
  ) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'laporan mingguan harus menyimpan hari yang dikirim';
  END IF;

  IF (
    SELECT weekdays
    FROM public.ai_employee_routines
    WHERE employee_id = v_ai
      AND action_code = 'work_report.daily'
  ) IS DISTINCT FROM ARRAY[5]::smallint[] THEN
    RAISE EXCEPTION 'hari mingguan harus terbuang dari harian';
  END IF;

  IF public.ai_employee_next_report_at(
    v_ai, v_org, 'work_report.daily', 'days', NULL, ARRAY[1, 2]::smallint[], time '09:00', 'Asia/Jakarta', '2026-11-01 01:00:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-11-03 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'harian harus melewati hari mingguan';
  END IF;

  UPDATE public.ai_employee_routines
  SET is_active = true
  WHERE employee_id = v_ai
    AND action_code = 'work_report.monthly';

  IF public.ai_employee_next_report_at(
    v_ai, v_org, 'work_report.weekly', 'weekly', 1::smallint, '{}'::smallint[], time '23:50', 'Asia/Jakarta', '2026-11-23 16:50:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-12-07 16:50:00+00'::timestamptz THEN
    RAISE EXCEPTION 'mingguan pada tanggal terakhir harus pindah ke minggu berikutnya';
  END IF;

  IF public.ai_employee_next_report_at(
    v_ai, v_org, 'work_report.daily', 'days', NULL, ARRAY[1, 2]::smallint[], time '09:00', 'Asia/Jakarta', '2026-11-29 01:00:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-12-01 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'harian harus melewati tanggal terakhir';
  END IF;

  IF public.ai_employee_next_report_at(
    v_ai, v_org, 'work_report.monthly', 'monthly', NULL, '{}'::smallint[], time '09:00', 'Asia/Jakarta', '2026-11-01 00:00:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-11-30 02:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'bulanan tetap jatuh pada tanggal terakhir';
  END IF;

  UPDATE public.ai_employee_routines
  SET is_active = false
  WHERE employee_id = v_ai
    AND action_code = 'work_report.monthly';

  IF public.ai_employee_next_report_at(
    v_ai, v_org, 'work_report.weekly', 'weekly', 1::smallint, '{}'::smallint[], time '23:50', 'Asia/Jakarta', '2026-11-23 16:50:00+00'::timestamptz
  ) IS DISTINCT FROM '2026-11-30 16:50:00+00'::timestamptz THEN
    RAISE EXCEPTION 'bulanan yang tidak aktif tidak boleh menahan mingguan';
  END IF;

  v_prepare := public.ai_employee_routine_prepare((
    SELECT id FROM public.ai_employee_routines
    WHERE employee_id = v_ai AND action_code = 'work_report.weekly'
  ));
  IF abs(extract(epoch FROM ((v_prepare->>'period_start')::timestamptz - (clock_timestamp() - interval '7 days')))) > 5 THEN
    RAISE EXCEPTION 'periode mingguan pertama harus tujuh hari';
  END IF;

  v_prepare := public.ai_employee_routine_prepare((
    SELECT id FROM public.ai_employee_routines
    WHERE employee_id = v_ai AND action_code = 'work_report.monthly'
  ));
  IF v_prepare->>'action_code' IS DISTINCT FROM 'work_report.monthly' THEN
    RAISE EXCEPTION 'prepare harus mengembalikan kode bulanan';
  END IF;
  IF abs(extract(epoch FROM (
    (v_prepare->>'period_start')::timestamptz
    - (date_trunc('month', timezone('Asia/Jakarta', clock_timestamp())) AT TIME ZONE 'Asia/Jakarta')
  ))) > 2 THEN
    RAISE EXCEPTION 'periode bulanan pertama harus awal bulan';
  END IF;

  INSERT INTO public.ai_employee_routines (
    employee_id, organization_id, action_code, cadence, weekday, time_local, is_active
  ) VALUES (
    v_disabled, v_org, 'work_report.weekly', 'weekly', 1, time '09:00', true
  )
  RETURNING id INTO v_disabled_routine;

  UPDATE public.ai_employee_routines
  SET next_run_at = clock_timestamp() - interval '1 minute'
  WHERE id IN (v_routine, v_disabled_routine);

  PERFORM public.ai_employee_routine_write(
    v_owner, v_org, v_ai, 'work_report.daily', 'days', NULL, time '09:00', true, ARRAY[1, 5]
  );

  UPDATE public.ai_employee_routines
  SET next_run_at = clock_timestamp() - interval '1 minute'
  WHERE id = v_routine;

  SELECT claimed.routine_id
  INTO v_claimed
  FROM public.ai_employee_claim_due_routines() AS claimed
  WHERE claimed.routine_id = v_routine;

  IF v_claimed IS NULL THEN
    RAISE EXCEPTION 'rutinitas jatuh tempo harus diklaim';
  END IF;

  SELECT next_run_at INTO v_kept
  FROM public.ai_employee_routines
  WHERE id = v_routine;

  IF v_kept IS NULL OR v_kept <= clock_timestamp() THEN
    RAISE EXCEPTION 'next_run_at yang sudah diklaim harus pindah ke masa depan';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_employee_claim_due_routines() AS claimed
    WHERE claimed.routine_id IN (v_routine, v_disabled_routine)
  ) THEN
    RAISE EXCEPTION 'klaim kedua tidak boleh mengambil baris yang sama, dan profil disabled tidak boleh diklaim';
  END IF;

  v_prepare := public.ai_employee_routine_prepare(v_routine);
  IF v_prepare->>'skip_reason' IS DISTINCT FROM 'reviewer_email_missing' THEN
    RAISE EXCEPTION 'reviewer tanpa email harus skipped, dapat %', v_prepare->>'skip_reason';
  END IF;
  IF abs(extract(epoch FROM (
    (v_prepare->>'period_start')::timestamptz
    - (date_trunc('day', timezone('Asia/Jakarta', clock_timestamp())) AT TIME ZONE 'Asia/Jakarta')
  ))) > 2 THEN
    RAISE EXCEPTION 'periode harian harus mulai tengah malam';
  END IF;
  IF v_prepare->>'sender_name' IS DISTINCT FROM 'Reviewer Uji' THEN
    RAISE EXCEPTION 'nama pengirim awal harus nama reviewer, dapat %', v_prepare->>'sender_name';
  END IF;

  UPDATE public.employees
  SET email = 'reviewer-uji@example.com'
  WHERE id = v_reviewer;

  INSERT INTO public.ai_employee_runs (
    employee_id, organization_id, sop_code, status, plan_count, started_at
  ) VALUES (
    v_ai, v_org, 'SOP1', 'succeeded', 2, clock_timestamp() - interval '1 second'
  );

  v_prepare := public.ai_employee_routine_prepare(v_routine);
  IF v_prepare->>'skip_reason' IS NOT NULL THEN
    RAISE EXCEPTION 'reviewer beremail tidak boleh dilewati';
  END IF;
  IF (v_prepare->'summary'->>'runs_succeeded')::integer <> 1
     OR (v_prepare->'summary'->>'plans_created')::integer <> 2 THEN
    RAISE EXCEPTION 'ringkasan harus menghitung run dan plan milik Naya';
  END IF;
  IF v_prepare->'summary' ? 'payroll_total' THEN
    RAISE EXCEPTION 'ringkasan tidak boleh memuat payroll';
  END IF;

  PERFORM public.ai_employee_routine_finish(
    v_routine,
    'skipped',
    (v_prepare->>'period_start')::timestamptz,
    (v_prepare->>'period_end')::timestamptz,
    '',
    v_prepare->'summary',
    'reviewer_email_missing'
  );

  SELECT last_sent_at INTO v_sent
  FROM public.ai_employee_routines
  WHERE id = v_routine;
  IF v_sent IS NOT NULL THEN
    RAISE EXCEPTION 'status skipped tidak boleh mengisi last_sent_at';
  END IF;

  PERFORM public.ai_employee_routine_finish(
    v_routine,
    'sent',
    (clock_timestamp() - interval '1 hour'),
    clock_timestamp(),
    'reviewer-uji@example.com',
    (v_prepare->'summary') || jsonb_build_object('payroll_total', 5000000),
    ''
  );

  SELECT last_sent_at, (
    SELECT summary
    FROM public.ai_employee_routine_deliveries delivery
    WHERE delivery.routine_id = v_routine
      AND delivery.status = 'sent'
    ORDER BY delivery.created_at DESC
    LIMIT 1
  )
  INTO v_sent, v_summary
  FROM public.ai_employee_routines
  WHERE id = v_routine;

  IF v_sent IS NULL THEN
    RAISE EXCEPTION 'status sent harus mengisi last_sent_at';
  END IF;
  IF v_summary ? 'payroll_total' THEN
    RAISE EXCEPTION 'delivery tidak boleh menyimpan payroll';
  END IF;
  IF (v_summary->>'plans_created')::integer <> 2 THEN
    RAISE EXCEPTION 'delivery harus menyimpan jumlah plan';
  END IF;

  SELECT next_run_at INTO v_next
  FROM public.ai_employee_routines
  WHERE id = v_routine;
  IF v_next IS DISTINCT FROM v_kept THEN
    RAISE EXCEPTION 'finish tidak boleh menggeser next_run_at';
  END IF;

  PERFORM public.ai_employee_report_copies_write(
    v_owner, v_org, v_ai, '  Extra@Client.test ', NULL
  );
  IF (
    SELECT profile.report_copy_email_1
    FROM public.ai_employee_profiles profile
    WHERE profile.employee_id = v_ai
  ) IS DISTINCT FROM 'extra@client.test' THEN
    RAISE EXCEPTION 'email tambahan harus dinormalisasi';
  END IF;
  IF (
    SELECT profile.report_sender_user_id
    FROM public.ai_employee_profiles profile
    WHERE profile.employee_id = v_ai
  ) IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'penyimpan email harus tercatat sebagai pengirim';
  END IF;

  BEGIN
    PERFORM public.ai_employee_report_copies_write(v_owner, v_org, v_ai, 'bukan-email', NULL);
    RAISE EXCEPTION 'email salah harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_report_copies_write(v_owner, v_org, v_ai, 'reviewer-uji@example.com', NULL);
    RAISE EXCEPTION 'email yang sama dengan penerima utama harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  BEGIN
    PERFORM public.ai_employee_report_copies_write(v_owner, v_org, v_ai, 'a@b.co', 'A@b.co');
    RAISE EXCEPTION 'dua email yang sama harus ditolak';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      NULL;
  END;

  UPDATE public.profiles
  SET full_name = 'Octa Uji'
  WHERE user_id = v_owner;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (v_owner, 'routine-owner-profile@example.com', 'Octa Uji');
  END IF;

  v_prepare := public.ai_employee_routine_prepare(v_routine);
  IF v_prepare->>'sender_name' IS DISTINCT FROM 'Octa Uji' THEN
    RAISE EXCEPTION 'nama pengirim harus nama profile, dapat %', v_prepare->>'sender_name';
  END IF;
  IF v_prepare->'copy_emails' IS DISTINCT FROM '["extra@client.test"]'::jsonb THEN
    RAISE EXCEPTION 'prepare harus mengembalikan email tambahan';
  END IF;

  INSERT INTO public.ai_employee_runs (
    employee_id, organization_id, sop_code, status, plan_count, started_at
  ) VALUES
    (v_ai, v_org, 'SOP1', 'succeeded', 1, '2026-11-29 02:00:00+00'::timestamptz),
    (v_ai, v_org, 'SOP1', 'succeeded', 4, '2026-11-30 02:00:00+00'::timestamptz);

  v_summary := public.ai_employee_routine_summary(
    v_ai,
    v_org,
    '2026-11-28 17:00:00+00'::timestamptz,
    '2026-11-30 17:00:00+00'::timestamptz,
    NULL::smallint,
    true,
    'Asia/Jakarta'
  );
  IF (v_summary->>'plans_created')::integer <> 1 OR (v_summary->>'runs_succeeded')::integer <> 1 THEN
    RAISE EXCEPTION 'tanggal terakhir harus keluar dari hitungan mingguan';
  END IF;

  v_summary := public.ai_employee_routine_summary(
    v_ai,
    v_org,
    '2026-11-28 17:00:00+00'::timestamptz,
    '2026-11-30 17:00:00+00'::timestamptz,
    1::smallint,
    false,
    'Asia/Jakarta'
  );
  IF (v_summary->>'plans_created')::integer <> 1 THEN
    RAISE EXCEPTION 'hari mingguan harus keluar dari hitungan harian';
  END IF;

  IF public.mcp_list_ai_employee_routines(v_owner, v_org, v_ai)::text LIKE '%@%' THEN
    RAISE EXCEPTION 'daftar MCP tidak boleh memuat alamat email';
  END IF;

  SELECT next_run_at INTO v_next
  FROM public.ai_employee_routines
  WHERE id = v_routine;

  PERFORM public.ai_employee_routine_finish(
    v_routine,
    'sent',
    (v_prepare->>'period_start')::timestamptz,
    (v_prepare->>'period_end')::timestamptz,
    'reviewer-uji@example.com',
    v_prepare->'summary',
    'Email tambahan 1 gagal'
  );
  IF (
    SELECT routine.last_error
    FROM public.ai_employee_routines routine
    WHERE routine.id = v_routine
  ) IS DISTINCT FROM 'Email tambahan 1 gagal' THEN
    RAISE EXCEPTION 'gagal pada email tambahan harus tercatat';
  END IF;
  IF (
    SELECT routine.last_sent_at
    FROM public.ai_employee_routines routine
    WHERE routine.id = v_routine
  ) IS NULL THEN
    RAISE EXCEPTION 'gagal pada email tambahan tidak boleh menghapus status terkirim';
  END IF;
  IF (
    SELECT routine.next_run_at
    FROM public.ai_employee_routines routine
    WHERE routine.id = v_routine
  ) IS DISTINCT FROM v_next THEN
    RAISE EXCEPTION 'catatan email tambahan tidak boleh menggeser next_run_at';
  END IF;

  PERFORM public.ai_employee_routine_write(
    v_owner, v_org, v_ai, 'work_report.daily', 'days', NULL, time '09:00', true, ARRAY[1]
  );
  IF (
    SELECT routine.is_active OR cardinality(routine.weekdays) <> 0
    FROM public.ai_employee_routines routine
    WHERE routine.employee_id = v_ai
      AND routine.action_code = 'work_report.daily'
  ) THEN
    RAISE EXCEPTION 'harian yang hanya berisi hari mingguan harus mati dan kosong';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND has_function_privilege('authenticated', 'public.ai_employee_claim_due_routines()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated tidak boleh mengklaim rutinitas';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND has_function_privilege('authenticated', 'public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean, integer[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated tidak boleh menulis rutinitas langsung';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND has_function_privilege('anon', 'public.ai_employee_routine_prepare(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon tidak boleh menyiapkan laporan';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND NOT has_function_privilege('authenticated', 'public.ai_employee_page_report_copies_save(uuid, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner halaman harus bisa menyimpan email tambahan';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND has_function_privilege('authenticated', 'public.ai_employee_report_copies_write(uuid, uuid, uuid, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated tidak boleh menulis email lewat fungsi internal';
  END IF;
END;
$test$;


ROLLBACK;
