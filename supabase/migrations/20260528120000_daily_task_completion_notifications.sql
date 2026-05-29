-- Daily Task completion notifications:
-- - On task/step/substep completion, notify assigner (bell + push queue)
-- - On completion rejection, notify assignee (bell + push queue)
-- - Push is batched by edge function via claim RPC

-- ---------------------------------------------------------------------------
-- Queue table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_task_completion_push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,

  event_type text NOT NULL CHECK (event_type IN ('completed','rejected')),
  entity_type text NOT NULL CHECK (entity_type IN ('task','step','substep')),

  daily_task_id uuid NULL REFERENCES public.daily_tasks (id) ON DELETE CASCADE,
  task_step_id uuid NULL REFERENCES public.task_steps (id) ON DELETE CASCADE,
  task_steps_to_steps_id uuid NULL REFERENCES public.task_steps_to_steps (id) ON DELETE CASCADE,

  assignee_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  assigner_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,

  title text NOT NULL DEFAULT '',
  requires_approval boolean NOT NULL DEFAULT false,
  completion_approval_id uuid NULL REFERENCES public.completion_approvals (id) ON DELETE SET NULL,
  reject_reason text NULL,

  url text NOT NULL DEFAULT '/tools/daily-task?view=jobdesc'
);

CREATE INDEX IF NOT EXISTS idx_dt_completion_push_queue_unsent_recipient
  ON public.daily_task_completion_push_queue (recipient_user_id, created_at DESC)
  WHERE sent_at IS NULL;

ALTER TABLE public.daily_task_completion_push_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_task_completion_push_queue_select_own" ON public.daily_task_completion_push_queue;
CREATE POLICY "daily_task_completion_push_queue_select_own"
  ON public.daily_task_completion_push_queue FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

COMMENT ON TABLE public.daily_task_completion_push_queue IS
  'Queue for batching Daily Task completion pushes to assigner/assignee.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.latest_task_assignment(p_daily_task_id uuid)
