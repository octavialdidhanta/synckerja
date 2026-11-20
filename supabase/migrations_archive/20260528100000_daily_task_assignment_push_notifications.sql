-- Daily Task assignment notifications (task/step/sub-step):
-- - Insert detailed in-app bell rows into `daily_task_notifications`
-- - Enqueue summary push rows into `daily_task_assignment_push_queue`
-- - Provide an atomic claim RPC for edge function batching

-- ---------------------------------------------------------------------------
-- Queue table (one row per recipient per event)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_task_assignment_push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,

  event_type text NOT NULL CHECK (event_type IN ('assign','unassign','reassign')),
  entity_type text NOT NULL CHECK (entity_type IN ('task','step','substep')),

  daily_task_id uuid NULL REFERENCES public.daily_tasks (id) ON DELETE CASCADE,
  task_step_id uuid NULL REFERENCES public.task_steps (id) ON DELETE CASCADE,
  task_steps_to_steps_id uuid NULL REFERENCES public.task_steps_to_steps (id) ON DELETE CASCADE,

  title text NOT NULL DEFAULT '',
  due_date timestamptz NULL,
  assigned_by_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,

  url text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_dta_push_queue_unsent_recipient
  ON public.daily_task_assignment_push_queue (recipient_user_id, created_at DESC)
  WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dta_push_queue_org_created
  ON public.daily_task_assignment_push_queue (organization_id, created_at DESC);

ALTER TABLE public.daily_task_assignment_push_queue ENABLE ROW LEVEL SECURITY;

-- Edge functions use service role and bypass RLS; optional read own for debugging.
DROP POLICY IF EXISTS "daily_task_assignment_push_queue_select_own" ON public.daily_task_assignment_push_queue;
CREATE POLICY "daily_task_assignment_push_queue_select_own"
  ON public.daily_task_assignment_push_queue FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

