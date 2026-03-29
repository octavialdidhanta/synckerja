-- Daily tasks + templates + completion approvals + blocker RPCs (aligned with synckerja-reference app usage).
-- Org scope: RLS via daily_tasks.organization_id and public.user_organization_ids().

-- ---------------------------------------------------------------------------
-- Social plans (minimal stub for task_steps.social_media_plan_id FK)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_media_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  production_approved boolean NOT NULL DEFAULT false,
  production_status text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_media_plans_org ON public.social_media_plans (organization_id);

ALTER TABLE public.social_media_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_media_plans_org_all" ON public.social_media_plans;
CREATE POLICY "social_media_plans_org_all"
  ON public.social_media_plans FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Daily templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_template (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  department_id uuid NULL REFERENCES public.departments (id) ON DELETE SET NULL,
  hari_h_date date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_template_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_template_id uuid NOT NULL REFERENCES public.daily_template (id) ON DELETE CASCADE,
  "order" integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text NULL,
  schedule_type text NULL,
  schedule_value integer NULL,
  step_priority integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_template_org ON public.daily_template (organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_template_steps_template ON public.daily_template_steps (daily_template_id);

ALTER TABLE public.daily_template ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_template_org_all" ON public.daily_template;
CREATE POLICY "daily_template_org_all"
  ON public.daily_template FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.daily_template_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_template_steps_org" ON public.daily_template_steps;
CREATE POLICY "daily_template_steps_org"
  ON public.daily_template_steps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_template dt
      WHERE dt.id = daily_template_steps.daily_template_id
        AND dt.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.daily_template dt
      WHERE dt.id = daily_template_steps.daily_template_id
        AND dt.organization_id IN (SELECT public.user_organization_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Tasks & steps
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  priority text NULL DEFAULT 'medium',
  due_date timestamptz NULL,
  finish_date timestamptz NULL,
  plan_date timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  objective_id uuid NULL,
  has_substeps boolean NOT NULL DEFAULT false,
  has_reminder boolean NOT NULL DEFAULT false,
  has_steps boolean NOT NULL DEFAULT false,
  daily_template_id uuid NULL REFERENCES public.daily_template (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_org_created ON public.daily_tasks (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.task_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.daily_tasks (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NULL,
  is_completed boolean NOT NULL DEFAULT false,
  "order" integer NOT NULL DEFAULT 1,
  status text NULL,
  priority text NULL,
  schedule_type text NULL,
  schedule_value integer NULL,
  step_priority integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  social_media_plan_id uuid NULL REFERENCES public.social_media_plans (id) ON DELETE SET NULL,
  is_concept_step boolean NOT NULL DEFAULT false,
  blocked_reason text NULL,
  blocked_at timestamptz NULL,
  started_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_task_steps_task_order ON public.task_steps (task_id, "order");

CREATE TABLE IF NOT EXISTS public.task_steps_to_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_step_id uuid NOT NULL REFERENCES public.task_steps (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  is_completed boolean NOT NULL DEFAULT false,
  "order" integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_task_steps_to_steps_parent ON public.task_steps_to_steps (parent_step_id);