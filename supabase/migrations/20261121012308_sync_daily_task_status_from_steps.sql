-- Keep daily_tasks.status in sync with its steps / sub-steps, in the database.
--
-- Problem: the Daily Task list shows a status computed from step progress
-- (TaskListRow.tsx), but daily_tasks.status was only updated by some client paths.
-- Steps completed through MCP (mcp_set_task_step_completed), and tasks whose
-- has_substeps = false, kept their old status in the database, so MCP, the
-- task summary and reports read "pending" while the UI showed "completed".
--
-- Rule (same as getEffectiveProgressAndCount in src/8-2-DailyTask/utils/taskUtils.ts):
--   a step with sub-steps counts each sub-step; a step without sub-steps counts itself.
--   done = 0          -> pending
--   0 < done < total  -> in_progress
--   done = total      -> completed
-- Unchanged: cancelled tasks, and tasks with no steps (their status stays manual).

CREATE OR REPLACE FUNCTION public.recompute_daily_task_status(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current text;
  v_total integer;
  v_done integer;
  v_new text;
BEGIN
  IF p_task_id IS NULL THEN
    RETURN;
  END IF;

  SELECT task.status INTO v_current
  FROM public.daily_tasks task
  WHERE task.id = p_task_id;

  IF NOT FOUND OR COALESCE(v_current, '') = 'cancelled' THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN sub.total > 0 THEN sub.total ELSE 1 END), 0),
    COALESCE(SUM(CASE WHEN sub.total > 0 THEN sub.done
                      ELSE (COALESCE(step.is_completed, false))::int END), 0)
  INTO v_total, v_done
  FROM public.task_steps step
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS total,
      (COUNT(*) FILTER (WHERE COALESCE(s2.is_completed, false)))::int AS done
    FROM public.task_steps_to_steps s2
    WHERE s2.parent_step_id = step.id
  ) sub ON true
  WHERE step.task_id = p_task_id;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  v_new := CASE
    WHEN v_done >= v_total THEN 'completed'
    WHEN v_done = 0 THEN 'pending'
    ELSE 'in_progress'
  END;

  IF v_new IS DISTINCT FROM v_current THEN
    UPDATE public.daily_tasks task
    SET status = v_new
    WHERE task.id = p_task_id;
  END IF;
END;
$function$;

-- Internal helper: not callable through the API (PostgREST /rpc).
REVOKE ALL ON FUNCTION public.recompute_daily_task_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_daily_task_status(uuid) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_sync_daily_task_status_from_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_task uuid;
  v_old_task uuid;
BEGIN
  -- Set by daily_tasks_skip_touch_on_delete: the parent task is being deleted.
  IF current_setting('synckerja.skip_daily_task_touch', true) = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'task_steps' THEN
    IF TG_OP <> 'DELETE' THEN v_new_task := NEW.task_id; END IF;
    IF TG_OP <> 'INSERT' THEN v_old_task := OLD.task_id; END IF;
  ELSE
    IF TG_OP <> 'DELETE' THEN
      SELECT step.task_id INTO v_new_task FROM public.task_steps step WHERE step.id = NEW.parent_step_id;
    END IF;
    IF TG_OP <> 'INSERT' THEN
      SELECT step.task_id INTO v_old_task FROM public.task_steps step WHERE step.id = OLD.parent_step_id;
    END IF;
  END IF;

  PERFORM public.recompute_daily_task_status(v_new_task);
  IF v_old_task IS DISTINCT FROM v_new_task THEN
    PERFORM public.recompute_daily_task_status(v_old_task);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_sync_daily_task_status_from_steps() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_sync_daily_task_status_from_steps() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_task_steps_sync_task_status ON public.task_steps;
CREATE TRIGGER trg_task_steps_sync_task_status
  AFTER INSERT OR DELETE OR UPDATE OF is_completed, task_id ON public.task_steps
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_daily_task_status_from_steps();

DROP TRIGGER IF EXISTS trg_task_steps_to_steps_sync_task_status ON public.task_steps_to_steps;
CREATE TRIGGER trg_task_steps_to_steps_sync_task_status
  AFTER INSERT OR DELETE OR UPDATE OF is_completed, parent_step_id ON public.task_steps_to_steps
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_daily_task_status_from_steps();

-- One-time repair of tasks that are already out of sync.
DO $repair$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT step.task_id FROM public.task_steps step LOOP
    PERFORM public.recompute_daily_task_status(r.task_id);
  END LOOP;
END;
$repair$;
