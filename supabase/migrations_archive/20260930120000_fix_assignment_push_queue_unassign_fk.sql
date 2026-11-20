-- Fix: CASCADE delete on task_steps fires task_steps_assigned DELETE trigger while the
-- parent step row is being removed. Inserting push_queue rows with task_step_id then
-- violates daily_task_assignment_push_queue_task_step_id_fkey.
-- For unassign events, omit entity FK columns (title/url/body still carry context).

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
  queue_daily_task_id uuid;
  queue_task_step_id uuid;
  queue_substep_id uuid;
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

  -- Avoid FK to entities mid-cascade-delete on unassign.
  IF p_event_type = 'unassign' THEN
    queue_daily_task_id := NULL;
    queue_task_step_id := NULL;
    queue_substep_id := NULL;
  ELSE
    queue_daily_task_id := p_daily_task_id;
    queue_task_step_id := p_task_step_id;
    queue_substep_id := p_task_steps_to_steps_id;
  END IF;

  INSERT INTO public.daily_task_notifications (
    user_id, organization_id, title, body,
    daily_task_id, task_step_id, task_steps_to_steps_id,
    read_at, created_at
  ) VALUES (
    p_recipient_user_id, p_organization_id, notif_title, notif_body,
    queue_daily_task_id, queue_task_step_id, queue_substep_id,
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
    queue_daily_task_id, queue_task_step_id, queue_substep_id,
    COALESCE(p_title, ''), p_due_date, p_assigned_by_user_id, COALESCE(p_url, '')
  );
END;
$$;
