-- Phase 2: wire attendance_rules_settings into validation + record + checkout RPCs.

-- ---------------------------------------------------------------------------
-- Helper: load org rules with migration defaults when row missing
-- ---------------------------------------------------------------------------
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
  allow_manual_location boolean
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
    COALESCE(ars.allow_manual_location, false)
  FROM (SELECT 1) AS _dummy
  LEFT JOIN public.attendance_rules_settings ars
    ON ars.organization_id = p_organization_id;
$$;

REVOKE ALL ON FUNCTION public.load_attendance_rules(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.load_attendance_rules(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.load_attendance_rules(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- validate_attendance_comprehensive (extended)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.validate_attendance_comprehensive(
  uuid, uuid, double precision, double precision, text, numeric, boolean
);
DROP FUNCTION IF EXISTS public.validate_attendance_comprehensive(
  uuid, uuid, double precision, double precision, text
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
  attendance_rules_snapshot jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sched record;
  v_rules record;
  v_tz text;
  v_now_local timestamp;
  v_today date;
  v_current_mins integer;
  v_start_mins integer;
  v_deadline integer;
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
  v_gps_ok boolean := true;
  v_manual_ok boolean := true;
  v_photo_ok boolean := true;
  v_photo_required boolean := false;
  v_can_attend boolean;
  v_auth boolean;
  v_rules_snapshot jsonb;
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
      false, false, NULL::jsonb;
    RETURN;
  END IF;

  SELECT *
  INTO v_rules
  FROM public.load_attendance_rules(organization_id_param) r
  LIMIT 1;

  v_rules_snapshot := jsonb_build_object(
    'enforce_national_holidays', v_rules.enforce_national_holidays,
    'require_photo_checkin', v_rules.require_photo_checkin,
    'require_gps_accuracy', v_rules.require_gps_accuracy,
    'gps_accuracy_threshold_meters', v_rules.gps_accuracy_threshold_meters,
    'default_max_radius_meters', v_rules.default_max_radius_meters,
    'allow_manual_location', v_rules.allow_manual_location
  );

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

    -- Shift assignment overrides WSS non-working day (e.g. Saturday shift)
    IF NOT v_sched_ok
       AND v_sched.source = 'shift'
       AND v_sched.shift_id IS NOT NULL
       AND v_sched.employee_shift_id IS NOT NULL THEN
      v_sched_ok := true;
    END IF;

    v_current_mins :=
      EXTRACT(HOUR FROM v_now_local)::integer * 60
      + EXTRACT(MINUTE FROM v_now_local)::integer;
    v_start_mins :=
      split_part(v_sched.start_time, ':', 1)::integer * 60
      + COALESCE(NULLIF(split_part(v_sched.start_time, ':', 2), ''), '0')::integer;
    IF v_start_mins IS NULL THEN
      v_start_mins := 9 * 60;
    END IF;
    v_deadline := v_start_mins + COALESCE(v_sched.late_tolerance_minutes, 0);
    IF v_sched_ok AND NOT v_holiday_blocks AND v_current_mins > v_deadline THEN
      v_late := true;
      v_late_mins := GREATEST(0, v_current_mins - v_start_mins);
    END IF;
  END IF;

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
    AND ol.latitude IS NOT NULL
    AND ol.longitude IS NOT NULL
  ORDER BY dist ASC
  LIMIT 1;

  IF v_off.id IS NULL THEN
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
    v_loc_ok
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
    v_off.id,
    v_off.name,
    v_sched_ok,
    v_sched.shift_id,
    v_sched.employee_shift_id,
    v_sched.work_schedule_id,
    v_sched.source,
    v_sched.start_time,
    v_sched.working_days,
    v_gps_ok,
    v_photo_required,
    v_rules_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_attendance_comprehensive(
  uuid, uuid, double precision, double precision, text, numeric, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_attendance_comprehensive(
  uuid, uuid, double precision, double precision, text, numeric, boolean
) TO authenticated;

-- ---------------------------------------------------------------------------
-- validate_checkout_comprehensive
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_checkout_comprehensive(
  employee_id_param uuid,
  organization_id_param uuid,
  photo_path_param text DEFAULT NULL,
  face_image_data text DEFAULT NULL
)
RETURNS TABLE (
  can_checkout boolean,
  photo_required boolean,
  photo_valid boolean,
  has_checkin boolean,
  already_checked_out boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules record;
  v_tz text;
  v_today date;
  v_has_checkin boolean := false;
  v_already_out boolean := false;
  v_photo_required boolean := false;
  v_photo_ok boolean := true;
  v_auth boolean;
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
    RETURN QUERY SELECT false, false, false, false, false;
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
  WHERE e.id = employee_id_param
    AND e.organization_id = organization_id_param;

  v_tz := COALESCE(v_tz, 'Asia/Jakarta');
  v_today := (timezone(v_tz, now()))::date;

  SELECT
    (ar.check_in_time IS NOT NULL OR ar.check_in_at IS NOT NULL),
    (ar.check_out_time IS NOT NULL OR ar.check_out_at IS NOT NULL)
  INTO v_has_checkin, v_already_out
  FROM public.attendance_records ar
  WHERE ar.employee_id = employee_id_param
    AND ar.organization_id = organization_id_param
    AND ar.attendance_date = v_today
  LIMIT 1;

  v_has_checkin := COALESCE(v_has_checkin, false);
  v_already_out := COALESCE(v_already_out, false);

  v_photo_required := COALESCE(v_rules.require_photo_checkout, false);
  IF v_photo_required THEN
    IF (photo_path_param IS NULL OR btrim(photo_path_param) = '')
       AND (face_image_data IS NULL OR btrim(face_image_data) = '') THEN
      v_photo_ok := false;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    v_has_checkin AND NOT v_already_out AND v_photo_ok,
    v_photo_required,
    v_photo_ok,
    v_has_checkin,
    v_already_out;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_checkout_comprehensive(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_checkout_comprehensive(uuid, uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- record_attendance_with_timezone: rules defense-in-depth + keep penalty hook
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
  v_current_mins integer;
  v_start_mins integer;
  v_deadline integer;
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

-- ---------------------------------------------------------------------------
-- apply_attendance_auto_checkout: idempotent per employee/day (Phase 3 cron target)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_attendance_auto_checkout(p_organization_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rules record;
  v_org record;
  v_tz text;
  v_today date;
  v_now_local time;
  v_updated integer := 0;
  v_ar record;
BEGIN
  FOR v_org IN
    SELECT ars.organization_id, ars.auto_checkout_time
    FROM public.attendance_rules_settings ars
    WHERE COALESCE(ars.auto_checkout_enabled, false)
      AND (p_organization_id IS NULL OR ars.organization_id = p_organization_id)
  LOOP
    SELECT COALESCE(wss.timezone, 'Asia/Jakarta')
    INTO v_tz
    FROM public.work_schedule_settings wss
    WHERE wss.organization_id = v_org.organization_id
      AND COALESCE(wss.is_active, true)
    ORDER BY wss.is_default DESC NULLS LAST, wss.created_at ASC
    LIMIT 1;

    v_tz := COALESCE(v_tz, 'Asia/Jakarta');
    v_today := (timezone(v_tz, now()))::date;
    v_now_local := (timezone(v_tz, now()))::time;

    IF v_now_local < v_org.auto_checkout_time THEN
      CONTINUE;
    END IF;

    FOR v_ar IN
      SELECT ar.id, ar.employee_id, ar.attendance_date, ar.check_in_at, ar.check_in_time
      FROM public.attendance_records ar
      WHERE ar.organization_id = v_org.organization_id
        AND ar.attendance_date = v_today
        AND (ar.check_in_time IS NOT NULL OR ar.check_in_at IS NOT NULL)
        AND ar.check_out_time IS NULL
        AND ar.check_out_at IS NULL
    LOOP
      UPDATE public.attendance_records ar
      SET
        check_out_time = v_org.auto_checkout_time,
        check_out_at = (v_ar.attendance_date + v_org.auto_checkout_time) AT TIME ZONE v_tz,
        status = COALESCE(ar.status, 'present'),
        notes = CASE
          WHEN ar.notes IS NULL OR btrim(ar.notes) = '' THEN '[auto_checkout]'
          WHEN ar.notes NOT LIKE '%[auto_checkout]%' THEN ar.notes || ' [auto_checkout]'
          ELSE ar.notes
        END,
        updated_at = now()
      WHERE ar.id = v_ar.id
        AND ar.check_out_time IS NULL
        AND ar.check_out_at IS NULL;

      IF FOUND THEN
        v_updated := v_updated + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_attendance_auto_checkout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_attendance_auto_checkout(uuid) TO service_role;
