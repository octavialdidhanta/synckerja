-- Visit–Attendance integration: visit_day_mode, auto clock-in on Start Visit, penalty exemptions.

-- ---------------------------------------------------------------------------
-- Schema extensions
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance_rules_settings
  ADD COLUMN IF NOT EXISTS enable_visit_attendance_integration boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS travel_threshold_minutes integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS field_first_overlap_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS urban_travel_speed_kmh numeric NOT NULL DEFAULT 35;

ALTER TABLE public.office_locations
  ADD COLUMN IF NOT EXISTS estimated_travel_minutes integer NULL;

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS client_visit_id uuid NULL REFERENCES public.client_visits (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS check_in_source text NULL,
  ADD COLUMN IF NOT EXISTS visit_day_mode text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_check_in_source_check'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_check_in_source_check
      CHECK (check_in_source IS NULL OR check_in_source = ANY (ARRAY['office'::text, 'client_visit'::text]));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_records_client_visit_id
  ON public.attendance_records (client_visit_id);

-- ---------------------------------------------------------------------------
-- load_attendance_rules (extended)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.load_attendance_rules(uuid);

CREATE OR REPLACE FUNCTION public.load_attendance_rules(p_organization_id uuid)
RETURNS TABLE (
  enforce_national_holidays boolean,
  require_photo_checkin boolean,
  require_photo_checkout boolean,
  auto_checkout_enabled boolean,
  auto_checkout_time time,
  default_max_radius_meters integer,
  gps_accuracy_threshold_meters integer,
  require_gps_accuracy boolean,
  allow_manual_location boolean,
  enable_visit_attendance_integration boolean,
  travel_threshold_minutes integer,
  field_first_overlap_minutes integer,
  urban_travel_speed_kmh numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ars.enforce_national_holidays, true),
    COALESCE(ars.require_photo_checkin, false),
    COALESCE(ars.require_photo_checkout, false),
    COALESCE(ars.auto_checkout_enabled, false),
    COALESCE(ars.auto_checkout_time, '18:00'::time),
    COALESCE(ars.default_max_radius_meters, 100),
    COALESCE(ars.gps_accuracy_threshold_meters, 50),
    COALESCE(ars.require_gps_accuracy, false),
    COALESCE(ars.allow_manual_location, false),
    COALESCE(ars.enable_visit_attendance_integration, true),
    COALESCE(ars.travel_threshold_minutes, 90),
    COALESCE(ars.field_first_overlap_minutes, 30),
    COALESCE(ars.urban_travel_speed_kmh, 35)
  FROM (SELECT 1) AS _dummy
  LEFT JOIN public.attendance_rules_settings ars
    ON ars.organization_id = p_organization_id;
$$;

REVOKE ALL ON FUNCTION public.load_attendance_rules(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.load_attendance_rules(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.load_attendance_rules(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._time_text_to_minutes(p_time text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    split_part(COALESCE(p_time, '09:00'), ':', 1)::integer * 60
    + COALESCE(NULLIF(split_part(COALESCE(p_time, '09:00'), ':', 2), ''), '0')::integer;
$$;

CREATE OR REPLACE FUNCTION public._haversine_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    6371.0 * acos(
      LEAST(
        1.0::double precision,
        GREATEST(
          -1.0::double precision,
          cos(radians(lat1)) * cos(radians(lat2))
          * cos(radians(lon2) - radians(lon1))
          + sin(radians(lat1)) * sin(radians(lat2))
        )
      )
    )
  )::numeric;
$$;

CREATE OR REPLACE FUNCTION public.estimate_travel_minutes(
  p_organization_id uuid,
  p_client_location_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules record;
  v_hq record;
  v_client record;
  v_km numeric;
  v_speed numeric;
BEGIN
  IF p_organization_id IS NULL OR p_client_location_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_rules
  FROM public.load_attendance_rules(p_organization_id) r
  LIMIT 1;

  SELECT ol.*
  INTO v_client
  FROM public.office_locations ol
  WHERE ol.id = p_client_location_id
    AND ol.organization_id = p_organization_id;

  IF v_client.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_client.estimated_travel_minutes IS NOT NULL THEN
    RETURN v_client.estimated_travel_minutes;
  END IF;

  SELECT ol.*
  INTO v_hq
  FROM public.office_locations ol
  WHERE ol.organization_id = p_organization_id
    AND COALESCE(ol.is_active, true)
    AND COALESCE(ol.is_client_location, false) IS NOT TRUE
    AND ol.latitude IS NOT NULL
    AND ol.longitude IS NOT NULL
  ORDER BY ol.created_at ASC
  LIMIT 1;

  IF v_hq.id IS NULL OR v_client.latitude IS NULL OR v_client.longitude IS NULL THEN
    RETURN NULL;
  END IF;

  v_km := public._haversine_km(
    v_hq.latitude::double precision,
    v_hq.longitude::double precision,
    v_client.latitude::double precision,
    v_client.longitude::double precision
  );

  v_speed := GREATEST(COALESCE(v_rules.urban_travel_speed_kmh, 35), 1);
  RETURN GREATEST(0, round((v_km / v_speed) * 60.0)::integer);
END;
$$;

REVOKE ALL ON FUNCTION public.estimate_travel_minutes(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estimate_travel_minutes(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estimate_travel_minutes(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- resolve_visit_day_mode
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_visit_day_mode(
  p_employee_id uuid,
  p_organization_id uuid,
  p_date date,
  p_client_location_id uuid DEFAULT NULL,
  p_is_spontaneous boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules record;
  v_sched record;
  v_primary public.client_visits%ROWTYPE;
  v_location_id uuid;
  v_travel integer;
  v_work_start_mins integer;
  v_visit_start_mins integer;
  v_overlap integer;
  v_threshold integer;
  v_mode text;
  v_reason text;
BEGIN
  SELECT *
  INTO v_rules
  FROM public.load_attendance_rules(p_organization_id) r
  LIMIT 1;

  IF COALESCE(v_rules.enable_visit_attendance_integration, true) IS NOT TRUE THEN
    RETURN jsonb_build_object('mode', 'normal', 'reason', 'integration_disabled');
  END IF;

  IF p_is_spontaneous THEN
    RETURN jsonb_build_object(
      'mode', 'field_first',
      'reason', 'spontaneous_visit',
      'primary_visit_id', NULL,
      'planned_start_time', NULL,
      'travel_minutes', NULL,
      'work_start_time', NULL
    );
  END IF;

  SELECT cv.*
  INTO v_primary
  FROM public.client_visits cv
  WHERE cv.employee_id = p_employee_id
    AND cv.organization_id = p_organization_id
    AND cv.visit_date = p_date
    AND cv.status IN ('scheduled', 'ongoing')
  ORDER BY cv.planned_start_time NULLS LAST, cv.created_at ASC
  LIMIT 1;

  IF v_primary.id IS NULL THEN
    RETURN jsonb_build_object('mode', 'normal', 'reason', 'no_scheduled_visit');
  END IF;

  SELECT *
  INTO v_sched
  FROM public.resolve_effective_schedule(p_employee_id, p_organization_id, p_date) r
  LIMIT 1;

  v_location_id := COALESCE(v_primary.validated_location_id, p_client_location_id);
  v_travel := public.estimate_travel_minutes(p_organization_id, v_location_id);
  v_work_start_mins := public._time_text_to_minutes(v_sched.start_time);
  v_visit_start_mins := CASE
    WHEN v_primary.planned_start_time IS NULL THEN v_work_start_mins
    ELSE EXTRACT(HOUR FROM v_primary.planned_start_time)::integer * 60
      + EXTRACT(MINUTE FROM v_primary.planned_start_time)::integer
  END;
  v_overlap := COALESCE(v_rules.field_first_overlap_minutes, 30);
  v_threshold := COALESCE(v_rules.travel_threshold_minutes, 90);

  IF v_visit_start_mins <= v_work_start_mins + v_overlap THEN
    v_mode := 'field_first';
    v_reason := 'visit_start_overlaps_work_start';
  ELSIF COALESCE(v_travel, 0) >= v_threshold THEN
    v_mode := 'travel_field';
    v_reason := 'travel_exceeds_threshold';
  ELSE
    v_mode := 'office_first';
    v_reason := 'near_client_office_first';
  END IF;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'reason', v_reason,
    'primary_visit_id', v_primary.id,
    'planned_start_time', v_primary.planned_start_time,
    'travel_minutes', v_travel,
    'work_start_time', v_sched.start_time
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_visit_day_mode(uuid, uuid, date, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_visit_day_mode(uuid, uuid, date, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_visit_day_mode(uuid, uuid, date, uuid, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- resolve_attendance_late_for_day
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_attendance_late_for_day(
  p_employee_id uuid,
  p_organization_id uuid,
  p_date date,
  p_local_checkin timestamp,
  p_client_visit_id uuid DEFAULT NULL,
  p_is_spontaneous boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode jsonb;
  v_mode_text text;
  v_sched record;
  v_visit public.client_visits%ROWTYPE;
  v_ref_mins integer;
  v_checkin_mins integer;
  v_tolerance integer;
  v_late boolean := false;
  v_late_mins integer := 0;
  v_ref_time time;
BEGIN
  v_mode := public.resolve_visit_day_mode(
    p_employee_id,
    p_organization_id,
    p_date,
    NULL,
    p_is_spontaneous
  );
  v_mode_text := v_mode->>'mode';

  SELECT *
  INTO v_sched
  FROM public.resolve_effective_schedule(p_employee_id, p_organization_id, p_date) r
  LIMIT 1;

  v_tolerance := COALESCE(v_sched.late_tolerance_minutes, 0);
  v_checkin_mins :=
    EXTRACT(HOUR FROM p_local_checkin)::integer * 60
    + EXTRACT(MINUTE FROM p_local_checkin)::integer;

  IF v_mode_text IN ('field_first', 'travel_field') OR p_is_spontaneous THEN
    IF p_client_visit_id IS NOT NULL THEN
      SELECT * INTO v_visit FROM public.client_visits cv WHERE cv.id = p_client_visit_id;
    ELSIF (v_mode->>'primary_visit_id') IS NOT NULL THEN
      SELECT * INTO v_visit FROM public.client_visits cv WHERE cv.id = (v_mode->>'primary_visit_id')::uuid;
    END IF;

    IF p_is_spontaneous OR v_visit.planned_start_time IS NULL THEN
      v_ref_mins := v_checkin_mins;
      v_ref_time := p_local_checkin::time;
      v_late := false;
      v_late_mins := 0;
    ELSE
      v_ref_mins :=
        EXTRACT(HOUR FROM v_visit.planned_start_time)::integer * 60
        + EXTRACT(MINUTE FROM v_visit.planned_start_time)::integer;
      v_ref_time := v_visit.planned_start_time;
      IF v_checkin_mins > v_ref_mins + v_tolerance THEN
        v_late := true;
        v_late_mins := GREATEST(0, v_checkin_mins - v_ref_mins);
      END IF;
    END IF;
  ELSE
    v_ref_mins := public._time_text_to_minutes(v_sched.start_time);
    v_ref_time := v_sched.start_time::time;
    IF v_checkin_mins > v_ref_mins + v_tolerance THEN
      v_late := true;
      v_late_mins := GREATEST(0, v_checkin_mins - v_ref_mins);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_late', v_late,
    'late_minutes', v_late_mins,
    'late_reference_time', v_ref_time,
    'visit_day_mode', v_mode_text,
    'late_tolerance_minutes', v_tolerance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_attendance_late_for_day(uuid, uuid, date, timestamp, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_attendance_late_for_day(uuid, uuid, date, timestamp, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_attendance_late_for_day(uuid, uuid, date, timestamp, uuid, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- has_penalty_exemption
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_penalty_exemption(
  p_employee_id uuid,
  p_organization_id uuid,
  p_applied_date date,
  p_penalty_rule_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.penalty_exemptions pe
    WHERE pe.employee_id = p_employee_id
      AND pe.organization_id = p_organization_id
      AND COALESCE(pe.is_active, true)
      AND pe.start_date <= p_applied_date
      AND (pe.end_date IS NULL OR pe.end_date >= p_applied_date)
      AND (pe.penalty_rule_id IS NULL OR pe.penalty_rule_id = p_penalty_rule_id)
  );
$$;

REVOKE ALL ON FUNCTION public.has_penalty_exemption(uuid, uuid, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_penalty_exemption(uuid, uuid, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_penalty_exemption(uuid, uuid, date, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- apply_late_arrival_penalties (+ exemptions)
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
  v_tolerance integer;
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

  IF public.has_penalty_exemption(v_ar.employee_id, v_ar.organization_id, v_ar.attendance_date, NULL) THEN
    RETURN jsonb_build_object('applied', 0, 'reason', 'exempt_all_rules');
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

  v_tolerance := COALESCE(v_sched.late_tolerance_minutes, 0);
  v_penalizable := GREATEST(0, COALESCE(v_ar.late_minutes, 0) - v_tolerance);

  IF v_penalizable <= 0 THEN
    RETURN jsonb_build_object(
      'applied', 0,
      'reason', 'within_tolerance',
      'penalizable_minutes', 0,
      'late_tolerance_minutes', v_tolerance
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
    IF public.has_penalty_exemption(v_ar.employee_id, v_ar.organization_id, v_ar.attendance_date, v_rule.id) THEN
      CONTINUE;
    END IF;

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
      v_hourly := COALESCE(v_rule.hourly_rate, v_settings.default_hourly_rate, 0);
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
        'late_tolerance_minutes', v_tolerance,
        'penalizable_minutes', v_penalizable,
        'calculation_type', v_rule.calculation_type,
        'visit_day_mode', v_ar.visit_day_mode,
        'check_in_source', v_ar.check_in_source,
        'client_visit_id', v_ar.client_visit_id
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
    'late_tolerance_minutes', v_tolerance
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- record_attendance_from_client_visit (internal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_attendance_from_client_visit(
  p_employee_id uuid,
  p_organization_id uuid,
  p_visit_date date,
  p_client_visit_id uuid,
  p_location_id uuid,
  p_actual_start_time timestamptz,
  p_start_location jsonb,
  p_start_photo_path text,
  p_timezone text DEFAULT 'Asia/Jakarta',
  p_is_spontaneous boolean DEFAULT false,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_local_ts timestamp;
  v_ts timestamptz;
  v_sched record;
  v_late_info jsonb;
  v_late boolean;
  v_late_mins integer;
  v_mode_text text;
  v_off record;
  v_dist numeric;
  v_radius numeric;
  new_id uuid := gen_random_uuid();
  v_penalty_result jsonb;
  v_penalties_applied integer := 0;
BEGIN
  SELECT ar.id
  INTO v_existing
  FROM public.attendance_records ar
  WHERE ar.employee_id = p_employee_id
    AND ar.organization_id = p_organization_id
    AND ar.attendance_date = p_visit_date
    AND (ar.check_in_time IS NOT NULL OR ar.check_in_at IS NOT NULL)
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'skipped', true,
      'reason', 'attendance_already_exists',
      'attendance_id', v_existing
    );
  END IF;

  v_local_ts := (p_actual_start_time AT TIME ZONE COALESCE(p_timezone, 'Asia/Jakarta'))::timestamp;
  v_ts := p_actual_start_time;

  v_late_info := public.resolve_attendance_late_for_day(
    p_employee_id,
    p_organization_id,
    p_visit_date,
    v_local_ts,
    p_client_visit_id,
    p_is_spontaneous
  );

  v_late := COALESCE((v_late_info->>'is_late')::boolean, false);
  v_late_mins := COALESCE((v_late_info->>'late_minutes')::integer, 0);
  v_mode_text := v_late_info->>'visit_day_mode';

  SELECT *
  INTO v_sched
  FROM public.resolve_effective_schedule(p_employee_id, p_organization_id, p_visit_date) r
  LIMIT 1;

  SELECT
    ol.id,
    ol.radius_meters,
    (
      6371000.0 * acos(
        LEAST(
          1.0::double precision,
          GREATEST(
            -1.0::double precision,
            cos(radians(ol.latitude::double precision))
            * cos(radians((p_start_location->>'latitude')::double precision))
            * cos(
              radians((p_start_location->>'longitude')::double precision)
              - radians(ol.longitude::double precision)
            )
            + sin(radians(ol.latitude::double precision))
            * sin(radians((p_start_location->>'latitude')::double precision))
          )
        )
      )
    )::numeric AS dist
  INTO v_off
  FROM public.office_locations ol
  WHERE ol.id = p_location_id
    AND ol.organization_id = p_organization_id;

  IF v_off.id IS NULL THEN
    RAISE EXCEPTION 'Client visit location not found';
  END IF;

  v_dist := v_off.dist;
  v_radius := COALESCE(v_off.radius_meters::numeric, 100::numeric);
  IF v_dist > v_radius THEN
    RAISE EXCEPTION 'Location is outside client site radius';
  END IF;

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
    client_visit_id,
    check_in_source,
    visit_day_mode,
    created_at
  )
  VALUES (
    new_id,
    p_employee_id,
    p_organization_id,
    p_visit_date,
    v_local_ts::time,
    v_ts,
    NULLIF(btrim(p_start_photo_path), ''),
    p_start_location,
    v_off.id,
    v_sched.work_schedule_id,
    v_sched.shift_id,
    v_sched.employee_shift_id,
    v_late,
    v_late_mins,
    'present',
    NULLIF(btrim(p_notes), ''),
    p_client_visit_id,
    'client_visit',
    v_mode_text,
    now()
  );

  IF v_late THEN
    v_penalty_result := public.apply_late_arrival_penalties(new_id);
    v_penalties_applied := COALESCE((v_penalty_result->>'applied')::integer, 0);
  END IF;

  RETURN jsonb_build_object(
    'skipped', false,
    'attendance_id', new_id,
    'attendance_auto_checkin', true,
    'visit_day_mode', v_mode_text,
    'is_late', v_late,
    'late_minutes', v_late_mins,
    'penalties_applied', v_penalties_applied,
    'penalty_details', v_penalty_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_attendance_from_client_visit(
  uuid, uuid, date, uuid, uuid, timestamptz, jsonb, text, text, boolean, text
) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- start_client_visit_execution (jsonb return + auto attendance)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_client_visit_execution(
  uuid, uuid, date, uuid, uuid, timestamptz, jsonb, text, uuid, jsonb, numeric, text
);

CREATE OR REPLACE FUNCTION public.start_client_visit_execution(
  p_employee_id uuid,
  p_organization_id uuid,
  p_visit_date date,
  p_location_id uuid,
  p_lead_client_id uuid,
  p_actual_start_time timestamptz,
  p_start_location jsonb,
  p_start_photo_path text,
  p_created_by uuid,
  p_location_validation_result jsonb DEFAULT NULL,
  p_validation_accuracy_meters numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location_client_id uuid;
  v_scheduled public.client_visits%ROWTYPE;
  v_result public.client_visits%ROWTYPE;
  v_is_spontaneous boolean := false;
  v_mode jsonb;
  v_mode_text text;
  v_attendance jsonb := NULL;
  v_tz text := 'Asia/Jakarta';
BEGIN
  IF p_employee_id IS NULL OR p_organization_id IS NULL OR p_visit_date IS NULL OR p_location_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.user_id = auth.uid()
      AND e.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT COALESCE(wss.timezone, 'Asia/Jakarta')
  INTO v_tz
  FROM public.work_schedule_settings wss
  WHERE wss.organization_id = p_organization_id
    AND COALESCE(wss.is_active, true)
  ORDER BY wss.is_default DESC NULLS LAST, wss.created_at ASC
  LIMIT 1;

  SELECT ol.client_id
  INTO v_location_client_id
  FROM public.office_locations ol
  WHERE ol.id = p_location_id
    AND ol.organization_id = p_organization_id;

  IF EXISTS (
    SELECT 1
    FROM public.client_visits cv
    WHERE cv.employee_id = p_employee_id
      AND cv.organization_id = p_organization_id
      AND cv.visit_date = p_visit_date
      AND cv.status = 'completed'
      AND cv.actual_start_time IS NOT NULL
      AND cv.actual_end_time IS NOT NULL
      AND (
        cv.validated_location_id = p_location_id
        OR (
          v_location_client_id IS NOT NULL
          AND cv.lead_client_id = v_location_client_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'COMPLETED_VISIT_EXISTS';
  END IF;

  SELECT cv.*
  INTO v_scheduled
  FROM public.client_visits cv
  WHERE cv.employee_id = p_employee_id
    AND cv.organization_id = p_organization_id
    AND cv.visit_date = p_visit_date
    AND cv.status = 'scheduled'
    AND (
      cv.validated_location_id = p_location_id
      OR (
        v_location_client_id IS NOT NULL
        AND cv.lead_client_id = v_location_client_id
      )
      OR (
        p_lead_client_id IS NOT NULL
        AND cv.lead_client_id = p_lead_client_id
      )
    )
  ORDER BY
    CASE WHEN cv.validated_location_id = p_location_id THEN 0 ELSE 1 END,
    cv.planned_start_time NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_scheduled.id IS NOT NULL THEN
    UPDATE public.client_visits
    SET
      actual_start_time = p_actual_start_time,
      start_location = p_start_location,
      status = 'ongoing',
      start_photo_path = p_start_photo_path,
      created_by = p_created_by,
      validated_location_id = p_location_id,
      location_validation_result = p_location_validation_result,
      validation_accuracy_meters = p_validation_accuracy_meters,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
    WHERE id = v_scheduled.id
      AND status = 'scheduled'
    RETURNING * INTO v_result;

    IF v_result.id IS NULL THEN
      RAISE EXCEPTION 'SCHEDULED_UPDATE_FAILED';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.client_visits cv
      WHERE cv.employee_id = p_employee_id
        AND cv.organization_id = p_organization_id
        AND cv.visit_date = p_visit_date
        AND cv.status = 'scheduled'
    ) THEN
      RAISE EXCEPTION 'SCHEDULED_VISIT_EXISTS';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.client_visits cv
      WHERE cv.employee_id = p_employee_id
        AND cv.organization_id = p_organization_id
        AND cv.visit_date = p_visit_date
        AND cv.status = 'ongoing'
    ) THEN
      RAISE EXCEPTION 'ONGOING_VISIT_EXISTS';
    END IF;

    v_is_spontaneous := true;

    INSERT INTO public.client_visits (
      employee_id,
      organization_id,
      lead_client_id,
      visit_date,
      planned_start_time,
      planned_end_time,
      visit_purpose,
      actual_start_time,
      start_location,
      status,
      start_photo_path,
      created_by,
      validated_location_id,
      location_validation_result,
      validation_accuracy_meters,
      notes
    )
    VALUES (
      p_employee_id,
      p_organization_id,
      p_lead_client_id,
      p_visit_date,
      NULL,
      NULL,
      'Spontaneous client visit',
      p_actual_start_time,
      p_start_location,
      'ongoing',
      p_start_photo_path,
      p_created_by,
      p_location_id,
      p_location_validation_result,
      p_validation_accuracy_meters,
      p_notes
    )
    RETURNING * INTO v_result;
  END IF;

  v_mode := public.resolve_visit_day_mode(
    p_employee_id,
    p_organization_id,
    p_visit_date,
    p_location_id,
    v_is_spontaneous
  );
  v_mode_text := v_mode->>'mode';

  IF v_is_spontaneous OR v_mode_text IN ('field_first', 'travel_field') THEN
    v_attendance := public.record_attendance_from_client_visit(
      p_employee_id,
      p_organization_id,
      p_visit_date,
      v_result.id,
      p_location_id,
      p_actual_start_time,
      p_start_location,
      p_start_photo_path,
      v_tz,
      v_is_spontaneous,
      p_notes
    );
  END IF;

  RETURN jsonb_build_object(
    'visit', to_jsonb(v_result),
    'visit_day_mode', v_mode_text,
    'attendance', v_attendance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_client_visit_execution(
  uuid, uuid, date, uuid, uuid, timestamptz, jsonb, text, uuid, jsonb, numeric, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.start_client_visit_execution(
  uuid, uuid, date, uuid, uuid, timestamptz, jsonb, text, uuid, jsonb, numeric, text
) TO authenticated;

COMMENT ON FUNCTION public.start_client_visit_execution IS
  'Start client visit; returns visit + optional auto attendance check-in for field_first/travel_field/spontaneous.';

-- ---------------------------------------------------------------------------
-- validate_attendance_comprehensive (visit_day_mode aware)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.validate_attendance_comprehensive(
  uuid, uuid, double precision, double precision, text, numeric, boolean
);

CREATE OR REPLACE FUNCTION public.validate_attendance_comprehensive(
  employee_id_param uuid,
  organization_id_param uuid,
  latitude_param double precision,
  longitude_param double precision,
  face_image_data text DEFAULT NULL,
  gps_accuracy_meters numeric DEFAULT NULL,
  is_manual_location boolean DEFAULT false
)
RETURNS TABLE (
  allowed_radius numeric,
  can_attend boolean,
  distance_meters numeric,
  face_registered boolean,
  face_valid boolean,
  is_holiday boolean,
  is_late boolean,
  late_minutes integer,
  location_valid boolean,
  no_duplicate boolean,
  office_location_id uuid,
  office_location_name text,
  schedule_valid boolean,
  shift_id uuid,
  employee_shift_id uuid,
  work_schedule_id uuid,
  schedule_source text,
  start_time text,
  working_days integer[],
  gps_accuracy_valid boolean,
  photo_required boolean,
  attendance_rules_snapshot jsonb,
  visit_day_mode text,
  late_reference_time time
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sched record;
  v_rules record;
  v_mode jsonb;
  v_mode_text text;
  v_tz text;
  v_now_local timestamp;
  v_today date;
  v_off record;
  v_dist numeric;
  v_radius numeric;
  v_loc_ok boolean;
  v_sched_ok boolean;
  v_holiday boolean;
  v_holiday_blocks boolean;
  v_dup_ok boolean;
  v_face_reg boolean;
  v_face_ok boolean;
  v_late boolean := false;
  v_late_mins integer := 0;
  v_late_ref time;
  v_late_info jsonb;
  v_gps_ok boolean := true;
  v_manual_ok boolean := true;
  v_photo_ok boolean := true;
  v_photo_required boolean := false;
  v_can_attend boolean;
  v_auth boolean;
  v_rules_snapshot jsonb;
  v_use_client_checkin boolean := false;
  v_off_id uuid;
  v_off_name text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = employee_id_param
      AND e.organization_id = organization_id_param
      AND (
        e.user_id = auth.uid()
        OR organization_id_param IN (SELECT public.user_organization_ids())
      )
  )
  INTO v_auth;

  IF NOT v_auth THEN
    RETURN QUERY
    SELECT
      0::numeric, false, NULL::numeric, false, false, false, false, 0,
      false, false, NULL::uuid, NULL::text, false,
      NULL::uuid, NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::integer[],
      false, false, NULL::jsonb, NULL::text, NULL::time;
    RETURN;
  END IF;

  SELECT *
  INTO v_rules
  FROM public.load_attendance_rules(organization_id_param) r
  LIMIT 1;

  SELECT COALESCE(wss.timezone, 'Asia/Jakarta')
  INTO v_tz
  FROM public.employees e
  LEFT JOIN public.work_schedule_settings wss
    ON wss.id = e.work_schedule_id
   AND wss.organization_id = organization_id_param
   AND COALESCE(wss.is_active, true)
  WHERE e.id = employee_id_param
    AND e.organization_id = organization_id_param;

  IF v_tz IS NULL THEN
    SELECT COALESCE(wss.timezone, 'Asia/Jakarta')
    INTO v_tz
    FROM public.work_schedule_settings wss
    WHERE wss.organization_id = organization_id_param
      AND COALESCE(wss.is_active, true)
    ORDER BY wss.is_default DESC NULLS LAST, wss.created_at ASC
    LIMIT 1;
  END IF;

  v_tz := COALESCE(v_tz, 'Asia/Jakarta');
  v_now_local := timezone(v_tz, now());
  v_today := (v_now_local)::date;

  v_mode := public.resolve_visit_day_mode(employee_id_param, organization_id_param, v_today);
  v_mode_text := COALESCE(v_mode->>'mode', 'normal');

  v_rules_snapshot := jsonb_build_object(
    'enforce_national_holidays', v_rules.enforce_national_holidays,
    'require_photo_checkin', v_rules.require_photo_checkin,
    'require_gps_accuracy', v_rules.require_gps_accuracy,
    'gps_accuracy_threshold_meters', v_rules.gps_accuracy_threshold_meters,
    'default_max_radius_meters', v_rules.default_max_radius_meters,
    'allow_manual_location', v_rules.allow_manual_location,
    'enable_visit_attendance_integration', v_rules.enable_visit_attendance_integration,
    'visit_day_mode', v_mode_text
  );

  SELECT *
  INTO v_sched
  FROM public.resolve_effective_schedule(
    employee_id_param,
    organization_id_param,
    v_today
  ) r
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.national_holidays nh
    WHERE COALESCE(nh.is_active, true)
      AND COALESCE(nh.applies_to_attendance, true)
      AND nh.date = v_today
      AND (
        nh.organization_id IS NULL
        OR nh.organization_id = organization_id_param
      )
  )
  INTO v_holiday;

  v_holiday_blocks := v_holiday AND COALESCE(v_rules.enforce_national_holidays, true);

  v_dup_ok := NOT EXISTS (
    SELECT 1
    FROM public.attendance_records ar
    WHERE ar.employee_id = employee_id_param
      AND ar.organization_id = organization_id_param
      AND ar.attendance_date = v_today
      AND ar.check_in_time IS NOT NULL
  );

  SELECT EXISTS (
    SELECT 1
    FROM public.employee_face_registrations efr
    WHERE efr.employee_id = employee_id_param
      AND efr.organization_id = organization_id_param
      AND COALESCE(efr.is_active, true)
  )
  INTO v_face_reg;

  IF face_image_data IS NULL OR btrim(face_image_data) = '' THEN
    v_face_ok := true;
  ELSE
    v_face_ok := v_face_reg;
  END IF;

  IF v_sched.work_schedule_id IS NULL AND v_sched.shift_id IS NULL THEN
    v_sched_ok := false;
  ELSE
    v_sched_ok := COALESCE(v_sched.is_working_day, false);
    IF NOT v_sched_ok
       AND v_sched.source = 'shift'
       AND v_sched.shift_id IS NOT NULL
       AND v_sched.employee_shift_id IS NOT NULL THEN
      v_sched_ok := true;
    END IF;
  END IF;

  v_late_info := public.resolve_attendance_late_for_day(
    employee_id_param,
    organization_id_param,
    v_today,
    v_now_local,
    NULL,
    false
  );
  v_late := COALESCE((v_late_info->>'is_late')::boolean, false);
  v_late_mins := COALESCE((v_late_info->>'late_minutes')::integer, 0);
  v_late_ref := (v_late_info->>'late_reference_time')::time;

  v_use_client_checkin := v_mode_text IN ('field_first', 'travel_field') AND v_dup_ok;

  IF v_use_client_checkin THEN
    v_loc_ok := false;
    v_dist := NULL;
    v_radius := 0;
    v_off_id := NULL;
    v_off_name := NULL;
  ELSE
    SELECT
      ol.id,
      ol.name,
      ol.radius_meters,
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
      AND COALESCE(ol.is_client_location, false) IS NOT TRUE
      AND ol.latitude IS NOT NULL
      AND ol.longitude IS NOT NULL
    ORDER BY dist ASC
    LIMIT 1;

    v_off_id := v_off.id;
    v_off_name := v_off.name;

    IF v_off_id IS NULL THEN
      v_loc_ok := false;
      v_dist := NULL;
      v_radius := 0;
    ELSE
      v_dist := v_off.dist;
      v_radius := COALESCE(
        v_off.radius_meters::numeric,
        v_rules.default_max_radius_meters::numeric,
        100::numeric
      );
      v_loc_ok := v_dist <= v_radius;
    END IF;
  END IF;

  IF COALESCE(v_rules.require_gps_accuracy, false) THEN
    IF gps_accuracy_meters IS NULL THEN
      v_gps_ok := false;
    ELSE
      v_gps_ok := gps_accuracy_meters <= v_rules.gps_accuracy_threshold_meters;
    END IF;
  END IF;

  IF COALESCE(is_manual_location, false) AND NOT COALESCE(v_rules.allow_manual_location, false) THEN
    v_manual_ok := false;
  END IF;

  v_photo_required := COALESCE(v_rules.require_photo_checkin, false);
  IF v_photo_required AND (face_image_data IS NULL OR btrim(face_image_data) = '') THEN
    v_photo_ok := false;
  END IF;

  v_can_attend :=
    NOT v_use_client_checkin
    AND v_loc_ok
    AND v_sched_ok
    AND NOT v_holiday_blocks
    AND v_dup_ok
    AND v_face_ok
    AND v_gps_ok
    AND v_manual_ok
    AND v_photo_ok;

  RETURN QUERY
  SELECT
    COALESCE(v_radius, 0::numeric),
    v_can_attend,
    v_dist,
    v_face_reg,
    v_face_ok,
    v_holiday,
    v_late,
    v_late_mins,
    v_loc_ok,
    v_dup_ok,
    v_off_id,
    v_off_name,
    v_sched_ok,
    v_sched.shift_id,
    v_sched.employee_shift_id,
    v_sched.work_schedule_id,
    v_sched.source,
    v_sched.start_time,
    v_sched.working_days,
    v_gps_ok,
    v_photo_required,
    v_rules_snapshot,
    v_mode_text,
    v_late_ref;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_attendance_comprehensive(
  uuid, uuid, double precision, double precision, text, numeric, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_attendance_comprehensive(
  uuid, uuid, double precision, double precision, text, numeric, boolean
) TO authenticated;

-- ---------------------------------------------------------------------------
-- record_attendance_with_timezone (visit_day_mode aware)
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
  v_rules record;
  v_mode jsonb;
  v_mode_text text;
  v_late_info jsonb;
  v_late boolean := false;
  v_late_mins integer := 0;
  v_sched_ok boolean := false;
  v_holiday boolean;
  v_holiday_blocks boolean;
  v_off record;
  v_dist numeric;
  v_radius numeric;
  v_loc_ok boolean;
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

  SELECT *
  INTO v_rules
  FROM public.load_attendance_rules(organization_id_param) r
  LIMIT 1;

  IF COALESCE(v_rules.require_photo_checkin, false)
     AND (photo_path_param IS NULL OR btrim(photo_path_param) = '') THEN
    RAISE EXCEPTION 'Photo is required for check-in per organization attendance rules';
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

  v_mode := public.resolve_visit_day_mode(employee_id_param, organization_id_param, v_date);
  v_mode_text := COALESCE(v_mode->>'mode', 'normal');

  IF v_mode_text IN ('field_first', 'travel_field')
     AND COALESCE(v_rules.enable_visit_attendance_integration, true) THEN
    RAISE EXCEPTION 'USE_CLIENT_VISIT_CHECKIN';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.national_holidays nh
    WHERE COALESCE(nh.is_active, true)
      AND COALESCE(nh.applies_to_attendance, true)
      AND nh.date = v_date
      AND (
        nh.organization_id IS NULL
        OR nh.organization_id = organization_id_param
      )
  )
  INTO v_holiday;

  v_holiday_blocks := v_holiday AND COALESCE(v_rules.enforce_national_holidays, true);
  IF v_holiday_blocks THEN
    RAISE EXCEPTION 'Attendance is not allowed on national holidays per organization rules';
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
    IF NOT v_sched_ok
       AND v_sched.source = 'shift'
       AND v_sched.shift_id IS NOT NULL
       AND v_sched.employee_shift_id IS NOT NULL THEN
      v_sched_ok := true;
    END IF;
    IF NOT v_sched_ok THEN
      RAISE EXCEPTION 'Attendance is not allowed on this day per work schedule';
    END IF;
  END IF;

  v_late_info := public.resolve_attendance_late_for_day(
    employee_id_param,
    organization_id_param,
    v_date,
    v_local_ts,
    NULL,
    false
  );
  v_late := COALESCE((v_late_info->>'is_late')::boolean, false);
  v_late_mins := COALESCE((v_late_info->>'late_minutes')::integer, 0);

  SELECT
    ol.id,
    ol.radius_meters,
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
    AND COALESCE(ol.is_client_location, false) IS NOT TRUE
    AND ol.latitude IS NOT NULL
    AND ol.longitude IS NOT NULL
  ORDER BY dist ASC
  LIMIT 1;

  IF v_off.id IS NULL THEN
    RAISE EXCEPTION 'Office location required for attendance';
  END IF;

  v_dist := v_off.dist;
  v_radius := COALESCE(
    v_off.radius_meters::numeric,
    v_rules.default_max_radius_meters::numeric,
    100::numeric
  );
  v_loc_ok := v_dist <= v_radius;

  IF NOT v_loc_ok THEN
    RAISE EXCEPTION 'Location is outside allowed office radius (% m, max % m)', v_dist, v_radius;
  END IF;

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
    check_in_source,
    visit_day_mode,
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
    'office',
    v_mode_text,
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
      'visit_day_mode', v_mode_text,
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
