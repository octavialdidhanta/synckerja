-- Laporan harian menghitung satu hari kerja yang sudah selesai.
-- Tombol weekday tetap hari kerja. Email berangkat besoknya pada jam yang dipilih.
-- Periode: tengah malam kemarin sampai tengah malam hari kirim, di zona profil.
-- Hari mingguan dan tanggal terakhir (bila bulanan aktif) tidak dikirim sebagai harian.
-- Mingguan dan bulanan tidak diubah.

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
  v_send_local timestamp;
  v_work_local timestamp;
  v_work_dow integer;
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

  IF p_cadence = 'days' THEN
    IF p_time IS NULL OR p_after IS NULL THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    v_local := timezone(v_zone, p_after);
    v_send_local := date_trunc('day', v_local) + p_time;
    IF v_send_local <= v_local THEN
      v_send_local := v_send_local + interval '1 day';
    END IF;

    LOOP
      v_work_local := v_send_local - interval '1 day';
      v_work_dow := EXTRACT(ISODOW FROM v_work_local)::integer;
      v_blocked := NOT (v_work_dow = ANY (COALESCE(p_weekdays, '{}'::smallint[])));
      IF v_weekly IS NOT NULL AND v_work_dow = v_weekly THEN
        v_blocked := true;
      END IF;
      IF v_monthly
         AND v_work_local::date = (date_trunc('month', v_work_local) + interval '1 month' - interval '1 day')::date
      THEN
        v_blocked := true;
      END IF;
      EXIT WHEN NOT v_blocked;

      v_send_local := v_send_local + interval '1 day';
      v_guard := v_guard + 1;
      IF v_guard > 370 THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END LOOP;

    RETURN v_send_local AT TIME ZONE v_zone;
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
  'Slot berikutnya. Harian dikirim pagi setelah hari kerja yang dipilih. Bulanan aktif menahan tanggal terakhir. Mingguan aktif menahan weekday-nya pada harian.';

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
  v_work_local timestamp;
  v_daily_skip boolean := false;
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
    v_end := date_trunc('day', timezone(v_zone, clock_timestamp())) AT TIME ZONE v_zone;
    v_start := v_end - interval '1 day';
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
    v_work_local := timezone(v_zone, v_start);
    v_daily_skip := NOT (
      EXTRACT(ISODOW FROM v_work_local)::integer = ANY (COALESCE(v_routine.weekdays, '{}'::smallint[]))
    );
    IF v_exclude_weekday IS NOT NULL
       AND EXTRACT(ISODOW FROM v_work_local)::integer = v_exclude_weekday
    THEN
      v_daily_skip := true;
    END IF;
    IF v_exclude_month_end
       AND v_work_local::date = (date_trunc('month', v_work_local) + interval '1 month' - interval '1 day')::date
    THEN
      v_daily_skip := true;
    END IF;
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
      WHEN v_routine.action_code = 'work_report.daily' AND v_daily_skip THEN 'outside_work_day'
      ELSE NULL
    END
  );
END;
$prepare$;

COMMENT ON FUNCTION public.ai_employee_routine_prepare(uuid) IS
  'Menyiapkan satu irama. Harian menghitung hari kalender yang baru selesai. Nama pengirim dari profile yang menyimpan, atau nama reviewer. Email tambahan tidak menggantikan penerima utama.';

UPDATE public.ai_employee_routines AS routine
SET next_run_at = public.ai_employee_next_report_at(
  routine.employee_id,
  routine.organization_id,
  routine.action_code,
  routine.cadence,
  routine.weekday,
  routine.weekdays,
  routine.time_local,
  COALESCE(
    (
      SELECT COALESCE(NULLIF(btrim(profile.time_zone), ''), 'Asia/Jakarta')
      FROM public.ai_employee_profiles profile
      WHERE profile.employee_id = routine.employee_id
        AND profile.organization_id = routine.organization_id
    ),
    'Asia/Jakarta'
  ),
  clock_timestamp()
)
WHERE routine.action_code = 'work_report.daily'
  AND routine.is_active;
