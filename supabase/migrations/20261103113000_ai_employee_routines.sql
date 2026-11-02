-- Rutinitas karyawan AI. SOP1 tetap menyusun plan. Laporan email adalah aksi terpisah.
-- Hanya work_report.email. Isi laporan: run, plan, antrean, dan KR1–KR5 milik karyawan itu.
-- Tidak ada seed aktif. Owner menyimpan rutinitas lewat fungsi tulis.

CREATE TABLE public.ai_employee_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  action_code text NOT NULL,
  cadence text NOT NULL,
  weekday smallint,
  time_local time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_sent_at timestamptz,
  last_status text,
  last_error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_employee_routines_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_routines_action_check
    CHECK (action_code = 'work_report.email'),
  CONSTRAINT ai_employee_routines_cadence_check
    CHECK (cadence IN ('daily', 'weekly')),
  CONSTRAINT ai_employee_routines_weekday_check
    CHECK (
      (cadence = 'daily' AND weekday IS NULL)
      OR (cadence = 'weekly' AND weekday BETWEEN 1 AND 7)
    ),
  CONSTRAINT ai_employee_routines_status_check
    CHECK (last_status IS NULL OR last_status IN ('sent', 'failed', 'skipped')),
  CONSTRAINT ai_employee_routines_error_length
    CHECK (char_length(last_error) <= 500),
  CONSTRAINT ai_employee_routines_action_key
    UNIQUE (employee_id, action_code)
);

CREATE INDEX ai_employee_routines_due_idx
  ON public.ai_employee_routines (next_run_at)
  WHERE is_active AND next_run_at IS NOT NULL;

CREATE TABLE public.ai_employee_routine_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid NOT NULL REFERENCES public.ai_employee_routines (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status text NOT NULL,
  recipient_email text NOT NULL DEFAULT '',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_employee_routine_deliveries_employee_org_fkey
    FOREIGN KEY (employee_id, organization_id)
    REFERENCES public.employees (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ai_employee_routine_deliveries_status_check
    CHECK (status IN ('sent', 'failed', 'skipped')),
  CONSTRAINT ai_employee_routine_deliveries_email_length
    CHECK (char_length(recipient_email) <= 320),
  CONSTRAINT ai_employee_routine_deliveries_error_length
    CHECK (char_length(error) <= 500)
);

CREATE INDEX ai_employee_routine_deliveries_routine_idx
  ON public.ai_employee_routine_deliveries (routine_id, created_at DESC);

ALTER TABLE public.ai_employee_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_routine_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_employee_routines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_employee_routine_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ai_employee_routines TO service_role;

CREATE OR REPLACE FUNCTION public.ai_employee_routine_count(p_value text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value ~ '^[0-9]+$' THEN p_value::integer
    ELSE 0
  END;
$$;

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
DECLARE
  v_zone text := COALESCE(NULLIF(btrim(p_time_zone), ''), 'Asia/Jakarta');
  v_local timestamp;
  v_dow integer;
  v_delta integer;
  v_candidate timestamp;
BEGIN
  IF p_cadence NOT IN ('daily', 'weekly')
     OR p_time IS NULL
     OR p_after IS NULL
     OR (p_cadence = 'weekly' AND (p_weekday IS NULL OR p_weekday < 1 OR p_weekday > 7))
     OR (p_cadence = 'daily' AND p_weekday IS NOT NULL)
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_zone) THEN
    v_zone := 'Asia/Jakarta';
  END IF;

  v_local := timezone(v_zone, p_after);
  IF p_cadence = 'daily' THEN
    v_candidate := date_trunc('day', v_local) + p_time;
    IF v_candidate <= v_local THEN
      v_candidate := v_candidate + interval '1 day';
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

COMMENT ON FUNCTION public.ai_employee_next_routine_at(text, smallint, time, text, timestamptz) IS
  'Kejadian harian atau mingguan berikutnya setelah p_after, di zona profil. Zona tidak dikenal jatuh ke Asia/Jakarta.';

CREATE OR REPLACE FUNCTION public.ai_employee_routines_set_next_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.next_run_at IS NOT NULL
     AND NEW.cadence IS NOT DISTINCT FROM OLD.cadence
     AND NEW.weekday IS NOT DISTINCT FROM OLD.weekday
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
    clock_timestamp()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_employee_routines_next_run ON public.ai_employee_routines;
CREATE TRIGGER ai_employee_routines_next_run
  BEFORE INSERT OR UPDATE ON public.ai_employee_routines
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_employee_routines_set_next_run();

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
    clock_timestamp()
  )
  WHERE routine.employee_id = NEW.employee_id
    AND routine.organization_id = NEW.organization_id
    AND routine.is_active;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_routine_summary(
  p_employee_id uuid,
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $summary$
DECLARE
  v_succeeded integer;
  v_failed integer;
  v_other integer;
  v_plans integer;
  v_done integer;
  v_rejected integer;
  v_job_failed integer;
  v_key_results jsonb;
BEGIN
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
    AND run.started_at < p_end;

  SELECT
    count(*) FILTER (WHERE job.status = 'done')::integer,
    count(*) FILTER (WHERE job.status = 'rejected')::integer,
    count(*) FILTER (WHERE job.status = 'failed')::integer
  INTO v_done, v_rejected, v_job_failed
  FROM public.ai_employee_jobs job
  WHERE job.employee_id = p_employee_id
    AND job.organization_id = p_organization_id
    AND job.finished_at >= p_start
    AND job.finished_at < p_end;

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

COMMENT ON FUNCTION public.ai_employee_routine_summary(uuid, uuid, timestamptz, timestamptz) IS
  'Angka meja kerja karyawan AI: run, plan, antrean, dan KR1–KR5. Bukan laporan HRD atau payroll.';

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
    'time_local', to_char(p_routine.time_local, 'HH24:MI'),
    'is_active', p_routine.is_active,
    'next_run_at', p_routine.next_run_at,
    'last_sent_at', p_routine.last_sent_at,
    'last_status', p_routine.last_status
  );
