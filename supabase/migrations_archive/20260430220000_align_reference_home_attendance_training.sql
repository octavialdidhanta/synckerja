-- Align DB with synckerja-reference expectations for src/1-home and attendance hooks.
-- Extends 20260430210000 minimal tables: column names and FKs used by PostgREST embeds.

-- ---------------------------------------------------------------------------
-- job_levels + employees.job_level_id (useCurrentEmployee embed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_levels_organization_id ON public.job_levels (organization_id);

ALTER TABLE public.job_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_levels_org" ON public.job_levels;
CREATE POLICY "job_levels_org"
  ON public.job_levels FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS job_level_id uuid NULL REFERENCES public.job_levels (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- attendance_records: reference columns (date + time fields)
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS attendance_date date NULL,
  ADD COLUMN IF NOT EXISTS check_in_time time without time zone NULL,
  ADD COLUMN IF NOT EXISTS check_out_time time without time zone NULL,
  ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_minutes integer NULL;

UPDATE public.attendance_records ar
SET
  attendance_date = COALESCE(
    ar.attendance_date,
    CASE WHEN ar.check_in_at IS NOT NULL THEN (ar.check_in_at AT TIME ZONE 'UTC')::date END,
    (ar.created_at AT TIME ZONE 'UTC')::date
  ),
  check_in_time = COALESCE(
    ar.check_in_time,
    CASE WHEN ar.check_in_at IS NOT NULL THEN (ar.check_in_at AT TIME ZONE 'UTC')::time END
  ),
  check_out_time = COALESCE(
    ar.check_out_time,
    CASE WHEN ar.check_out_at IS NOT NULL THEN (ar.check_out_at AT TIME ZONE 'UTC')::time END
  )
WHERE ar.attendance_date IS NULL
   OR (ar.check_in_at IS NOT NULL AND ar.check_in_time IS NULL)
   OR (ar.check_out_at IS NOT NULL AND ar.check_out_time IS NULL);

CREATE INDEX IF NOT EXISTS idx_attendance_records_org_employee_date
  ON public.attendance_records (organization_id, employee_id, attendance_date);

-- ---------------------------------------------------------------------------
-- training_programs: reference uses name, max_participants, category, trainer_name
-- ---------------------------------------------------------------------------
ALTER TABLE public.training_programs
  ADD COLUMN IF NOT EXISTS name text NULL,
  ADD COLUMN IF NOT EXISTS max_participants integer NULL,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS trainer_name text NULL;

UPDATE public.training_programs
SET name = COALESCE(NULLIF(btrim(name), ''), title, 'Training')
WHERE name IS NULL OR btrim(name) = '';

ALTER TABLE public.training_programs ALTER COLUMN name SET DEFAULT '';
ALTER TABLE public.training_programs ALTER COLUMN name SET NOT NULL;

-- ---------------------------------------------------------------------------
-- office_locations: is_active (useOptimizedOfficeLocations, officeLocationUtils)
-- ---------------------------------------------------------------------------
ALTER TABLE public.office_locations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- leave_requests: total_days (useEmployeeAttendanceStats)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS total_days numeric NULL;

-- ---------------------------------------------------------------------------
-- location_types + clients (useOptimizedAttendanceData prefetch from home)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.location_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  color text NULL,
  icon text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  company_name text NOT NULL,
  address text NULL,
  contact_person text NULL,
  contact_email text NULL,
  contact_phone text NULL,
  industry text NULL,
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.location_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "location_types_org_select" ON public.location_types;
CREATE POLICY "location_types_org_select"
  ON public.location_types FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "clients_org_all" ON public.clients;
CREATE POLICY "clients_org_all"
  ON public.clients FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
