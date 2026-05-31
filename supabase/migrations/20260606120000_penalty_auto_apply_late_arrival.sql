-- Phase A: automatic late_arrival penalties (shift-aware tolerance) + wire check-in RPC.

-- ---------------------------------------------------------------------------
-- apply_late_arrival_penalties(attendance_record_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_late_arrival_penalties(p_attendance_record_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ar public.attendance_records%ROWTYPE;
  v_emp public.employees%ROWTYPE;
  v_settings public.penalty_settings%ROWTYPE;
  v_sched record;
  v_penalizable integer;
  v_rule record;
  v_amount numeric;
  v_hourly numeric;
  v_basic numeric;
  v_daily_sum numeric := 0;
  v_monthly_sum numeric := 0;
  v_applied integer := 0;
  v_month_start date;
  v_month_end date;
  v_row_count integer;
BEGIN
  SELECT *
  INTO v_ar
  FROM public.attendance_records ar
  WHERE ar.id = p_attendance_record_id;

  IF v_ar.id IS NULL THEN
    RETURN jsonb_build_object('applied', 0, 'reason', 'attendance_not_found');
  END IF;

  IF COALESCE(v_ar.is_late, false) IS NOT TRUE OR COALESCE(v_ar.late_minutes, 0) <= 0 THEN
    RETURN jsonb_build_object('applied', 0, 'reason', 'not_late');
  END IF;

  SELECT *
  INTO v_emp
  FROM public.employees e
  WHERE e.id = v_ar.employee_id;

  SELECT *
  INTO v_settings
  FROM public.penalty_settings ps
  WHERE ps.organization_id = v_ar.organization_id;

  IF v_settings.id IS NULL OR COALESCE(v_settings.enable_automatic_penalties, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('applied', 0, 'reason', 'automatic_penalties_disabled');
  END IF;

  SELECT *
  INTO v_sched
  FROM public.resolve_effective_schedule(
    v_ar.employee_id,
    v_ar.organization_id,
    v_ar.attendance_date
  ) r
  LIMIT 1;

  v_penalizable := GREATEST(
    0,
    COALESCE(v_ar.late_minutes, 0) - COALESCE(v_sched.late_tolerance_minutes, 0)
  );

  IF v_penalizable <= 0 THEN
    RETURN jsonb_build_object(
      'applied', 0,
      'reason', 'within_tolerance',
      'penalizable_minutes', 0,
      'late_tolerance_minutes', COALESCE(v_sched.late_tolerance_minutes, 0)
    );
  END IF;

  SELECT COALESCE(epi.basic_salary, 0)
  INTO v_basic
  FROM public.employee_payroll_info epi
  WHERE epi.employee_id = v_ar.employee_id
  ORDER BY epi.updated_at DESC NULLS LAST
  LIMIT 1;

  v_month_start := date_trunc('month', v_ar.attendance_date)::date;
  v_month_end := (date_trunc('month', v_ar.attendance_date) + interval '1 month - 1 day')::date;

  SELECT COALESCE(SUM(ap.penalty_amount), 0)
  INTO v_daily_sum
  FROM public.attendance_penalties ap
  WHERE ap.employee_id = v_ar.employee_id
    AND ap.organization_id = v_ar.organization_id
    AND ap.applied_date = v_ar.attendance_date
    AND ap.status = 'active';

  SELECT COALESCE(SUM(ap.penalty_amount), 0)
  INTO v_monthly_sum
  FROM public.attendance_penalties ap
  WHERE ap.employee_id = v_ar.employee_id
    AND ap.organization_id = v_ar.organization_id
    AND ap.applied_date BETWEEN v_month_start AND v_month_end
    AND ap.status = 'active';

  FOR v_rule IN
    SELECT pr.*
    FROM public.penalty_rules pr
    WHERE pr.organization_id = v_ar.organization_id
      AND pr.rule_type = 'late_arrival'
      AND COALESCE(pr.is_active, true)
      AND v_penalizable >= COALESCE(pr.threshold_minutes, 0)
      AND (
        COALESCE(pr.applies_to_all, true)
        OR (
          v_emp.department_id IS NOT NULL
          AND v_emp.department_id = ANY (COALESCE(pr.specific_departments, ARRAY[]::uuid[]))
        )
      )
    ORDER BY pr.threshold_minutes DESC
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.attendance_penalties ap
      WHERE ap.attendance_record_id = v_ar.id
        AND ap.penalty_rule_id = v_rule.id
        AND ap.applied_date = v_ar.attendance_date
    ) THEN
      CONTINUE;
    END IF;

    v_amount := 0;

    IF v_rule.calculation_type = 'hourly' THEN
      v_hourly := COALESCE(
        v_rule.hourly_rate,
        v_settings.default_hourly_rate,
        0
      );
      v_amount := round((v_penalizable / 60.0) * v_hourly, 2);
    ELSIF v_rule.calculation_type = 'salary_percentage' THEN
      v_amount := round(
        COALESCE(v_basic, 0) * COALESCE(v_rule.salary_percentage, v_settings.default_salary_percentage, 0) / 100.0,
        2
      );
    ELSE
      v_amount := round(COALESCE(v_rule.penalty_amount, 0), 2);
    END IF;

    IF COALESCE(v_settings.minimum_penalty_amount, 0) > 0 AND v_amount > 0 THEN
      v_amount := GREATEST(v_amount, v_settings.minimum_penalty_amount);
    END IF;

    IF COALESCE(v_settings.maximum_daily_penalty, 0) > 0 THEN
      v_amount := LEAST(v_amount, GREATEST(0, v_settings.maximum_daily_penalty - v_daily_sum));
    END IF;

    IF COALESCE(v_settings.maximum_monthly_penalty, 0) > 0 THEN
      v_amount := LEAST(v_amount, GREATEST(0, v_settings.maximum_monthly_penalty - v_monthly_sum));
    END IF;

    IF COALESCE(v_rule.max_penalty_per_month, 0) > 0 THEN
      v_amount := LEAST(v_amount, v_rule.max_penalty_per_month);
    END IF;

    IF v_amount <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.attendance_penalties (
      attendance_record_id,
      employee_id,
      organization_id,
      penalty_rule_id,
      penalty_amount,
      penalty_reason,
      applied_date,
      status,
      auto_generated,
      violation_details
    )
    VALUES (
      v_ar.id,
      v_ar.employee_id,
      v_ar.organization_id,
      v_rule.id,
      v_amount,
      COALESCE(v_rule.name, 'Late arrival'),
      v_ar.attendance_date,
      'active',
      true,
      jsonb_build_object(
        'shift_id', v_sched.shift_id,
        'employee_shift_id', v_sched.employee_shift_id,
        'schedule_source', v_sched.source,
        'start_time', v_sched.start_time,
        'late_minutes', v_ar.late_minutes,
        'late_tolerance_minutes', COALESCE(v_sched.late_tolerance_minutes, 0),
        'penalizable_minutes', v_penalizable,
        'calculation_type', v_rule.calculation_type
      )
    )
    ON CONFLICT (attendance_record_id, penalty_rule_id, applied_date) DO NOTHING;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count > 0 THEN
      v_applied := v_applied + 1;
      SELECT COALESCE(SUM(ap.penalty_amount), 0)
      INTO v_daily_sum
      FROM public.attendance_penalties ap
      WHERE ap.employee_id = v_ar.employee_id
        AND ap.organization_id = v_ar.organization_id
        AND ap.applied_date = v_ar.attendance_date
        AND ap.status = 'active';

      SELECT COALESCE(SUM(ap.penalty_amount), 0)
      INTO v_monthly_sum
      FROM public.attendance_penalties ap
      WHERE ap.employee_id = v_ar.employee_id
        AND ap.organization_id = v_ar.organization_id
        AND ap.applied_date BETWEEN v_month_start AND v_month_end
        AND ap.status = 'active';
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'applied', v_applied,
    'penalizable_minutes', v_penalizable,
    'late_tolerance_minutes', COALESCE(v_sched.late_tolerance_minutes, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_late_arrival_penalties(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_late_arrival_penalties(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_late_arrival_penalties(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- record_attendance_with_timezone: invoke penalty RPC after insert
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_attendance_with_timezone(
  uuid, uuid, text, double precision, double precision, text, text, jsonb, text
);

CREATE OR REPLACE FUNCTION public.record_attendance_with_timezone(
  employee_id_param uuid,
  organization_id_param uuid,
  local_checkin_time text,
  latitude_param double precision,
  longitude_param double precision,
  timezone_param text DEFAULT 'Asia/Jakarta',
  photo_path_param text DEFAULT NULL,
  location_data jsonb DEFAULT '{}'::jsonb,
  notes_param text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth boolean;
  v_ts timestamptz;
  v_date date;
  v_local_ts timestamp;
  v_sched record;
  v_current_mins integer;
  v_start_mins integer;
  v_deadline integer;
  v_late boolean := false;
  v_late_mins integer := 0;
  v_sched_ok boolean := false;
  v_off record;
  new_id uuid := gen_random_uuid();
  v_status text := 'present';
  v_penalty_result jsonb;
  v_penalties_applied integer := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = employee_id_param
      AND e.organization_id = organization_id_param
      AND e.user_id = (SELECT auth.uid())
  )
  INTO v_auth;

  IF NOT v_auth THEN
    RAISE EXCEPTION 'Not authorized to record attendance for this employee';
  END IF;

  v_local_ts := local_checkin_time::timestamp;
  v_date := v_local_ts::date;
  v_ts := v_local_ts AT TIME ZONE timezone_param;

  IF EXISTS (
    SELECT 1
    FROM public.attendance_records ar
    WHERE ar.employee_id = employee_id_param
      AND ar.organization_id = organization_id_param
      AND ar.attendance_date = v_date
      AND (ar.check_in_time IS NOT NULL OR ar.check_in_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Attendance already recorded for this date';
  END IF;

  SELECT *
  INTO v_sched
  FROM public.resolve_effective_schedule(
    employee_id_param,
    organization_id_param,
    v_date
  ) r
  LIMIT 1;

  IF v_sched.work_schedule_id IS NOT NULL OR v_sched.shift_id IS NOT NULL THEN
    v_sched_ok := COALESCE(v_sched.is_working_day, false);
    v_current_mins :=
      EXTRACT(HOUR FROM v_local_ts)::integer * 60
      + EXTRACT(MINUTE FROM v_local_ts)::integer;
    v_start_mins :=
      split_part(v_sched.start_time, ':', 1)::integer * 60
      + COALESCE(NULLIF(split_part(v_sched.start_time, ':', 2), ''), '0')::integer;
    IF v_start_mins IS NULL THEN
      v_start_mins := 9 * 60;
    END IF;
    v_deadline := v_start_mins + COALESCE(v_sched.late_tolerance_minutes, 0);
    IF v_sched_ok AND v_current_mins > v_deadline THEN
      v_late := true;
      v_late_mins := GREATEST(0, v_current_mins - v_start_mins);
    END IF;
  END IF;

  SELECT
    ol.id,
    (
      6371000.0 * acos(
        LEAST(
          1.0::double precision,
          GREATEST(
            -1.0::double precision,
            cos(radians(ol.latitude::double precision))
            * cos(radians(latitude_param))
            * cos(radians(longitude_param) - radians(ol.longitude::double precision))
            + sin(radians(ol.latitude::double precision))
            * sin(radians(latitude_param))
          )
        )
      )
    )::numeric AS dist
  INTO v_off
  FROM public.office_locations ol
  WHERE ol.organization_id = organization_id_param
    AND COALESCE(ol.is_active, true)
    AND ol.latitude IS NOT NULL
    AND ol.longitude IS NOT NULL
  ORDER BY dist ASC
  LIMIT 1;

  INSERT INTO public.attendance_records (
    id,
    employee_id,
    organization_id,
    attendance_date,
    check_in_time,
    check_in_at,
    check_in_photo_path,
    check_in_location,
    office_location_id,
    work_schedule_id,
    shift_id,
    employee_shift_id,
    is_late,
    late_minutes,
    status,
    notes,
    created_at
  )
  VALUES (
    new_id,
    employee_id_param,
    organization_id_param,
    v_date,
    v_local_ts::time,
    v_ts,
    NULLIF(btrim(photo_path_param), ''),
    location_data,
    v_off.id,
    v_sched.work_schedule_id,
    v_sched.shift_id,
    v_sched.employee_shift_id,
    v_late,
    v_late_mins,
    v_status,
    NULLIF(btrim(notes_param), ''),
    now()
  );

  IF v_late THEN
    v_penalty_result := public.apply_late_arrival_penalties(new_id);
    v_penalties_applied := COALESCE((v_penalty_result->>'applied')::integer, 0);
  END IF;

  RETURN jsonb_build_array(
    jsonb_build_object(
      'attendance_id', new_id,
      'is_late', v_late,
      'late_minutes', v_late_mins,
      'status', v_status,
      'shift_id', v_sched.shift_id,
      'employee_shift_id', v_sched.employee_shift_id,
      'work_schedule_id', v_sched.work_schedule_id,
      'schedule_source', v_sched.source,
      'start_time', v_sched.start_time,
      'penalties_applied', v_penalties_applied,
      'penalty_details', v_penalty_result
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_attendance_with_timezone(
  uuid, uuid, text, double precision, double precision, text, text, jsonb, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_attendance_with_timezone(
  uuid, uuid, text, double precision, double precision, text, text, jsonb, text
) TO authenticated;
