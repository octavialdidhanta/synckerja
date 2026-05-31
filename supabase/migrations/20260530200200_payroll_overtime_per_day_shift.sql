-- Payroll overtime: resolve scheduled end time per attendance day via resolve_effective_schedule.

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
