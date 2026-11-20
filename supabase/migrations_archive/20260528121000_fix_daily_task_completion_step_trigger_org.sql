-- Fix: task_steps table has no organization_id column.
-- Completion trigger must resolve organization_id from daily_tasks via task_steps.task_id.

CREATE OR REPLACE FUNCTION public.trg_task_step_completed_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignee_emp uuid;
  assigner_emp uuid;
  assignee_user uuid;
  assigner_user uuid;
  task_id uuid;
  org_id uuid;
  title text;
  approval_id uuid;
  requires_approval boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF COALESCE(OLD.is_completed,false) = true OR COALESCE(NEW.is_completed,false) <> true THEN
    RETURN NEW;
  END IF;

  task_id := NEW.task_id;
  SELECT dt.organization_id INTO org_id
  FROM public.daily_tasks dt
  WHERE dt.id = task_id
  LIMIT 1;

  IF org_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.assignee_employee_id, a.assigner_employee_id INTO assignee_emp, assigner_emp
  FROM public.latest_step_assignment(NEW.id) a;
  assignee_user := public.employee_user_id(assignee_emp);
  assigner_user := public.employee_user_id(assigner_emp);
  IF assigner_user IS NULL THEN RETURN NEW; END IF;

  title := COALESCE(NULLIF(trim(NEW.title),''),'Task Step');
  approval_id := public.completion_pending_approval('step', task_id, NEW.id, NULL);
  requires_approval := approval_id IS NOT NULL;

  PERFORM public.insert_daily_task_completion_notification(
    assigner_user, org_id, 'completed', 'step',
    task_id, NEW.id, NULL,
    assignee_user, assigner_user,
    title, requires_approval, approval_id, NULL
  );

  RETURN NEW;
END;
$$;

