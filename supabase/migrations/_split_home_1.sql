

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