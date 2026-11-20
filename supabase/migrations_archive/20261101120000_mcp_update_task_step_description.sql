-- Let a step update change the description without touching completion, assignee, or order.
-- p_description defaults to null so a title-only call leaves the saved description unchanged.
-- Null omits the change. A blank string clears the description.

DROP FUNCTION IF EXISTS public.mcp_update_task_step(uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.mcp_update_task_step(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_title text,
  p_description text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  step_order integer,
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
  v_description text;
  v_change_description boolean := false;
  v_id uuid;
  v_order integer;
  v_done boolean;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_title := btrim(COALESCE(p_title, ''));
  IF char_length(v_title) < 1 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_description IS NOT NULL THEN
    IF char_length(btrim(p_description)) > 2000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_description := NULLIF(btrim(p_description), '');
    v_change_description := true;
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

  UPDATE public.task_steps step
  SET
    title = v_title,
    description = CASE WHEN v_change_description THEN v_description ELSE step.description END,
    updated_at = now()
  FROM public.daily_tasks task
  WHERE step.id = p_id
    AND step.task_id = task.id
    AND task.organization_id = p_organization_id
  RETURNING step.id, step.title, step.description, step."order", step.is_completed
  INTO v_id, v_title, v_description, v_order, v_done;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  id := v_id;
  title := v_title;
  description := v_description;
  step_order := v_order;
  is_completed := v_done;
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_update_task_step(uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_update_task_step(uuid, uuid, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_task_step(uuid, uuid, uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
