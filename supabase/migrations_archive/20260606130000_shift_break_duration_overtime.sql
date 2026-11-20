-- Phase B: break_duration_minutes in resolver + extend scheduled end for shift overtime.

DROP FUNCTION IF EXISTS public.resolve_effective_schedule(uuid, uuid, date);

CREATE OR REPLACE FUNCTION public.resolve_effective_schedule(
  p_employee_id uuid,
  p_organization_id uuid,
  p_effective_date date
)
RETURNS TABLE (
  source text,
  shift_id uuid,
  employee_shift_id uuid,
  work_schedule_id uuid,
  schedule_name text,
  start_time text,
  end_time text,
  late_tolerance_minutes integer,
  overtime_threshold_minutes integer,
  break_duration_minutes integer,
  timezone text,
  working_days integer[],
  is_working_day boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wss public.work_schedule_settings%ROWTYPE;
  v_emp_wss_id uuid;
  v_es_id uuid;
  v_shift_id uuid;
  v_shift_name text;
  v_shift_start text;
  v_shift_end text;
  v_shift_late_tol integer;
  v_shift_break integer;
  v_working_days integer[];
  v_app_dow integer;
  v_is_working boolean;
BEGIN
  SELECT e.work_schedule_id
  INTO v_emp_wss_id
  FROM public.employees e
  WHERE e.id = p_employee_id
    AND e.organization_id = p_organization_id;

  IF v_emp_wss_id IS NOT NULL THEN
    SELECT wss.*
    INTO v_wss
    FROM public.work_schedule_settings wss
    WHERE wss.id = v_emp_wss_id
      AND wss.organization_id = p_organization_id
      AND COALESCE(wss.is_active, true);
  END IF;

  IF v_wss.id IS NULL THEN
    SELECT wss.*
    INTO v_wss
    FROM public.work_schedule_settings wss
    WHERE wss.organization_id = p_organization_id
      AND COALESCE(wss.is_active, true)
    ORDER BY wss.is_default DESC NULLS LAST, wss.created_at ASC
    LIMIT 1;
  END IF;

  v_working_days := COALESCE(v_wss.working_days, ARRAY[1, 2, 3, 4, 5]);
  v_app_dow := public.pg_dow_to_app_dow(EXTRACT(DOW FROM p_effective_date)::integer);
  v_is_working := v_working_days IS NOT NULL AND v_app_dow = ANY (v_working_days);

  SELECT es.id, es.shift_id, s.name, s.start_time, s.end_time, s.late_tolerance_minutes, s.break_duration_minutes
  INTO v_es_id, v_shift_id, v_shift_name, v_shift_start, v_shift_end, v_shift_late_tol, v_shift_break
  FROM public.employee_shifts es
  INNER JOIN public.shifts s ON s.id = es.shift_id
  WHERE es.employee_id = p_employee_id
    AND es.organization_id = p_organization_id
    AND COALESCE(es.is_active, true)
    AND es.effective_from_date <= p_effective_date
    AND (es.effective_to_date IS NULL OR es.effective_to_date >= p_effective_date)
    AND COALESCE(s.is_active, true)
  ORDER BY es.effective_from_date DESC
  LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      'shift'::text,
      v_shift_id,
      v_es_id,
      v_wss.id,
      COALESCE(v_shift_name, 'Shift'),
      COALESCE(v_shift_start, '08:00'),
      COALESCE(v_shift_end, '17:00'),
      COALESCE(v_shift_late_tol, v_wss.late_tolerance_minutes, 0),
      COALESCE(v_wss.overtime_threshold_minutes, 0),
      COALESCE(v_shift_break, 0),
      COALESCE(v_wss.timezone, 'Asia/Jakarta'),
      v_working_days,
      v_is_working;
    RETURN;
  END IF;

  IF v_wss.id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    'work_schedule'::text,
    NULL::uuid,
    NULL::uuid,
    v_wss.id,
    COALESCE(v_wss.name, 'Jadwal Kerja'),
    COALESCE(v_wss.start_time, '09:00'),
    COALESCE(v_wss.end_time, '17:00'),
    COALESCE(v_wss.late_tolerance_minutes, 0),
    COALESCE(v_wss.overtime_threshold_minutes, 0),
    0,
    COALESCE(v_wss.timezone, 'Asia/Jakarta'),
    v_working_days,
    v_is_working;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_effective_schedule(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_effective_schedule(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_effective_schedule(uuid, uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.payroll_calculate_overtime_pay(
  p_org_id uuid,
  p_employee_id uuid,
  p_period_start date,
  p_period_end date,
  p_basic_salary numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_hourly numeric;
  v_total_minutes integer := 0;
  v_total_pay numeric := 0;
  v_scheduled_end time;
  v_threshold integer := 0;
  v_rec record;
  v_sched record;
  v_attendance_date date;
  v_raw_minutes integer;
  v_hours numeric;
  v_first_hour numeric;
  v_next_hours numeric;
BEGIN
  v_hourly := COALESCE(p_basic_salary, 0) / 173;

  FOR v_rec IN
    SELECT ar.attendance_date,
           ar.check_out_time,
           ar.check_out_at
    FROM public.attendance_records ar
    WHERE ar.employee_id = p_employee_id
      AND ar.organization_id = p_org_id
      AND COALESCE(ar.attendance_date, ar.check_in_at::date) BETWEEN p_period_start AND p_period_end
      AND (ar.check_out_time IS NOT NULL OR ar.check_out_at IS NOT NULL)
  LOOP
    v_attendance_date := COALESCE(v_rec.attendance_date, v_rec.check_out_at::date);

    SELECT *
    INTO v_sched
    FROM public.resolve_effective_schedule(
      p_employee_id,
      p_org_id,
      v_attendance_date
    ) r
    LIMIT 1;

    v_scheduled_end := COALESCE(v_sched.end_time::time, '17:00:00'::time);

    IF v_sched.source = 'shift' AND COALESCE(v_sched.break_duration_minutes, 0) > 0 THEN
      v_scheduled_end := v_scheduled_end + (v_sched.break_duration_minutes || ' minutes')::interval;
    END IF;

    v_threshold := COALESCE(v_sched.overtime_threshold_minutes, 0);

    v_raw_minutes := GREATEST(
      0,
      (
        EXTRACT(EPOCH FROM (
          COALESCE(v_rec.check_out_time, v_rec.check_out_at::time)
          - v_scheduled_end
        )) / 60
      )::integer - v_threshold
    );

    IF v_raw_minutes > 0 THEN
      v_total_minutes := v_total_minutes + v_raw_minutes;
    END IF;
  END LOOP;

  IF v_total_minutes <= 0 THEN
    RETURN jsonb_build_object('overtimePay', 0, 'totalMinutes', 0);
  END IF;

  v_hours := v_total_minutes / 60.0;
  v_first_hour := LEAST(1, v_hours);
  v_next_hours := GREATEST(0, v_hours - 1);
  v_total_pay := round(v_first_hour * v_hourly * 1.5 + v_next_hours * v_hourly * 2);

  RETURN jsonb_build_object(
    'overtimePay', v_total_pay,
    'totalMinutes', v_total_minutes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.payroll_calculate_overtime_pay(uuid, uuid, date, date, numeric) FROM PUBLIC;
