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