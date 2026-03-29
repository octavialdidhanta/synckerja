
-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_tasks_assigned (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  daily_task_id uuid NOT NULL REFERENCES public.daily_tasks (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  department_id uuid NULL REFERENCES public.departments (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_assigned_task ON public.daily_tasks_assigned (daily_task_id);

CREATE TABLE IF NOT EXISTS public.task_steps_assigned (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  task_step_id uuid NOT NULL REFERENCES public.task_steps (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_steps_assigned_step ON public.task_steps_assigned (task_step_id);

CREATE TABLE IF NOT EXISTS public.task_steps_to_steps_assigned (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  task_steps_to_steps_id uuid NOT NULL REFERENCES public.task_steps_to_steps (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  assigned_by uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tstsa_substep ON public.task_steps_to_steps_assigned (task_steps_to_steps_id);

CREATE TABLE IF NOT EXISTS public.task_steps_assigned_duedate (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  daily_tasks_assigned_id uuid NULL REFERENCES public.daily_tasks_assigned (id) ON DELETE CASCADE,
  task_steps_assigned_id uuid NULL REFERENCES public.task_steps_assigned (id) ON DELETE CASCADE,
  task_steps_to_steps_assigned_id uuid NULL REFERENCES public.task_steps_to_steps_assigned (id) ON DELETE CASCADE,
  due_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsad_daily_assign ON public.task_steps_assigned_duedate (daily_tasks_assigned_id);
CREATE INDEX IF NOT EXISTS idx_tsad_step_assign ON public.task_steps_assigned_duedate (task_steps_assigned_id);
CREATE INDEX IF NOT EXISTS idx_tsad_sub_assign ON public.task_steps_assigned_duedate (task_steps_to_steps_assigned_id);