$$;

CREATE OR REPLACE FUNCTION public.ai_employee_routine_write(
  p_user_id uuid,
  p_organization_id uuid,
  p_employee_id uuid,
  p_action_code text,
  p_cadence text,
  p_weekday integer,
  p_time_local time,
  p_is_active boolean
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
  IF v_action IS DISTINCT FROM 'work_report.email'
     OR v_cadence NOT IN ('daily', 'weekly')
     OR p_time_local IS NULL
     OR p_is_active IS NULL
     OR (v_cadence = 'weekly' AND (p_weekday IS NULL OR p_weekday < 1 OR p_weekday > 7))
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_weekday := CASE WHEN v_cadence = 'weekly' THEN p_weekday::smallint ELSE NULL END;

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
      time_local,
      is_active
    ) VALUES (
      p_employee_id,
      p_organization_id,
      v_action,
      v_cadence,
      v_weekday,
      p_time_local,
      p_is_active
    )
    ON CONFLICT (employee_id, action_code) DO UPDATE
    SET cadence = EXCLUDED.cadence,
        weekday = EXCLUDED.weekday,
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

COMMENT ON FUNCTION public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean) IS
  'Owner membuat atau mengganti satu rutinitas. Hanya work_report.email. next_run_at diisi trigger.';

CREATE OR REPLACE FUNCTION public.ai_employee_page_routine_save(
  p_employee_id uuid,
  p_action_code text,
  p_cadence text,
  p_weekday integer,
  p_time_local time,
  p_is_active boolean
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
    p_is_active
  );
END;
$pagesave$;

COMMENT ON FUNCTION public.ai_employee_page_routine_save(uuid, text, text, integer, time, boolean) IS
  'Owner menyimpan rutinitas halaman lewat ai_employee_routine_write.';

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
  v_email text;
  v_active boolean;
  v_performance text;
  v_start timestamptz;
  v_end timestamptz := clock_timestamp();
BEGIN
  IF p_routine_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT routine.*
  INTO v_routine
  FROM public.ai_employee_routines routine
  WHERE routine.id = p_routine_id;

  IF NOT FOUND OR v_routine.action_code IS DISTINCT FROM 'work_report.email' THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT employee.full_name, profile.is_active, profile.performance_status, NULLIF(btrim(reviewer.email), '')
  INTO v_name, v_active, v_performance, v_email
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

  v_start := COALESCE(v_routine.last_sent_at, v_end - interval '24 hours');
  IF v_start >= v_end THEN
    v_start := v_end - interval '24 hours';
  END IF;

  RETURN jsonb_build_object(
    'routine_id', v_routine.id,
    'employee_id', v_routine.employee_id,
    'organization_id', v_routine.organization_id,
    'employee_name', COALESCE(v_name, ''),
    'recipient_email', v_email,
    'period_start', v_start,
    'period_end', v_end,
    'summary', public.ai_employee_routine_summary(v_routine.employee_id, v_routine.organization_id, v_start, v_end),
    'skip_reason', CASE
      WHEN v_active IS NOT TRUE OR v_performance = 'disabled' THEN 'profile_inactive'
      WHEN v_email IS NULL THEN 'reviewer_email_missing'
      ELSE NULL
    END
  );
END;
$prepare$;

COMMENT ON FUNCTION public.ai_employee_routine_prepare(uuid) IS
  'Menyiapkan laporan meja kerja. Email reviewer kosong atau profil nonaktif menghasilkan skip_reason, tanpa mengirim.';

