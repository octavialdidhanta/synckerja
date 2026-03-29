-- Remaining unindexed FKs after 20260430270000 (Splinter 0001: leading column must match FK).
-- Advisor flags: leave_requests.approved_by, motivation_likes.employee_id, okr_cycles.created_by,
-- task_steps (created_by, social_media_plan_id), assignment tables org/employee/assigner, duedate.organization_id,
-- task_steps_to_steps (organization_id, created_by), task_steps_to_steps_assigned (org, employee, assigned_by).
--
-- Do NOT drop idx_user_organizations_organization_id / idx_user_roles_* / idx_activities_user_id for "unused index"
-- INFO: removing those brings back unindexed_foreign_keys on the same columns (see 20260430180000 comments).

CREATE INDEX IF NOT EXISTS idx_leave_requests_approved_by
  ON public.leave_requests (approved_by);

CREATE INDEX IF NOT EXISTS idx_motivation_likes_employee_id
  ON public.motivation_likes (employee_id);

CREATE INDEX IF NOT EXISTS idx_okr_cycles_created_by
  ON public.okr_cycles (created_by);

CREATE INDEX IF NOT EXISTS idx_task_steps_created_by
  ON public.task_steps (created_by);
CREATE INDEX IF NOT EXISTS idx_task_steps_social_media_plan_id
  ON public.task_steps (social_media_plan_id);

CREATE INDEX IF NOT EXISTS idx_task_steps_assigned_organization_id
  ON public.task_steps_assigned (organization_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_assigned_employee_id
  ON public.task_steps_assigned (employee_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_assigned_assigned_by
  ON public.task_steps_assigned (assigned_by);

CREATE INDEX IF NOT EXISTS idx_task_steps_assigned_duedate_organization_id
  ON public.task_steps_assigned_duedate (organization_id);

CREATE INDEX IF NOT EXISTS idx_task_steps_to_steps_organization_id
  ON public.task_steps_to_steps (organization_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_to_steps_created_by
  ON public.task_steps_to_steps (created_by);

CREATE INDEX IF NOT EXISTS idx_task_steps_to_steps_assigned_organization_id
  ON public.task_steps_to_steps_assigned (organization_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_to_steps_assigned_employee_id
  ON public.task_steps_to_steps_assigned (employee_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_to_steps_assigned_assigned_by
  ON public.task_steps_to_steps_assigned (assigned_by);
