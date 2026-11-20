-- Create one unfinished sub-step under an existing step.
-- Matches the office insert: parent step, organization, title, order, creator.
-- A new unfinished sub-step reopens a completed parent step, the same way the step dialog does.

CREATE OR REPLACE FUNCTION public.mcp_create_task_substep(
  p_user_id uuid,
  p_organization_id uuid,
  p_step_id uuid,
  p_title text
)
RETURNS TABLE (
  id uuid,
  step_id uuid,
  title text,
  substep_order integer,
  is_completed boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_title text;
  v_order integer;
  v_id uuid;
  v_done boolean;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_step_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT emp.id INTO v_self
  FROM public.employees emp
  WHERE emp.user_id = p_user_id
    AND emp.organization_id = p_organization_id
  ORDER BY emp.id ASC
  LIMIT 1;
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_title := btrim(COALESCE(p_title, ''));
  IF char_length(v_title) < 1 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.task_steps step
    JOIN public.daily_tasks task ON task.id = step.task_id
    WHERE step.id = p_step_id
      AND task.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(MAX(sub."order"), 0) + 1 INTO v_order
  FROM public.task_steps_to_steps sub
  WHERE sub.parent_step_id = p_step_id;

  INSERT INTO public.task_steps_to_steps (
    parent_step_id,
    organization_id,
    title,
    is_completed,
    "order",
    created_by
  )
  VALUES (p_step_id, p_organization_id, v_title, false, v_order, p_user_id)
  RETURNING
    task_steps_to_steps.id,
    task_steps_to_steps.title,
    task_steps_to_steps."order",
    task_steps_to_steps.is_completed
  INTO v_id, v_title, v_order, v_done;

  UPDATE public.task_steps step
  SET
    is_completed = false,
    completed_at = NULL,
    updated_at = now()
  WHERE step.id = p_step_id
    AND step.is_completed = true;

  id := v_id;
  step_id := p_step_id;
  title := v_title;
  substep_order := v_order;
  is_completed := v_done;
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_create_task_substep(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_task_substep(uuid, uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_task_substep(uuid, uuid, uuid, text) TO service_role;
