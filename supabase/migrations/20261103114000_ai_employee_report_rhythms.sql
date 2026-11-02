-- Tiga irama laporan email: harian Senin–Kamis, mingguan, dan akhir bulan.
-- Baris work_report.email yang sudah mingguan hanya berganti kode. next_run_at tidak dihitung ulang.
-- Baris harian lama menjadi Senin–Kamis. Jumat, Sabtu, dan Minggu tidak lagi kena laporan harian.

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
  v_month timestamp;
  v_candidate timestamp;
BEGIN
  IF p_time IS NULL
     OR p_after IS NULL
     OR p_cadence NOT IN ('daily', 'mon_thu', 'weekly', 'monthly')
     OR (p_cadence = 'weekly' AND (p_weekday IS NULL OR p_weekday < 1 OR p_weekday > 7))
     OR (p_cadence <> 'weekly' AND p_weekday IS NOT NULL)
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
  ELSIF p_cadence = 'mon_thu' THEN
    v_candidate := date_trunc('day', v_local) + p_time;
    IF v_candidate <= v_local THEN
      v_candidate := v_candidate + interval '1 day';
    END IF;
    WHILE EXTRACT(ISODOW FROM v_candidate)::integer NOT BETWEEN 1 AND 4 LOOP
      v_candidate := v_candidate + interval '1 day';
    END LOOP;
  ELSIF p_cadence = 'daily' THEN
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
  'Slot berikutnya: mon_thu hanya Senin–Kamis, weekly pada weekday, monthly pada tanggal terakhir. daily tetap setiap hari untuk baris lama. Zona tidak dikenal jatuh ke Asia/Jakarta.';

ALTER TABLE public.ai_employee_routines DROP CONSTRAINT ai_employee_routines_action_check;
ALTER TABLE public.ai_employee_routines DROP CONSTRAINT ai_employee_routines_cadence_check;
ALTER TABLE public.ai_employee_routines DROP CONSTRAINT ai_employee_routines_weekday_check;

UPDATE public.ai_employee_routines
SET action_code = 'work_report.weekly'
WHERE action_code = 'work_report.email'
  AND cadence = 'weekly';

UPDATE public.ai_employee_routines
SET action_code = 'work_report.daily',
    cadence = 'mon_thu',
    weekday = NULL
WHERE action_code = 'work_report.email'
  AND cadence = 'daily';

ALTER TABLE public.ai_employee_routines
  ADD CONSTRAINT ai_employee_routines_action_check
  CHECK (action_code IN ('work_report.daily', 'work_report.weekly', 'work_report.monthly'));

ALTER TABLE public.ai_employee_routines
  ADD CONSTRAINT ai_employee_routines_cadence_check
  CHECK (cadence IN ('mon_thu', 'weekly', 'monthly'));

ALTER TABLE public.ai_employee_routines
  ADD CONSTRAINT ai_employee_routines_weekday_check
  CHECK (
    (action_code = 'work_report.daily' AND cadence = 'mon_thu' AND weekday IS NULL)
    OR (action_code = 'work_report.weekly' AND cadence = 'weekly' AND weekday BETWEEN 1 AND 7)
    OR (action_code = 'work_report.monthly' AND cadence = 'monthly' AND weekday IS NULL)
  );

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
  IF p_time_local IS NULL OR p_is_active IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_action = 'work_report.daily' AND v_cadence = 'mon_thu' THEN
    v_weekday := NULL;
  ELSIF v_action = 'work_report.weekly' AND v_cadence = 'weekly'
        AND p_weekday BETWEEN 1 AND 7 THEN
    v_weekday := p_weekday::smallint;
  ELSIF v_action = 'work_report.monthly' AND v_cadence = 'monthly' THEN
    v_weekday := NULL;
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
  'Owner membuat atau mengganti satu laporan. Hanya harian Senin–Kamis, mingguan, atau akhir bulan. next_run_at diisi trigger.';

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
  v_zone text;
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

  IF NOT FOUND OR v_routine.action_code NOT IN ('work_report.daily', 'work_report.weekly', 'work_report.monthly') THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT employee.full_name,
         profile.is_active,
         profile.performance_status,
         COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta'),
         NULLIF(btrim(reviewer.email), '')
  INTO v_name, v_active, v_performance, v_zone, v_email
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

  IF v_routine.last_sent_at IS NOT NULL AND v_routine.last_sent_at < v_end THEN
    v_start := v_routine.last_sent_at;
  ELSIF v_routine.cadence = 'weekly' THEN
    v_start := v_end - interval '7 days';
  ELSIF v_routine.cadence = 'monthly' THEN
    v_start := date_trunc('month', timezone(v_zone, v_end)) AT TIME ZONE v_zone;
  ELSE
    v_start := v_end - interval '24 hours';
  END IF;

  RETURN jsonb_build_object(
    'routine_id', v_routine.id,
    'employee_id', v_routine.employee_id,
    'organization_id', v_routine.organization_id,
    'action_code', v_routine.action_code,
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
  'Menyiapkan satu irama laporan. Periode mengikuti kiriman terakhir irama itu. Email kosong atau profil nonaktif menghasilkan skip_reason.';

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
  'Mengunci laporan harian, mingguan, atau bulanan yang jatuh tempo dan memajukan next_run_at.';
