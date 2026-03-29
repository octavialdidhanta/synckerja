      WHERE dt.id = task_steps.task_id
        AND dt.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.daily_tasks dt
      WHERE dt.id = task_steps.task_id
        AND dt.organization_id IN (SELECT public.user_organization_ids())
    )
  );

ALTER TABLE public.task_steps_to_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_steps_to_steps_org" ON public.task_steps_to_steps;
CREATE POLICY "task_steps_to_steps_org"
  ON public.task_steps_to_steps FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.daily_tasks_assigned ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_tasks_assigned_org" ON public.daily_tasks_assigned;
CREATE POLICY "daily_tasks_assigned_org"
  ON public.daily_tasks_assigned FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.task_steps_assigned ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_steps_assigned_org" ON public.task_steps_assigned;
CREATE POLICY "task_steps_assigned_org"
  ON public.task_steps_assigned FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.task_steps_to_steps_assigned ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_steps_to_steps_assigned_org" ON public.task_steps_to_steps_assigned;
CREATE POLICY "task_steps_to_steps_assigned_org"
  ON public.task_steps_to_steps_assigned FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.task_steps_assigned_duedate ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_steps_assigned_duedate_org" ON public.task_steps_assigned_duedate;
CREATE POLICY "task_steps_assigned_duedate_org"
  ON public.task_steps_assigned_duedate FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.task_step_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_step_history_org" ON public.task_step_history;
CREATE POLICY "task_step_history_org"
  ON public.task_step_history FOR ALL TO authenticated
  USING (
    (
      task_step_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.task_steps ts
        JOIN public.daily_tasks dt ON dt.id = ts.task_id
        WHERE ts.id = task_step_history.task_step_id
          AND dt.organization_id IN (SELECT public.user_organization_ids())
      )
    )
    OR (
      task_steps_to_steps_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.task_steps_to_steps s
        JOIN public.task_steps ts ON ts.id = s.parent_step_id
        JOIN public.daily_tasks dt ON dt.id = ts.task_id
        WHERE s.id = task_step_history.task_steps_to_steps_id
          AND dt.organization_id IN (SELECT public.user_organization_ids())
      )
    )
  )
  WITH CHECK (
    (
      task_step_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.task_steps ts
        JOIN public.daily_tasks dt ON dt.id = ts.task_id
        WHERE ts.id = task_step_history.task_step_id
          AND dt.organization_id IN (SELECT public.user_organization_ids())
      )
    )
    OR (
      task_steps_to_steps_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.task_steps_to_steps s
        JOIN public.task_steps ts ON ts.id = s.parent_step_id
        JOIN public.daily_tasks dt ON dt.id = ts.task_id
        WHERE s.id = task_step_history.task_steps_to_steps_id
          AND dt.organization_id IN (SELECT public.user_organization_ids())
      )
    )
  );

ALTER TABLE public.task_step_history_blocker_resolved ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_step_history_blocker_resolved_org" ON public.task_step_history_blocker_resolved;
CREATE POLICY "task_step_history_blocker_resolved_org"
  ON public.task_step_history_blocker_resolved FOR ALL TO authenticated
  USING (
    public._task_step_history_org_id(task_step_history_id) IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    public._task_step_history_org_id(task_step_history_id) IN (SELECT public.user_organization_ids())
  );

ALTER TABLE public.completion_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "completion_approvals_org" ON public.completion_approvals;
CREATE POLICY "completion_approvals_org"
  ON public.completion_approvals FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.task_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_files_org" ON public.task_files;
CREATE POLICY "task_files_org"
  ON public.task_files FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.task_steps ts
      JOIN public.daily_tasks dt ON dt.id = ts.task_id
      WHERE ts.id = task_files.task_steps_id
        AND dt.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.task_steps ts
      JOIN public.daily_tasks dt ON dt.id = ts.task_id
      WHERE ts.id = task_files.task_steps_id
        AND dt.organization_id IN (SELECT public.user_organization_ids())
    )
  );