CREATE OR REPLACE FUNCTION public.ai_employee_routine_finish(
  p_routine_id uuid,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_recipient_email text,
  p_summary jsonb,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $finish$
DECLARE
  v_routine public.ai_employee_routines;
  v_status text := NULLIF(btrim(COALESCE(p_status, '')), '');
  v_summary jsonb := CASE
    WHEN p_summary IS NULL OR jsonb_typeof(p_summary) IS DISTINCT FROM 'object' THEN '{}'::jsonb
    ELSE p_summary
  END;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF p_routine_id IS NULL
     OR v_status NOT IN ('sent', 'failed', 'skipped')
     OR p_period_start IS NULL
     OR p_period_end IS NULL
     OR p_period_end <= p_period_start
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT routine.*
  INTO v_routine
  FROM public.ai_employee_routines routine
  WHERE routine.id = p_routine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF jsonb_typeof(v_summary->'key_results') = 'array' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', item->>'code',
      'title', left(COALESCE(item->>'title', ''), 120),
      'current_value', CASE
        WHEN (item->>'current_value') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (item->>'current_value')::numeric
        ELSE NULL
      END,
      'target_value', CASE
        WHEN (item->>'target_value') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (item->>'target_value')::numeric
        ELSE NULL
      END,
      'unit', left(COALESCE(item->>'unit', ''), 40),
      'progress_percentage', CASE
        WHEN (item->>'progress_percentage') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (item->>'progress_percentage')::numeric
        ELSE NULL
      END
    ) ORDER BY item->>'code'), '[]'::jsonb)
    INTO v_results
    FROM jsonb_array_elements(v_summary->'key_results') item
    WHERE item->>'code' IN ('KR1', 'KR2', 'KR3', 'KR4', 'KR5');
  END IF;

  v_summary := jsonb_build_object(
    'runs_succeeded', public.ai_employee_routine_count(v_summary->>'runs_succeeded'),
    'runs_failed', public.ai_employee_routine_count(v_summary->>'runs_failed'),
    'runs_other', public.ai_employee_routine_count(v_summary->>'runs_other'),
    'plans_created', public.ai_employee_routine_count(v_summary->>'plans_created'),
    'jobs_done', public.ai_employee_routine_count(v_summary->>'jobs_done'),
    'jobs_rejected', public.ai_employee_routine_count(v_summary->>'jobs_rejected'),
    'jobs_failed', public.ai_employee_routine_count(v_summary->>'jobs_failed'),
    'key_results', COALESCE(v_results, '[]'::jsonb)
  );

  INSERT INTO public.ai_employee_routine_deliveries (
    routine_id,
    employee_id,
    organization_id,
    period_start,
    period_end,
    status,
    recipient_email,
    summary,
    error
  ) VALUES (
    v_routine.id,
    v_routine.employee_id,
    v_routine.organization_id,
    p_period_start,
    p_period_end,
    v_status,
    left(COALESCE(p_recipient_email, ''), 320),
    v_summary,
    left(COALESCE(p_error, ''), 500)
  );

  UPDATE public.ai_employee_routines routine
  SET last_status = v_status,
      last_error = left(COALESCE(p_error, ''), 500),
      last_sent_at = CASE WHEN v_status = 'sent' THEN clock_timestamp() ELSE routine.last_sent_at END
  WHERE routine.id = v_routine.id;
END;
$finish$;

COMMENT ON FUNCTION public.ai_employee_routine_finish(uuid, text, timestamptz, timestamptz, text, jsonb, text) IS
  'Menutup satu percobaan kirim. Hanya status sent yang mengisi last_sent_at. next_run_at tidak digeser ulang.';

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
      AND routine.action_code = 'work_report.email'
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
  'Mengunci dan memajukan next_run_at rutinitas yang jatuh tempo. Pemanggilan kedua tidak mengambil baris yang sama.';

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
  'Cron tiap menit. SOP1, lalu job, lalu rutinitas. Tanpa jatuh tempo dan tanpa rahasia Vault, tidak ada HTTP.';

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

REVOKE ALL ON FUNCTION public.ai_employee_routine_count(text) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_next_routine_at(text, smallint, time, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_routines_set_next_run() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_routine_summary(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_routine_view(public.ai_employee_routines) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_page_routine_save(uuid, text, text, integer, time, boolean) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_routine_prepare(uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_routine_finish(uuid, text, timestamptz, timestamptz, text, jsonb, text) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.mcp_list_ai_employee_routines(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;
REVOKE ALL ON FUNCTION public.ai_employee_claim_due_routines() FROM PUBLIC, anon, authenticated, service_role, ai_employee_runner;

GRANT EXECUTE ON FUNCTION public.ai_employee_routine_write(uuid, uuid, uuid, text, text, integer, time, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_page_routine_save(uuid, text, text, integer, time, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_routine_prepare(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_routine_finish(uuid, text, timestamptz, timestamptz, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_list_ai_employee_routines(uuid, uuid, uuid) TO service_role;
