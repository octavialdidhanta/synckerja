-- Shift resolver: single source of truth for effective schedule (shift-first, WSS fallback).
-- Adds audit columns on attendance_records, overlap guard on employee_shifts, DOW helpers.

-- ---------------------------------------------------------------------------
-- employees.work_schedule_id (referenced by reminder queue / resolver chain)
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS work_schedule_id uuid NULL
  REFERENCES public.work_schedule_settings (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_work_schedule_id
  ON public.employees (work_schedule_id)
  WHERE work_schedule_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- attendance_records: shift audit columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS shift_id uuid NULL
    REFERENCES public.shifts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_shift_id uuid NULL
    REFERENCES public.employee_shifts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_records_shift_id
  ON public.attendance_records (shift_id)
  WHERE shift_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_shift_id
  ON public.attendance_records (employee_shift_id)
  WHERE employee_shift_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- DOW helpers: app convention 1=Monday … 7=Sunday
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pg_dow_to_app_dow(p_pg_dow integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_pg_dow = 0 THEN 7 ELSE p_pg_dow END;
$$;

CREATE OR REPLACE FUNCTION public.is_app_working_day(
  p_working_days integer[],
  p_date date
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_working_days IS NOT NULL
     AND public.pg_dow_to_app_dow(EXTRACT(DOW FROM p_date)::integer) = ANY (p_working_days);
$$;

-- ---------------------------------------------------------------------------
-- employee_shifts: date sanity + overlap guard
-- ---------------------------------------------------------------------------
ALTER TABLE public.employee_shifts
  DROP CONSTRAINT IF EXISTS employee_shifts_effective_date_order;

ALTER TABLE public.employee_shifts
  ADD CONSTRAINT employee_shifts_effective_date_order
  CHECK (effective_to_date IS NULL OR effective_to_date >= effective_from_date);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_active_lookup
  ON public.employee_shifts (employee_id, organization_id, effective_from_date DESC)
  WHERE is_active IS TRUE;

CREATE OR REPLACE FUNCTION public.enforce_employee_shift_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.is_active, true) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.employee_shifts es
    WHERE es.employee_id = NEW.employee_id
      AND es.organization_id = NEW.organization_id
      AND COALESCE(es.is_active, true) IS TRUE
      AND es.id IS DISTINCT FROM NEW.id
      AND daterange(
            es.effective_from_date,
            COALESCE(es.effective_to_date, 'infinity'::date),
            '[]'
          ) && daterange(
            NEW.effective_from_date,
            COALESCE(NEW.effective_to_date, 'infinity'::date),
            '[]'
          )
  ) THEN
    RAISE EXCEPTION 'Employee shift assignment overlaps with an existing active assignment'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_shifts_no_overlap ON public.employee_shifts;
CREATE TRIGGER employee_shifts_no_overlap
  BEFORE INSERT OR UPDATE ON public.employee_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_employee_shift_no_overlap();

-- ---------------------------------------------------------------------------
-- resolve_effective_schedule(employee, org, date)
-- Precedence: active employee_shifts → employee WSS → org default WSS
-- working_days + timezone always from resolved WSS; times from shift when assigned
-- ---------------------------------------------------------------------------
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

  SELECT es.id, es.shift_id, s.name, s.start_time, s.end_time, s.late_tolerance_minutes
  INTO v_es_id, v_shift_id, v_shift_name, v_shift_start, v_shift_end, v_shift_late_tol
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
    COALESCE(v_wss.timezone, 'Asia/Jakarta'),
    v_working_days,
    v_is_working;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_effective_schedule(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_effective_schedule(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_effective_schedule(uuid, uuid, date) TO service_role;
