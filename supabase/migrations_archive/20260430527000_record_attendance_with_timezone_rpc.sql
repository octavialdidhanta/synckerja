-- Real RPC for useSimpleAttendance / synckerja-reference types (8 named args).
-- Replaces stub: record_attendance_with_timezone(uuid, uuid, jsonb) which PostgREST
-- does not match when the client sends employee_id_param, local_checkin_time, etc.

-- ---------------------------------------------------------------------------
-- attendance_records: columns used by home check-in + HR hooks
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS check_in_photo_path text,
  ADD COLUMN IF NOT EXISTS check_out_photo_path text,
  ADD COLUMN IF NOT EXISTS check_in_location jsonb,
  ADD COLUMN IF NOT EXISTS check_out_location jsonb,
  ADD COLUMN IF NOT EXISTS office_location_id uuid REFERENCES public.office_locations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS working_hours_minutes integer;

-- ---------------------------------------------------------------------------
-- attendance_validations: columns used by useSimpleAttendance inserts
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance_validations
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS validation_status text,
  ADD COLUMN IF NOT EXISTS validation_details jsonb;

-- ---------------------------------------------------------------------------
-- Drop stub (uuid, uuid, jsonb); create reference-aligned signature
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_attendance_with_timezone(uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.record_attendance_with_timezone(
  employee_id_param uuid,
  organization_id_param uuid,
  local_checkin_time text,
  latitude_param double precision,
  longitude_param double precision,
  timezone_param text DEFAULT 'Asia/Jakarta',
  photo_path_param text DEFAULT NULL,
  location_data jsonb DEFAULT '{}'::jsonb
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
  ws record;
  v_dow integer;
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
  INTO ws
  FROM public.work_schedule_settings wss
  WHERE wss.organization_id = organization_id_param
    AND COALESCE(wss.is_active, true)
  ORDER BY wss.is_default DESC NULLS LAST, wss.created_at ASC
  LIMIT 1;

  IF ws.id IS NOT NULL AND ws.working_days IS NOT NULL THEN
    v_dow := EXTRACT(DOW FROM v_local_ts)::integer;
    v_sched_ok := v_dow = ANY (ws.working_days);
    v_current_mins :=
      EXTRACT(HOUR FROM v_local_ts)::integer * 60
      + EXTRACT(MINUTE FROM v_local_ts)::integer;
    v_start_mins :=
      split_part(ws.start_time, ':', 1)::integer * 60
      + COALESCE(NULLIF(split_part(ws.start_time, ':', 2), ''), '0')::integer;
    IF v_start_mins IS NULL THEN
      v_start_mins := 9 * 60;
    END IF;
    v_deadline := v_start_mins + COALESCE(ws.late_tolerance_minutes, 0);
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
    is_late,
    late_minutes,
    status,
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
    v_late,
    v_late_mins,
    v_status,
    now()
  );

  RETURN jsonb_build_array(
    jsonb_build_object(
      'attendance_id', new_id,
      'is_late', v_late,
      'late_minutes', v_late_mins,
      'status', v_status
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_attendance_with_timezone(
  uuid, uuid, text, double precision, double precision, text, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_attendance_with_timezone(
  uuid, uuid, text, double precision, double precision, text, text, jsonb
) TO authenticated;
