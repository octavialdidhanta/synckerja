

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