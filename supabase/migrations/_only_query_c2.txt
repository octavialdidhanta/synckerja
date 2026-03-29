
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

-- ---------------------------------------------------------------------------
-- History & blocker resolutions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_step_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_step_id uuid NULL REFERENCES public.task_steps (id) ON DELETE CASCADE,
  task_steps_to_steps_id uuid NULL REFERENCES public.task_steps_to_steps (id) ON DELETE CASCADE,
  action_type text NOT NULL,
  old_value text NULL,
  new_value text NULL,
  description text NULL,
  blocker_type text NULL,
  blocker_severity text NULL,
  brief_type text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_resolved boolean NULL DEFAULT false,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE SET NULL,
  task_id uuid NULL REFERENCES public.daily_tasks (id) ON DELETE SET NULL,
  employee_id uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  CONSTRAINT task_step_history_one_target CHECK (
    (task_step_id IS NOT NULL) OR (task_steps_to_steps_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_task_step_history_step ON public.task_step_history (task_step_id);
CREATE INDEX IF NOT EXISTS idx_task_step_history_sub ON public.task_step_history (task_steps_to_steps_id);
CREATE INDEX IF NOT EXISTS idx_task_step_history_blocker_step
  ON public.task_step_history (task_step_id)
  WHERE action_type = 'blocker_added' AND COALESCE(is_resolved, false) = false;
CREATE INDEX IF NOT EXISTS idx_task_step_history_blocker_sub
  ON public.task_step_history (task_steps_to_steps_id)
  WHERE action_type = 'blocker_added' AND COALESCE(is_resolved, false) = false;

CREATE TABLE IF NOT EXISTS public.task_step_history_blocker_resolved (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_step_history_id uuid NOT NULL REFERENCES public.task_step_history (id) ON DELETE CASCADE,
  description text NOT NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocker_resolved_history ON public.task_step_history_blocker_resolved (task_step_history_id);

-- ---------------------------------------------------------------------------
-- Completion approvals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.completion_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('task', 'step', 'substep')),
  daily_task_id uuid NOT NULL REFERENCES public.daily_tasks (id) ON DELETE CASCADE,
  task_step_id uuid NULL REFERENCES public.task_steps (id) ON DELETE CASCADE,
  task_steps_to_steps_id uuid NULL REFERENCES public.task_steps_to_steps (id) ON DELETE CASCADE,
  assignee_employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  assigner_employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz NOT NULL DEFAULT now(),
  reject_reason text NULL,
  rejected_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_completion_approvals_org_assigner
  ON public.completion_approvals (organization_id, assigner_employee_id, status);

-- ---------------------------------------------------------------------------
-- Task files (column name task_steps_id matches app inserts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_steps_id uuid NOT NULL REFERENCES public.task_steps (id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_url text NOT NULL,
  file_size bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_files_step ON public.task_files (task_steps_id);