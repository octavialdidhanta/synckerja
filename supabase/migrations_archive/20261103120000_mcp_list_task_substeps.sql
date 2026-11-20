-- Read-only list of the sub-steps under one step, for the MCP tool tasks.substeps.list.
-- Same membership and organization checks as mcp_list_task_steps. Nothing is written.

CREATE OR REPLACE FUNCTION public.mcp_list_task_substeps(
  p_user_id uuid,
  p_organization_id uuid,
  p_step_id uuid
)
RETURNS TABLE (
  id uuid,
  step_id uuid,
  title text,
  substep_order integer,
  is_completed boolean,
  assignee_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.task_steps step
    JOIN public.daily_tasks task ON task.id = step.task_id
    WHERE step.id = p_step_id
      AND task.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    sub.id,
    sub.parent_step_id,
    sub.title,
    sub."order",
    sub.is_completed,
    assignee.full_name
  FROM public.task_steps_to_steps sub
  LEFT JOIN LATERAL (
    SELECT COALESCE(NULLIF(btrim(emp.full_name), ''), NULLIF(btrim(prof.full_name), '')) AS full_name
    FROM public.task_steps_to_steps_assigned assigned
    JOIN public.employees emp ON emp.id = assigned.employee_id
    LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
    WHERE assigned.task_steps_to_steps_id = sub.id
    ORDER BY assigned.assigned_at DESC
    LIMIT 1
  ) assignee ON true
  WHERE sub.parent_step_id = p_step_id
    AND sub.organization_id = p_organization_id
  ORDER BY sub."order" ASC, sub.created_at ASC, sub.id ASC
  LIMIT 50;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_list_task_substeps(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_task_substeps(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_task_substeps(uuid, uuid, uuid) TO service_role;
