-- Attendance RPCs: use resolve_effective_schedule for late/schedule logic + persist shift audit columns.

DROP FUNCTION IF EXISTS public.validate_attendance_comprehensive(uuid, uuid, double precision, double precision, text);

CREATE OR REPLACE FUNCTION public.validate_attendance_comprehensive(
  employee_id_param uuid,
  organization_id_param uuid,
  latitude_param double precision,
  longitude_param double precision,
  face_image_data text DEFAULT NULL
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
  working_days integer[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sched record;
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
  v_dup_ok boolean;
  v_face_reg boolean;
  v_face_ok boolean;
  v_late boolean := false;
  v_late_mins integer := 0;
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
    RETURN QUERY
    SELECT
      0::numeric,
      false,
      NULL::numeric,
      false,
      false,
      false,
      false,
      0,
      false,
      false,
      NULL::uuid,
      NULL::text,
      false,
      NULL::uuid,
      NULL::uuid,
      NULL::uuid,
      NULL::text,
      NULL::text,
      NULL::integer[];
    RETURN;
  END IF;

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
    IF v_sched_ok AND NOT v_holiday AND v_current_mins > v_deadline THEN
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
    v_radius := COALESCE(v_off.radius_meters::numeric, 100::numeric);
    v_loc_ok := v_dist <= v_radius;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(v_radius, 0::numeric),
    (v_loc_ok AND v_sched_ok AND NOT v_holiday AND v_dup_ok AND v_face_ok),
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
    v_sched.working_days;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_attendance_comprehensive(uuid, uuid, double precision, double precision, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_attendance_comprehensive(uuid, uuid, double precision, double precision, text)
  TO authenticated;

-- record_attendance_with_timezone: resolver + shift audit columns
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
      'start_time', v_sched.start_time
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