COMMENT ON TABLE public.daily_task_assignment_push_queue IS
  'Queue for batching Daily Task assignment pushes (one row per recipient).';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.employee_user_id(p_employee_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.user_id
  FROM public.employees e
  WHERE e.id = p_employee_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.employee_display_name(p_employee_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(trim(e.full_name), ''), NULLIF(trim(e.email), ''), 'User')::text
  FROM public.employees e
  WHERE e.id = p_employee_id
  LIMIT 1
$$;

-- Resolve due date from task_steps_assigned_duedate based on assignment record id + entity type.
CREATE OR REPLACE FUNCTION public.resolve_assignment_due_date(
  p_entity_type text,
  p_assignment_row_id uuid
)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.due_date
  FROM public.task_steps_assigned_duedate d
  WHERE (
    (p_entity_type = 'task' AND d.daily_tasks_assigned_id = p_assignment_row_id)
    OR (p_entity_type = 'step' AND d.task_steps_assigned_id = p_assignment_row_id)
    OR (p_entity_type = 'substep' AND d.task_steps_to_steps_assigned_id = p_assignment_row_id)
  )
  ORDER BY d.created_at DESC
  LIMIT 1
$$;

-- Entity titles
CREATE OR REPLACE FUNCTION public.resolve_daily_task_entity_title(
  p_entity_type text,
  p_daily_task_id uuid,
  p_task_step_id uuid,
  p_task_steps_to_steps_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
BEGIN
  IF p_entity_type = 'task' THEN
    SELECT COALESCE(NULLIF(trim(dt.title), ''), 'Daily Task') INTO t
    FROM public.daily_tasks dt
    WHERE dt.id = p_daily_task_id
    LIMIT 1;
    RETURN COALESCE(t, 'Daily Task');
  ELSIF p_entity_type = 'step' THEN
    SELECT COALESCE(NULLIF(trim(ts.title), ''), 'Task Step') INTO t
    FROM public.task_steps ts
    WHERE ts.id = p_task_step_id
    LIMIT 1;
    RETURN COALESCE(t, 'Task Step');
  ELSE
    SELECT COALESCE(NULLIF(trim(ss.title), ''), 'Sub-step') INTO t
    FROM public.task_steps_to_steps ss
    WHERE ss.id = p_task_steps_to_steps_id
    LIMIT 1;
    RETURN COALESCE(t, 'Sub-step');
  END IF;
END;
$$;

-- URL for deep link routing
CREATE OR REPLACE FUNCTION public.build_daily_task_deeplink(
  p_entity_type text,
  p_daily_task_id uuid,
  p_task_step_id uuid,
  p_task_steps_to_steps_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN p_entity_type = 'task' THEN '/tools/daily-task?task_id=' || p_daily_task_id::text
      WHEN p_entity_type = 'step' THEN '/tools/daily-task?task_step_id=' || p_task_step_id::text
      ELSE '/tools/daily-task?task_steps_to_steps_id=' || p_task_steps_to_steps_id::text
    END
$$;

-- Insert both in-app + queue rows for one recipient.
CREATE OR REPLACE FUNCTION public.insert_daily_task_assignment_notification(
  p_recipient_user_id uuid,
  p_organization_id uuid,
  p_event_type text,
  p_entity_type text,
  p_daily_task_id uuid,
  p_task_step_id uuid,
  p_task_steps_to_steps_id uuid,
  p_title text,
  p_due_date timestamptz,
  p_assigned_by_user_id uuid,
  p_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif_title text;
  notif_body text;
  actor_name text;
  due_txt text;
BEGIN
  actor_name := COALESCE(
    (SELECT COALESCE(NULLIF(trim(e.full_name), ''), NULLIF(trim(e.email), ''), 'User')::text
     FROM public.employees e
     WHERE e.user_id = p_assigned_by_user_id
     LIMIT 1),
    'User'
  );

  due_txt := CASE WHEN p_due_date IS NULL THEN '' ELSE to_char(p_due_date, 'YYYY-MM-DD') END;

  notif_title := CASE
    WHEN p_event_type = 'assign' THEN 'Daily Task assigned'
    WHEN p_event_type = 'unassign' THEN 'Daily Task unassigned'
    ELSE 'Daily Task reassigned'
  END;

  notif_body := '[' || p_entity_type || '] ' || COALESCE(NULLIF(p_title, ''), 'Item')
    || CASE WHEN due_txt <> '' THEN ' • Due ' || due_txt ELSE '' END
    || ' • by ' || actor_name;

  INSERT INTO public.daily_task_notifications (
    user_id, organization_id, title, body,
    daily_task_id, task_step_id, task_steps_to_steps_id,
    read_at, created_at
  ) VALUES (
    p_recipient_user_id, p_organization_id, notif_title, notif_body,
    p_daily_task_id, p_task_step_id, p_task_steps_to_steps_id,
    NULL, now()
  );

  INSERT INTO public.daily_task_assignment_push_queue (
    organization_id, recipient_user_id, created_at, sent_at,
    event_type, entity_type,
    daily_task_id, task_step_id, task_steps_to_steps_id,
    title, due_date, assigned_by_user_id, url
  ) VALUES (
    p_organization_id, p_recipient_user_id, now(), NULL,
    p_event_type, p_entity_type,
    p_daily_task_id, p_task_step_id, p_task_steps_to_steps_id,
    COALESCE(p_title, ''), p_due_date, p_assigned_by_user_id, COALESCE(p_url, '')
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: INSERT/DELETE on assignment tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_daily_task_assignment_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entity_type text := TG_ARGV[0];
  event_type text;
  org_id uuid;
  daily_task_id uuid;
  step_id uuid;
  sub_id uuid;
  assignment_row_id uuid;
  new_emp_id uuid;
  old_emp_id uuid;
  actor_emp_id uuid;
  actor_user_id uuid;
  recipient_user_id uuid;
  title text;
  due_date timestamptz;
  url text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    org_id := NEW.organization_id;
    assignment_row_id := NEW.id;
    new_emp_id := NEW.employee_id;
    actor_emp_id := NEW.assigned_by;
    event_type := 'assign';
  ELSIF TG_OP = 'DELETE' THEN
    org_id := OLD.organization_id;
    assignment_row_id := OLD.id;
    old_emp_id := OLD.employee_id;
    actor_emp_id := COALESCE(OLD.assigned_by, OLD.employee_id);
    event_type := 'unassign';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  actor_user_id := public.employee_user_id(actor_emp_id);

  IF entity_type = 'task' THEN
    daily_task_id := COALESCE(NEW.daily_task_id, OLD.daily_task_id);
    step_id := NULL;
    sub_id := NULL;
  ELSIF entity_type = 'step' THEN
    daily_task_id := NULL;
    step_id := COALESCE(NEW.task_step_id, OLD.task_step_id);
    sub_id := NULL;
  ELSE
    daily_task_id := NULL;
    step_id := NULL;
    sub_id := COALESCE(NEW.task_steps_to_steps_id, OLD.task_steps_to_steps_id);
  END IF;

  title := public.resolve_daily_task_entity_title(entity_type, daily_task_id, step_id, sub_id);
  due_date := public.resolve_assignment_due_date(entity_type, assignment_row_id);
  url := public.build_daily_task_deeplink(entity_type, daily_task_id, step_id, sub_id);

  -- Notify new assignee on INSERT
  IF TG_OP = 'INSERT' THEN
    recipient_user_id := public.employee_user_id(new_emp_id);
    IF recipient_user_id IS NOT NULL THEN
      -- Skip self-assign
      IF actor_user_id IS NULL OR actor_user_id <> recipient_user_id THEN
        PERFORM public.insert_daily_task_assignment_notification(
          recipient_user_id, org_id, event_type, entity_type,
          daily_task_id, step_id, sub_id,
          title, due_date, actor_user_id, url
        );
      END IF;
    END IF;
  END IF;

  -- Notify old assignee on DELETE (reassign/unassign signal)
  IF TG_OP = 'DELETE' THEN
    recipient_user_id := public.employee_user_id(old_emp_id);
    IF recipient_user_id IS NOT NULL THEN
      PERFORM public.insert_daily_task_assignment_notification(
        recipient_user_id, org_id, event_type, entity_type,
        daily_task_id, step_id, sub_id,
        title, due_date, actor_user_id, url
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_tasks_assigned_notify ON public.daily_tasks_assigned;
CREATE TRIGGER trg_daily_tasks_assigned_notify
  AFTER INSERT OR DELETE ON public.daily_tasks_assigned
  FOR EACH ROW EXECUTE FUNCTION public.trg_daily_task_assignment_notify('task');

DROP TRIGGER IF EXISTS trg_task_steps_assigned_notify ON public.task_steps_assigned;
CREATE TRIGGER trg_task_steps_assigned_notify
  AFTER INSERT OR DELETE ON public.task_steps_assigned
  FOR EACH ROW EXECUTE FUNCTION public.trg_daily_task_assignment_notify('step');

DROP TRIGGER IF EXISTS trg_task_steps_to_steps_assigned_notify ON public.task_steps_to_steps_assigned;
CREATE TRIGGER trg_task_steps_to_steps_assigned_notify
  AFTER INSERT OR DELETE ON public.task_steps_to_steps_assigned
  FOR EACH ROW EXECUTE FUNCTION public.trg_daily_task_assignment_notify('substep');

-- ---------------------------------------------------------------------------
-- Claim RPC: atomically claim unsent rows for batching
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_task_assignment_push_queue(
  p_recipient_user_id uuid,
  p_window_seconds integer DEFAULT 20,
  p_max integer DEFAULT 25
)
RETURNS SETOF public.daily_task_assignment_push_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM public.daily_task_assignment_push_queue q
    WHERE q.recipient_user_id = p_recipient_user_id
      AND q.sent_at IS NULL
      AND q.created_at >= now() - make_interval(secs => GREATEST(1, p_window_seconds))
    ORDER BY q.created_at DESC
    LIMIT GREATEST(1, p_max)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.daily_task_assignment_push_queue q
    SET sent_at = now()
    FROM candidates c
    WHERE q.id = c.id
      AND q.sent_at IS NULL
    RETURNING q.*
  )
  SELECT * FROM claimed;
END;
$$;

