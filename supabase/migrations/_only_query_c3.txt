
-- ---------------------------------------------------------------------------
-- Helper: org for a task_step_history row (SECURITY DEFINER for RPCs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._task_step_history_org_id(p_history_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dt.organization_id
  FROM public.task_step_history h
  LEFT JOIN public.task_steps ts ON ts.id = h.task_step_id
  LEFT JOIN public.task_steps_to_steps s ON s.id = h.task_steps_to_steps_id
  LEFT JOIN public.task_steps ts2 ON ts2.id = s.parent_step_id
  LEFT JOIN public.daily_tasks dt ON dt.id = COALESCE(ts.task_id, ts2.task_id)
  WHERE h.id = p_history_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._task_step_history_org_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._task_step_history_org_id(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Blocker RPCs (used by BlockerResolutionModal / BlockerDetailsModal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_blocker_resolution(
  p_task_step_history_id uuid,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'description required';
  END IF;

  v_org := public._task_step_history_org_id(p_task_step_history_id);
  IF v_org IS NULL OR NOT (v_org IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.task_step_history_blocker_resolved (task_step_history_id, description, created_by)
  VALUES (p_task_step_history_id, btrim(p_description), auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.save_blocker_resolution(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_blocker_resolution(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_blocker_resolutions(p_task_step_history_ids uuid[])
RETURNS TABLE (
  id uuid,
  task_step_history_id uuid,
  description text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.task_step_history_id, r.description, r.created_at
  FROM public.task_step_history_blocker_resolved r
  WHERE r.task_step_history_id = ANY(p_task_step_history_ids)
    AND public._task_step_history_org_id(r.task_step_history_id) IN (SELECT public.user_organization_ids());
$$;

REVOKE ALL ON FUNCTION public.get_blocker_resolutions(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_blocker_resolutions(uuid[]) TO authenticated;

-- Reference-aligned counts (synckerja-reference fix_task_files migration)
CREATE OR REPLACE FUNCTION public.get_unresolved_blocker_counts(task_ids uuid[])
RETURNS TABLE(task_id uuid, blocker_count integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH input_tasks AS (
    SELECT unnest(task_ids) AS task_id
    LIMIT 100
  ),
  step_blockers AS (
    SELECT
      it.task_id,
      COUNT(*)::integer AS blocker_count
    FROM input_tasks it
    INNER JOIN public.task_steps ts ON ts.task_id = it.task_id
    INNER JOIN public.task_step_history h ON h.task_step_id = ts.id
    WHERE h.action_type = 'blocker_added'
      AND COALESCE(h.is_resolved, false) = false
    GROUP BY it.task_id
  ),
  sub_blockers AS (
    SELECT
      it.task_id,
      COUNT(*)::integer AS blocker_count
    FROM input_tasks it
    INNER JOIN public.task_steps ts ON ts.task_id = it.task_id
    INNER JOIN public.task_steps_to_steps s ON s.parent_step_id = ts.id
    INNER JOIN public.task_step_history h ON h.task_steps_to_steps_id = s.id
    WHERE h.action_type = 'blocker_added'
      AND COALESCE(h.is_resolved, false) = false
    GROUP BY it.task_id
  )
  SELECT
    it.task_id,
    COALESCE(sb.blocker_count, 0) + COALESCE(ss.blocker_count, 0) AS blocker_count
  FROM input_tasks it
  LEFT JOIN step_blockers sb ON sb.task_id = it.task_id
  LEFT JOIN sub_blockers ss ON ss.task_id = it.task_id;
$$;

REVOKE ALL ON FUNCTION public.get_unresolved_blocker_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unresolved_blocker_counts(uuid[]) TO authenticated;