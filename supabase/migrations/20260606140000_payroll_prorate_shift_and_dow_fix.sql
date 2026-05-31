-- Phase C: fix DOW in payroll_count_working_days + shift-assigned prorate days.

CREATE OR REPLACE FUNCTION public.payroll_count_working_days(
  p_org_id uuid,
  p_start date,
  p_end date,
  p_working_days integer[],
  p_count_holiday_as_working boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_count integer := 0;
  v_d date;
  v_app_dow integer;
  v_is_holiday boolean;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_start > p_end THEN
    RETURN 0;
  END IF;

  v_d := p_start;
  WHILE v_d <= p_end LOOP
    v_app_dow := public.pg_dow_to_app_dow(EXTRACT(DOW FROM v_d)::integer);
    IF v_app_dow = ANY (COALESCE(p_working_days, ARRAY[1, 2, 3, 4, 5])) THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.national_holidays nh
        WHERE nh.date = v_d
          AND nh.is_active IS NOT DISTINCT FROM true
          AND nh.applies_to_attendance IS NOT DISTINCT FROM true
          AND (nh.organization_id IS NULL OR nh.organization_id = p_org_id)
      ) INTO v_is_holiday;

      IF p_count_holiday_as_working OR NOT v_is_holiday THEN
        v_count := v_count + 1;
      END IF;
    END IF;
    v_d := v_d + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_count_shift_assigned_working_days(
  p_org_id uuid,
  p_employee_id uuid,
  p_start date,
  p_end date,
  p_count_holiday_as_working boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_count integer := 0;
  v_d date;
  v_sched record;
  v_is_holiday boolean;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_start > p_end THEN
    RETURN 0;
  END IF;

  v_d := p_start;
  WHILE v_d <= p_end LOOP
    SELECT *
    INTO v_sched
    FROM public.resolve_effective_schedule(
      p_employee_id,
      p_org_id,
      v_d
    ) r
    LIMIT 1;

    IF COALESCE(v_sched.is_working_day, false)
       AND v_sched.source = 'shift' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.national_holidays nh
        WHERE nh.date = v_d
          AND nh.is_active IS NOT DISTINCT FROM true
          AND nh.applies_to_attendance IS NOT DISTINCT FROM true
          AND (nh.organization_id IS NULL OR nh.organization_id = p_org_id)
      ) INTO v_is_holiday;

      IF p_count_holiday_as_working OR NOT v_is_holiday THEN
        v_count := v_count + 1;
      END IF;
    END IF;

    v_d := v_d + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.payroll_employee_prorate_ratio(
  p_org_id uuid,
  p_period_start date,
  p_period_end date,
  p_employee_id uuid,
  p_count_holiday_as_working boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_working_days integer[];
  v_emp_wss_id uuid;
  v_join date;
  v_total integer;
  v_effective integer;
  v_eff_start date;
  v_eff_end date;
  v_has_shift_assignment boolean := false;
BEGIN
  SELECT e.work_schedule_id, COALESCE(e.join_date, e.hire_date)
  INTO v_emp_wss_id, v_join
  FROM public.employees e
  WHERE e.id = p_employee_id;

  IF v_emp_wss_id IS NOT NULL THEN
    SELECT COALESCE(ws.working_days, ARRAY[1, 2, 3, 4, 5])
    INTO v_working_days
    FROM public.work_schedule_settings ws
    WHERE ws.id = v_emp_wss_id
      AND ws.organization_id = p_org_id
      AND ws.is_active IS NOT DISTINCT FROM true;
  END IF;

  IF v_working_days IS NULL THEN
    SELECT COALESCE(ws.working_days, ARRAY[1, 2, 3, 4, 5])
    INTO v_working_days
    FROM public.work_schedule_settings ws
    WHERE ws.organization_id = p_org_id
      AND ws.is_active IS NOT DISTINCT FROM true
    ORDER BY ws.is_default DESC NULLS LAST, ws.created_at
    LIMIT 1;
  END IF;

  IF v_working_days IS NULL THEN
    v_working_days := ARRAY[1, 2, 3, 4, 5];
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.employee_shifts es
    WHERE es.employee_id = p_employee_id
      AND es.organization_id = p_org_id
      AND COALESCE(es.is_active, true)
      AND es.effective_from_date <= p_period_end
      AND (es.effective_to_date IS NULL OR es.effective_to_date >= p_period_start)
  )
  INTO v_has_shift_assignment;

  v_eff_start := p_period_start;
  v_eff_end := p_period_end;

  IF v_join IS NOT NULL AND v_join > v_eff_start THEN
    v_eff_start := v_join;
  END IF;

  IF v_eff_start > v_eff_end THEN
    RETURN 0;
  END IF;

  IF v_has_shift_assignment THEN
    v_total := public.payroll_count_shift_assigned_working_days(
      p_org_id, p_employee_id, p_period_start, p_period_end, p_count_holiday_as_working
    );
    v_effective := public.payroll_count_shift_assigned_working_days(
      p_org_id, p_employee_id, v_eff_start, v_eff_end, p_count_holiday_as_working
    );
  ELSE
    v_total := public.payroll_count_working_days(
      p_org_id, p_period_start, p_period_end, v_working_days, p_count_holiday_as_working
    );
    v_effective := public.payroll_count_working_days(
      p_org_id, v_eff_start, v_eff_end, v_working_days, p_count_holiday_as_working
    );
  END IF;

  IF v_total <= 0 THEN
    RETURN 1;
  END IF;

  RETURN LEAST(1, v_effective::numeric / v_total::numeric);
END;
$$;

REVOKE ALL ON FUNCTION public.payroll_count_shift_assigned_working_days(uuid, uuid, date, date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payroll_count_shift_assigned_working_days(uuid, uuid, date, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_count_shift_assigned_working_days(uuid, uuid, date, date, boolean) TO service_role;
