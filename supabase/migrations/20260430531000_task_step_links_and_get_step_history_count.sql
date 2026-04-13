-- Daily Task: external links on task steps + RPC for history badge count (app: TaskStep.tsx, StepLinks.tsx).

CREATE TABLE IF NOT EXISTS public.task_step_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_step_id uuid NOT NULL REFERENCES public.task_steps (id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  description text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_auto_synced boolean NOT NULL DEFAULT false,
  source_social_media_plan_id uuid NULL REFERENCES public.social_media_plans (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_task_step_links_step ON public.task_step_links (task_step_id);
CREATE INDEX IF NOT EXISTS idx_task_step_links_source_plan
  ON public.task_step_links (source_social_media_plan_id)
  WHERE source_social_media_plan_id IS NOT NULL;

ALTER TABLE public.task_step_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_step_links_org" ON public.task_step_links;
CREATE POLICY "task_step_links_org"
  ON public.task_step_links FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.task_steps ts
      JOIN public.daily_tasks dt ON dt.id = ts.task_id
      WHERE ts.id = task_step_links.task_step_id
        AND dt.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.task_steps ts
      JOIN public.daily_tasks dt ON dt.id = ts.task_id
      WHERE ts.id = task_step_links.task_step_id
        AND dt.organization_id IN (SELECT public.user_organization_ids())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_step_links TO authenticated;

CREATE OR REPLACE FUNCTION public.get_step_history_count(p_task_step_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.task_step_history h
  WHERE h.task_step_id = p_task_step_id;
$$;

REVOKE ALL ON FUNCTION public.get_step_history_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_step_history_count(uuid) TO authenticated;

COMMENT ON TABLE public.task_step_links IS 'User or auto-synced URLs attached to a daily task step.';
COMMENT ON FUNCTION public.get_step_history_count(uuid) IS 'Count of task_step_history rows for a step; honors RLS on task_step_history.';
