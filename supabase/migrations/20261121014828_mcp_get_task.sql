-- MCP tasks.get: read one daily task with its description, steps (with descriptions)
-- and sub-steps. tasks.list and tasks.steps.list do not return descriptions, so a
-- task's brief written in Office could not be read through MCP.
--
-- Same access rule as mcp_list_tasks / mcp_list_task_steps: an active member of the
-- organization locked in the MCP session, and the task must belong to that organization.
-- Read only. Callable by service_role only (the MCP server), not by the public API.

CREATE OR REPLACE FUNCTION public.mcp_get_task(p_user_id uuid, p_organization_id uuid, p_task_id uuid)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  status text,
  priority text,
  due_date timestamp with time zone,
  plan_month text,
  assignee_name text,
  creator_name text,
  steps jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_task_id IS NULL THEN
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
    FROM public.daily_tasks task
    WHERE task.id = p_task_id
      AND task.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    task.id,
    task.title,
    NULLIF(btrim(COALESCE(task.description, '')), ''),
    task.status,
    task.priority,
    task.due_date,
    to_char(task.plan_date AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM'),
    assignee.full_name,
    COALESCE(creator_employee.full_name, creator_profile.full_name),
    COALESCE(step_list.items, '[]'::jsonb)
  FROM public.daily_tasks task
  LEFT JOIN LATERAL (
    SELECT COALESCE(NULLIF(btrim(emp.full_name), ''), NULLIF(btrim(prof.full_name), '')) AS full_name
    FROM public.daily_tasks_assigned assigned
    JOIN public.employees emp ON emp.id = assigned.employee_id
    LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
    WHERE assigned.daily_task_id = task.id
      AND assigned.organization_id = task.organization_id
    ORDER BY assigned.assigned_at DESC
    LIMIT 1
  ) assignee ON true
  LEFT JOIN LATERAL (
    SELECT NULLIF(btrim(emp.full_name), '') AS full_name
    FROM public.employees emp
    WHERE emp.user_id = task.created_by
      AND emp.organization_id = task.organization_id
    ORDER BY emp.id ASC
    LIMIT 1
  ) creator_employee ON true
  LEFT JOIN LATERAL (
    SELECT NULLIF(btrim(prof.full_name), '') AS full_name
    FROM public.profiles prof
    WHERE prof.user_id = task.created_by
    LIMIT 1
  ) creator_profile ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', step.id,
        'title', step.title,
        'description', NULLIF(btrim(COALESCE(step.description, '')), ''),
        'order', step."order",
        'is_completed', COALESCE(step.is_completed, false),
        'assignee_name', step_assignee.full_name,
        'substeps', COALESCE(sub_list.items, '[]'::jsonb)
      )
      ORDER BY step."order" ASC, step.created_at ASC, step.id ASC
    ) AS items
    FROM (
      SELECT s.*
      FROM public.task_steps s
      WHERE s.task_id = task.id
      ORDER BY s."order" ASC, s.created_at ASC, s.id ASC
      LIMIT 50
    ) step
    LEFT JOIN LATERAL (
      SELECT COALESCE(NULLIF(btrim(emp.full_name), ''), NULLIF(btrim(prof.full_name), '')) AS full_name
      FROM public.task_steps_assigned assigned
      JOIN public.employees emp ON emp.id = assigned.employee_id
      LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
      WHERE assigned.task_step_id = step.id
      ORDER BY assigned.assigned_at DESC
      LIMIT 1
    ) step_assignee ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', sub.id,
          'title', sub.title,
          'order', sub."order",
          'is_completed', COALESCE(sub.is_completed, false),
          'assignee_name', sub_assignee.full_name
        )
        ORDER BY sub."order" ASC, sub.created_at ASC, sub.id ASC
      ) AS items
      FROM (
        SELECT x.*
        FROM public.task_steps_to_steps x
        WHERE x.parent_step_id = step.id
          AND x.organization_id = task.organization_id
        ORDER BY x."order" ASC, x.created_at ASC, x.id ASC
        LIMIT 50
      ) sub
      LEFT JOIN LATERAL (
        SELECT COALESCE(NULLIF(btrim(emp.full_name), ''), NULLIF(btrim(prof.full_name), '')) AS full_name
        FROM public.task_steps_to_steps_assigned assigned
        JOIN public.employees emp ON emp.id = assigned.employee_id
        LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
        WHERE assigned.task_steps_to_steps_id = sub.id
        ORDER BY assigned.assigned_at DESC
        LIMIT 1
      ) sub_assignee ON true
    ) sub_list ON true
  ) step_list ON true
  WHERE task.id = p_task_id
    AND task.organization_id = p_organization_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_get_task(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_task(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_task(uuid, uuid, uuid) TO service_role;