RETURNS TABLE (assignee_employee_id uuid, assigner_employee_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.employee_id, a.assigned_by
  FROM public.daily_tasks_assigned a
  WHERE a.daily_task_id = p_daily_task_id
  ORDER BY a.assigned_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.latest_step_assignment(p_task_step_id uuid)
RETURNS TABLE (assignee_employee_id uuid, assigner_employee_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.employee_id, a.assigned_by
  FROM public.task_steps_assigned a
  WHERE a.task_step_id = p_task_step_id
  ORDER BY a.assigned_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.latest_substep_assignment(p_task_steps_to_steps_id uuid)
RETURNS TABLE (assignee_employee_id uuid, assigner_employee_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.employee_id, COALESCE(a.assigned_by, a.employee_id)
  FROM public.task_steps_to_steps_assigned a
  WHERE a.task_steps_to_steps_id = p_task_steps_to_steps_id
  ORDER BY a.assigned_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.completion_pending_approval(
  p_entity_type text,
  p_daily_task_id uuid,
  p_task_step_id uuid,
  p_task_steps_to_steps_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ca.id
  FROM public.completion_approvals ca
  WHERE ca.status = 'pending'
    AND ca.entity_type = p_entity_type
    AND ca.daily_task_id = p_daily_task_id
    AND (p_task_step_id IS NULL OR ca.task_step_id = p_task_step_id)
    AND (p_task_steps_to_steps_id IS NULL OR ca.task_steps_to_steps_id = p_task_steps_to_steps_id)
  ORDER BY ca.completed_at DESC
  LIMIT 1
$$;

-- ---------------------------------------------------------------------------
-- Insert bell + queue rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_daily_task_completion_notification(
  p_recipient_user_id uuid,
  p_organization_id uuid,
  p_event_type text,
  p_entity_type text,
  p_daily_task_id uuid,
  p_task_step_id uuid,
  p_task_steps_to_steps_id uuid,
  p_assignee_user_id uuid,
  p_assigner_user_id uuid,
  p_title text,
  p_requires_approval boolean,
  p_completion_approval_id uuid,
  p_reject_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif_title text;
  notif_body text;
  assignee_name text;
  url text := '/tools/daily-task?view=jobdesc';
BEGIN
  assignee_name := COALESCE(
    (SELECT COALESCE(NULLIF(trim(e.full_name), ''), NULLIF(trim(e.email), ''), 'User')::text
     FROM public.employees e
     WHERE e.user_id = p_assignee_user_id
     LIMIT 1),
    'User'
  );

  IF p_event_type = 'completed' THEN
    notif_title := 'Daily Task selesai';
    notif_body := '[' || p_entity_type || '] ' || COALESCE(NULLIF(p_title,''),'Item') || ' • oleh ' || assignee_name;
    IF p_requires_approval THEN
      notif_body := notif_body || ' • butuh approval kamu';
    END IF;
  ELSE
    notif_title := 'Daily Task ditolak';
    notif_body := '[' || p_entity_type || '] ' || COALESCE(NULLIF(p_title,''),'Item') || ' • ditolak';
    IF p_reject_reason IS NOT NULL AND btrim(p_reject_reason) <> '' THEN
      notif_body := notif_body || ' • ' || btrim(p_reject_reason);
    END IF;
  END IF;

  INSERT INTO public.daily_task_notifications (
    user_id, organization_id, title, body,
    daily_task_id, task_step_id, task_steps_to_steps_id,
    read_at, created_at
  ) VALUES (
    p_recipient_user_id, p_organization_id, notif_title, notif_body,
    p_daily_task_id, p_task_step_id, p_task_steps_to_steps_id,
    NULL, now()
  );

  INSERT INTO public.daily_task_completion_push_queue (
    organization_id, recipient_user_id, created_at, sent_at,
    event_type, entity_type,
    daily_task_id, task_step_id, task_steps_to_steps_id,
    assignee_user_id, assigner_user_id,
    title, requires_approval, completion_approval_id, reject_reason, url
  ) VALUES (
    p_organization_id, p_recipient_user_id, now(), NULL,
    p_event_type, p_entity_type,
    p_daily_task_id, p_task_step_id, p_task_steps_to_steps_id,
    p_assignee_user_id, p_assigner_user_id,
    COALESCE(p_title,''), COALESCE(p_requires_approval,false), p_completion_approval_id, p_reject_reason, url
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: completion → notify assigner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_daily_task_completed_notify()
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
  title text;
  approval_id uuid;
  requires_approval boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF COALESCE(OLD.status,'') = 'completed' OR COALESCE(NEW.status,'') <> 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT a.assignee_employee_id, a.assigner_employee_id INTO assignee_emp, assigner_emp
  FROM public.latest_task_assignment(NEW.id) a;
  assignee_user := public.employee_user_id(assignee_emp);
  assigner_user := public.employee_user_id(assigner_emp);
  IF assigner_user IS NULL THEN RETURN NEW; END IF;

  title := COALESCE(NULLIF(trim(NEW.title),''),'Daily Task');
  approval_id := public.completion_pending_approval('task', NEW.id, NULL, NULL);
  requires_approval := approval_id IS NOT NULL;

  PERFORM public.insert_daily_task_completion_notification(
    assigner_user, NEW.organization_id, 'completed', 'task',
    NEW.id, NULL, NULL,
    assignee_user, assigner_user,
    title, requires_approval, approval_id, NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_tasks_completed_notify ON public.daily_tasks;
CREATE TRIGGER trg_daily_tasks_completed_notify
  AFTER UPDATE OF status ON public.daily_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_daily_task_completed_notify();

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
  title text;
  approval_id uuid;
  requires_approval boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF COALESCE(OLD.is_completed,false) = true OR COALESCE(NEW.is_completed,false) <> true THEN
    RETURN NEW;
  END IF;

  task_id := NEW.task_id;
  SELECT a.assignee_employee_id, a.assigner_employee_id INTO assignee_emp, assigner_emp
  FROM public.latest_step_assignment(NEW.id) a;
  assignee_user := public.employee_user_id(assignee_emp);
  assigner_user := public.employee_user_id(assigner_emp);
  IF assigner_user IS NULL THEN RETURN NEW; END IF;

  title := COALESCE(NULLIF(trim(NEW.title),''),'Task Step');
  approval_id := public.completion_pending_approval('step', task_id, NEW.id, NULL);
  requires_approval := approval_id IS NOT NULL;

  PERFORM public.insert_daily_task_completion_notification(
    assigner_user, NEW.organization_id, 'completed', 'step',
    task_id, NEW.id, NULL,
    assignee_user, assigner_user,
    title, requires_approval, approval_id, NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_steps_completed_notify ON public.task_steps;
CREATE TRIGGER trg_task_steps_completed_notify
  AFTER UPDATE OF is_completed ON public.task_steps
  FOR EACH ROW EXECUTE FUNCTION public.trg_task_step_completed_notify();

CREATE OR REPLACE FUNCTION public.trg_sub_step_completed_notify()
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
  step_id uuid;
  task_id uuid;
  title text;
  approval_id uuid;
  requires_approval boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF COALESCE(OLD.is_completed,false) = true OR COALESCE(NEW.is_completed,false) <> true THEN
    RETURN NEW;
  END IF;

  step_id := NEW.parent_step_id;
  SELECT ts.task_id INTO task_id FROM public.task_steps ts WHERE ts.id = step_id LIMIT 1;

  SELECT a.assignee_employee_id, a.assigner_employee_id INTO assignee_emp, assigner_emp
  FROM public.latest_substep_assignment(NEW.id) a;
  assignee_user := public.employee_user_id(assignee_emp);
  assigner_user := public.employee_user_id(assigner_emp);
  IF assigner_user IS NULL THEN RETURN NEW; END IF;

  title := COALESCE(NULLIF(trim(NEW.title),''),'Sub-step');
  approval_id := public.completion_pending_approval('substep', task_id, step_id, NEW.id);
  requires_approval := approval_id IS NOT NULL;

  PERFORM public.insert_daily_task_completion_notification(
    assigner_user, NEW.organization_id, 'completed', 'substep',
    task_id, step_id, NEW.id,
    assignee_user, assigner_user,
    title, requires_approval, approval_id, NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_steps_to_steps_completed_notify ON public.task_steps_to_steps;
CREATE TRIGGER trg_task_steps_to_steps_completed_notify
  AFTER UPDATE OF is_completed ON public.task_steps_to_steps
  FOR EACH ROW EXECUTE FUNCTION public.trg_sub_step_completed_notify();

-- ---------------------------------------------------------------------------
-- Trigger: rejection → notify assignee
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_completion_approval_rejected_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignee_user uuid;
  assigner_user uuid;
  title text;
  entity_title text;
  entity_type text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF COALESCE(OLD.status,'') <> 'pending' OR COALESCE(NEW.status,'') <> 'rejected' THEN
    RETURN NEW;
  END IF;

  entity_type := NEW.entity_type;
  assignee_user := public.employee_user_id(NEW.assignee_employee_id);
  assigner_user := public.employee_user_id(NEW.assigner_employee_id);
  IF assignee_user IS NULL THEN RETURN NEW; END IF;

  entity_title := public.resolve_daily_task_entity_title(
    entity_type,
    NEW.daily_task_id,
    NEW.task_step_id,
    NEW.task_steps_to_steps_id
  );
  title := entity_title;

  PERFORM public.insert_daily_task_completion_notification(
    assignee_user, NEW.organization_id, 'rejected', entity_type,
    NEW.daily_task_id, NEW.task_step_id, NEW.task_steps_to_steps_id,
    assignee_user, assigner_user,
    title, false, NEW.id, NEW.reject_reason
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_completion_approvals_rejected_notify ON public.completion_approvals;
CREATE TRIGGER trg_completion_approvals_rejected_notify
  AFTER UPDATE OF status ON public.completion_approvals
  FOR EACH ROW EXECUTE FUNCTION public.trg_completion_approval_rejected_notify();

-- ---------------------------------------------------------------------------
-- Claim RPC for edge function batching
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_task_completion_push_queue(
  p_recipient_user_id uuid,
  p_window_seconds integer DEFAULT 20,
  p_max integer DEFAULT 25
)
RETURNS SETOF public.daily_task_completion_push_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM public.daily_task_completion_push_queue q
    WHERE q.recipient_user_id = p_recipient_user_id
      AND q.sent_at IS NULL
      AND q.created_at >= now() - make_interval(secs => GREATEST(1, p_window_seconds))
    ORDER BY q.created_at DESC
    LIMIT GREATEST(1, p_max)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.daily_task_completion_push_queue q
    SET sent_at = now()
    FROM candidates c
    WHERE q.id = c.id
      AND q.sent_at IS NULL
    RETURNING q.*
  )
  SELECT * FROM claimed;
END;
$$;

