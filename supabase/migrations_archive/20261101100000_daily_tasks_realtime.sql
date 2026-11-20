-- Daily Task list refreshes from postgres changes on daily_tasks.
-- Child writes (steps, sub-steps, assignments, due dates) bump daily_tasks.updated_at
-- so one org-filtered subscription covers the whole task graph.
-- REPLICA IDENTITY FULL is required for Realtime filters on organization_id.

ALTER TABLE public.daily_tasks REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.daily_tasks_skip_touch_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Cascade deletes of steps/assignments must not UPDATE the task row being removed.
  PERFORM set_config('synckerja.skip_daily_task_touch', '1', true);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_tasks_skip_touch_on_delete ON public.daily_tasks;
CREATE TRIGGER trg_daily_tasks_skip_touch_on_delete
  BEFORE DELETE ON public.daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.daily_tasks_skip_touch_on_delete();

CREATE OR REPLACE FUNCTION public.touch_parent_daily_task()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
  v_step_id uuid;
  v_sub_id uuid;
  v_assign_id uuid;
BEGIN
  IF current_setting('synckerja.skip_daily_task_touch', true) = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'task_steps' THEN
    v_task_id := COALESCE(NEW.task_id, OLD.task_id);
  ELSIF TG_TABLE_NAME = 'task_steps_to_steps' THEN
    SELECT ts.task_id INTO v_task_id
    FROM public.task_steps ts
    WHERE ts.id = COALESCE(NEW.parent_step_id, OLD.parent_step_id);
  ELSIF TG_TABLE_NAME = 'daily_tasks_assigned' THEN
    v_task_id := COALESCE(NEW.daily_task_id, OLD.daily_task_id);
  ELSIF TG_TABLE_NAME = 'task_steps_assigned' THEN
    v_step_id := COALESCE(NEW.task_step_id, OLD.task_step_id);
    SELECT task_id INTO v_task_id FROM public.task_steps WHERE id = v_step_id;
  ELSIF TG_TABLE_NAME = 'task_steps_to_steps_assigned' THEN
    v_sub_id := COALESCE(NEW.task_steps_to_steps_id, OLD.task_steps_to_steps_id);
    SELECT ts.task_id INTO v_task_id
    FROM public.task_steps_to_steps sub
    JOIN public.task_steps ts ON ts.id = sub.parent_step_id
    WHERE sub.id = v_sub_id;
  ELSIF TG_TABLE_NAME = 'task_steps_assigned_duedate' THEN
    v_assign_id := COALESCE(NEW.daily_tasks_assigned_id, OLD.daily_tasks_assigned_id);
    IF v_assign_id IS NOT NULL THEN
      SELECT daily_task_id INTO v_task_id
      FROM public.daily_tasks_assigned
      WHERE id = v_assign_id;
    ELSE
      v_assign_id := COALESCE(NEW.task_steps_assigned_id, OLD.task_steps_assigned_id);
      IF v_assign_id IS NOT NULL THEN
        SELECT ts.task_id INTO v_task_id
        FROM public.task_steps_assigned a
        JOIN public.task_steps ts ON ts.id = a.task_step_id
        WHERE a.id = v_assign_id;
      ELSE
        v_assign_id := COALESCE(NEW.task_steps_to_steps_assigned_id, OLD.task_steps_to_steps_assigned_id);
        SELECT ts.task_id INTO v_task_id
        FROM public.task_steps_to_steps_assigned a
        JOIN public.task_steps_to_steps sub ON sub.id = a.task_steps_to_steps_id
        JOIN public.task_steps ts ON ts.id = sub.parent_step_id
        WHERE a.id = v_assign_id;
      END IF;
    END IF;
  END IF;

  IF v_task_id IS NOT NULL THEN
    UPDATE public.daily_tasks
    SET updated_at = clock_timestamp()
    WHERE id = v_task_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_task_steps_touch_daily_task ON public.task_steps;
CREATE TRIGGER trg_task_steps_touch_daily_task
  AFTER INSERT OR UPDATE OR DELETE ON public.task_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_daily_task();

DROP TRIGGER IF EXISTS trg_task_steps_to_steps_touch_daily_task ON public.task_steps_to_steps;
CREATE TRIGGER trg_task_steps_to_steps_touch_daily_task
  AFTER INSERT OR UPDATE OR DELETE ON public.task_steps_to_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_daily_task();

DROP TRIGGER IF EXISTS trg_daily_tasks_assigned_touch_daily_task ON public.daily_tasks_assigned;
CREATE TRIGGER trg_daily_tasks_assigned_touch_daily_task
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_tasks_assigned
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_daily_task();

DROP TRIGGER IF EXISTS trg_task_steps_assigned_touch_daily_task ON public.task_steps_assigned;
CREATE TRIGGER trg_task_steps_assigned_touch_daily_task
  AFTER INSERT OR UPDATE OR DELETE ON public.task_steps_assigned
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_daily_task();

DROP TRIGGER IF EXISTS trg_task_substeps_assigned_touch_daily_task ON public.task_steps_to_steps_assigned;
CREATE TRIGGER trg_task_substeps_assigned_touch_daily_task
  AFTER INSERT OR UPDATE OR DELETE ON public.task_steps_to_steps_assigned
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_daily_task();

DROP TRIGGER IF EXISTS trg_task_due_touch_daily_task ON public.task_steps_assigned_duedate;
CREATE TRIGGER trg_task_due_touch_daily_task
  AFTER INSERT OR UPDATE OR DELETE ON public.task_steps_assigned_duedate
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_parent_daily_task();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'daily_tasks'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_tasks;
  END IF;
END $$;
