-- Home dashboard: reference-aligned tables and RPCs used by src/1-home (OKR, motivations, training, status, profile details).
-- RLS: org-scoped via public.user_organization_ids() where applicable.

-- ---------------------------------------------------------------------------
-- Role in active org (used by greetings / unified profile)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role_in_active_org()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.role::text
  FROM public.profiles p
  JOIN public.user_roles ur
    ON ur.user_id = p.user_id
   AND ur.organization_id = p.active_organization_id
  WHERE p.user_id = auth.uid()
    AND p.active_organization_id IS NOT NULL
  ORDER BY CASE ur.role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    ELSE 3
  END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_role_in_active_org() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role_in_active_org() TO authenticated;

-- ---------------------------------------------------------------------------
-- Extended profile row (optional; code uses maybeSingle)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profile_details (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  phone text NULL,
  bio text NULL,
  job_title text NULL,
  location text NULL,
  website text NULL,
  profile_photo_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_details_profile_id_key UNIQUE (profile_id)
);

ALTER TABLE public.user_profile_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profile_details_own" ON public.user_profile_details;
CREATE POLICY "user_profile_details_own"
  ON public.user_profile_details FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Job positions (employees joins)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_positions_organization_id ON public.job_positions (organization_id);

ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_positions_org" ON public.job_positions;
CREATE POLICY "job_positions_org"
  ON public.job_positions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Employees: columns used by home
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS department_id uuid NULL REFERENCES public.departments (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_position_id uuid NULL REFERENCES public.job_positions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_photo_url text NULL;

-- ---------------------------------------------------------------------------
-- OKR core
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.okr_cycles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  year integer NOT NULL,
  quarter integer NULL,
  start_date date NULL,
  end_date date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_objectives (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.okr_cycles (id) ON DELETE CASCADE,
  title text NOT NULL,
  why_important text NULL,
  status text NOT NULL DEFAULT 'draft',
  progress_percentage numeric NOT NULL DEFAULT 0,
  weight numeric NOT NULL DEFAULT 1,
  start_date date NULL,
  end_date date NULL,
  owner_id uuid NOT NULL REFERENCES auth.users (id),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.department_objectives (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.okr_cycles (id) ON DELETE CASCADE,
  company_objective_id uuid NOT NULL REFERENCES public.company_objectives (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'draft',
  progress_percentage numeric NOT NULL DEFAULT 0,
  weight numeric NOT NULL DEFAULT 1,
  start_date date NULL,
  end_date date NULL,
  owner_id uuid NULL REFERENCES auth.users (id),
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.individual_objectives (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.okr_cycles (id) ON DELETE CASCADE,
  department_objective_id uuid NULL REFERENCES public.department_objectives (id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'draft',
  progress_percentage numeric NOT NULL DEFAULT 0,
  weight numeric NOT NULL DEFAULT 1,
  start_date date NULL,
  end_date date NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.key_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  target_value numeric NULL,
  current_value numeric NULL,
  unit text NULL,
  metric_type text NULL,
  progress_percentage numeric NOT NULL DEFAULT 0,
  weight numeric NOT NULL DEFAULT 1,
  company_objective_id uuid NULL REFERENCES public.company_objectives (id) ON DELETE CASCADE,
  department_objective_id uuid NULL REFERENCES public.department_objectives (id) ON DELETE CASCADE,
  individual_objective_id uuid NULL REFERENCES public.individual_objectives (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT key_results_one_parent CHECK (
    (company_objective_id IS NOT NULL)::int
    + (department_objective_id IS NOT NULL)::int
    + (individual_objective_id IS NOT NULL)::int = 1
  )
);

CREATE TABLE IF NOT EXISTS public.weekly_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  individual_objective_id uuid NULL REFERENCES public.individual_objectives (id) ON DELETE CASCADE,
  week_start date NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Motivations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.motivations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  content text NOT NULL,
  author_name text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.motivation_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  motivation_id uuid NOT NULL REFERENCES public.motivations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT motivation_likes_unique UNIQUE (motivation_id, employee_id)
);

-- ---------------------------------------------------------------------------
-- Employee “status” feed (SectionStatusKaryawan)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  status_text text NOT NULL,
  location text NOT NULL DEFAULT '',
  status_type text NOT NULL DEFAULT 'work',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 day')
);

-- ---------------------------------------------------------------------------
-- Training (minimal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  start_date timestamptz NULL,
  end_date timestamptz NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_program_id uuid NOT NULL REFERENCES public.training_programs (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'registered',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_participants_unique UNIQUE (training_program_id, employee_id)
);

-- ---------------------------------------------------------------------------
-- Attendance / leave / office (minimal columns for home hooks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  check_in_at timestamptz NULL,
  check_out_at timestamptz NULL,
  status text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  start_date date NULL,
  end_date date NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.office_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  latitude numeric NULL,
  longitude numeric NULL,
  radius_meters integer NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.key_result_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_result_id uuid NOT NULL REFERENCES public.key_results (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_schedule_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_face_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.allowed_ip_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  cidr text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_validations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_record_id uuid NOT NULL REFERENCES public.attendance_records (id) ON DELETE CASCADE,
  validation_type text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RPC: department objectives bundle (from reference)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_department_objectives_organization_id
  ON public.department_objectives (organization_id);

CREATE INDEX IF NOT EXISTS idx_department_objectives_organization_cycle_created
  ON public.department_objectives (organization_id, cycle_id, created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_key_results_department_objective_id
  ON public.key_results (department_objective_id)
  WHERE company_objective_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_department_objectives_with_key_results(
  p_organization_id uuid,
  p_cycle_ids uuid[] DEFAULT NULL,
  p_include_individual boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH depts AS (
    SELECT
      dbo.id,
      dbo.organization_id,
      dbo.cycle_id,
      dbo.company_objective_id,
      dbo.department_id,
      dbo.title,
      dbo.description,
      dbo.status,
      dbo.progress_percentage,
      dbo.weight,
      dbo.start_date,
      dbo.end_date,
      dbo.owner_id,
      dbo.created_by,
      dbo.created_at,
      dbo.updated_at,
      d.name AS dept_name,
      co.title AS co_title,
      oc.name AS oc_name,
      oc.year AS oc_year,
      oc.quarter AS oc_quarter
    FROM department_objectives dbo
    INNER JOIN departments d ON d.id = dbo.department_id
    INNER JOIN company_objectives co ON co.id = dbo.company_objective_id
    INNER JOIN okr_cycles oc ON oc.id = dbo.cycle_id
    WHERE dbo.organization_id = p_organization_id
      AND (
        p_cycle_ids IS NULL
        OR cardinality(p_cycle_ids) = 0
        OR dbo.cycle_id = ANY (p_cycle_ids)
      )
    ORDER BY dbo.created_at DESC
  ),
  krs AS (
    SELECT
      kr.department_objective_id,
      jsonb_agg(
        jsonb_build_object(
          'id', kr.id,
          'title', kr.title,
          'target_value', kr.target_value,
          'current_value', kr.current_value,
          'unit', kr.unit,
          'metric_type', kr.metric_type,
          'progress_percentage', kr.progress_percentage,
          'weight', kr.weight,
          'department_objective_id', kr.department_objective_id,
          'company_objective_id', kr.company_objective_id
        )
      ) FILTER (WHERE kr.id IS NOT NULL) AS key_results_json
    FROM key_results kr
    INNER JOIN depts dbo ON dbo.id = kr.department_objective_id
    WHERE kr.company_objective_id IS NULL
      AND trim(lower(COALESCE(kr.title, ''))) IS DISTINCT FROM trim(lower(COALESCE(dbo.title, '')))
    GROUP BY kr.department_objective_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'organization_id', d.organization_id,
      'cycle_id', d.cycle_id,
      'company_objective_id', d.company_objective_id,
      'department_id', d.department_id,
      'title', d.title,
      'description', d.description,
      'status', d.status,
      'progress_percentage', d.progress_percentage,
      'weight', d.weight,
      'start_date', d.start_date,
      'end_date', d.end_date,
      'owner_id', d.owner_id,
      'created_by', d.created_by,
      'created_at', d.created_at,
      'updated_at', d.updated_at,
      'departments', jsonb_build_object('name', d.dept_name),
      'company_objectives', jsonb_build_object('title', d.co_title),
      'okr_cycles', jsonb_build_object('name', d.oc_name, 'year', d.oc_year, 'quarter', d.oc_quarter),
      'key_results', (
        SELECT COALESCE(k.key_results_json, '[]'::jsonb)
        FROM krs k
        WHERE k.department_objective_id = d.id
      )
    )
  )
  INTO result
  FROM depts d;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_department_objectives_with_key_results(uuid, uuid[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_department_objectives_with_key_results(uuid, uuid[], boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Stub RPCs for attendance (extend in a later migration)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_attendance_comprehensive(
  p_employee_id uuid,
  p_organization_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('ok', true);
$$;

CREATE OR REPLACE FUNCTION public.record_attendance_with_timezone(
  p_employee_id uuid,
  p_organization_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('ok', true, 'id', gen_random_uuid());
$$;

REVOKE ALL ON FUNCTION public.validate_attendance_comprehensive(uuid, uuid, jsonb) FROM PUBLIC;
