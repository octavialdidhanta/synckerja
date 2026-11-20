-- Daily-task reads and limited writes for the MCP gateway.
-- Organization and caller come from the session. No comments, files, or completion approval.

CREATE OR REPLACE FUNCTION public.mcp_task_summary(
  p_user_id uuid,
  p_organization_id uuid,
  p_month text
)
RETURNS TABLE (
  pending bigint,
  in_progress bigint,
  completed bigint,
  cancelled bigint,
  overdue bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_month text;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
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

  v_month := NULLIF(btrim(COALESCE(p_month, '')), '');
  IF v_month IS NULL THEN
    v_month := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM');
  ELSIF v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'invalid_month' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE lower(task.status) = 'pending'),
    count(*) FILTER (WHERE lower(task.status) = 'in_progress'),
    count(*) FILTER (WHERE lower(task.status) = 'completed'),
    count(*) FILTER (WHERE lower(task.status) = 'cancelled'),
    count(*) FILTER (
      WHERE lower(task.status) NOT IN ('completed', 'cancelled')
        AND task.due_date IS NOT NULL
        AND (task.due_date AT TIME ZONE 'Asia/Jakarta')::date
          < (now() AT TIME ZONE 'Asia/Jakarta')::date
    )
  FROM public.daily_tasks task
  WHERE task.organization_id = p_organization_id
    AND to_char(
      COALESCE(task.plan_date, task.created_at) AT TIME ZONE 'Asia/Jakarta',
      'YYYY-MM'
    ) = v_month;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_list_tasks(
  p_user_id uuid,
  p_organization_id uuid,
  p_status text
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  priority text,
  due_date timestamptz,
  assignee_name text,
  creator_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_status text;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
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

  v_status := NULLIF(lower(btrim(COALESCE(p_status, ''))), '');
  IF v_status IS NOT NULL AND v_status NOT IN ('pending', 'in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    task.id,
    task.title,
    task.status,
    task.priority,
    task.due_date,
    assignee.full_name,
    COALESCE(creator_employee.full_name, creator_profile.full_name)
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
  WHERE task.organization_id = p_organization_id
    AND (v_status IS NULL OR lower(task.status) = v_status)
  ORDER BY task.created_at DESC, task.id DESC
  LIMIT 30;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_list_task_initiative(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  level text,
  title text,
  task_title text,
  priority text,
  due_date timestamptz,
  assignee_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
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

  RETURN QUERY
  SELECT item.id, item.level, item.title, item.task_title, item.priority, item.due_date, item.assignee_name
  FROM (
    SELECT
      task.id,
      'task'::text AS level,
      task.title,
      task.title AS task_title,
      task.priority,
      COALESCE(assignee.due_date, task.due_date) AS due_date,
      assignee.full_name AS assignee_name,
      task.created_at
    FROM public.daily_tasks task
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(NULLIF(btrim(emp.full_name), ''), NULLIF(btrim(prof.full_name), '')) AS full_name,
        due.due_date
      FROM public.daily_tasks_assigned assigned
      JOIN public.employees emp ON emp.id = assigned.employee_id
      LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
      LEFT JOIN LATERAL (
        SELECT dated.due_date
        FROM public.task_steps_assigned_duedate dated
        WHERE dated.daily_tasks_assigned_id = assigned.id
        ORDER BY dated.created_at DESC
        LIMIT 1
      ) due ON true
      WHERE assigned.daily_task_id = task.id
        AND assigned.organization_id = task.organization_id
      ORDER BY assigned.assigned_at DESC
      LIMIT 1
    ) assignee ON true
    WHERE task.organization_id = p_organization_id
      AND lower(COALESCE(task.status, '')) NOT IN ('completed', 'cancelled')

    UNION ALL

    SELECT
      step.id,
      'step'::text,
      step.title,
      task.title,
      COALESCE(step.priority, task.priority),
      COALESCE(assignee.due_date, task.due_date),
      assignee.full_name,
      step.created_at
    FROM public.task_steps step
    JOIN public.daily_tasks task ON task.id = step.task_id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(NULLIF(btrim(emp.full_name), ''), NULLIF(btrim(prof.full_name), '')) AS full_name,
        due.due_date
      FROM public.task_steps_assigned assigned
      JOIN public.employees emp ON emp.id = assigned.employee_id
      LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
      LEFT JOIN LATERAL (
        SELECT dated.due_date
        FROM public.task_steps_assigned_duedate dated
        WHERE dated.task_steps_assigned_id = assigned.id
        ORDER BY dated.created_at DESC
        LIMIT 1
      ) due ON true
      WHERE assigned.task_step_id = step.id
        AND assigned.organization_id = task.organization_id
      ORDER BY assigned.assigned_at DESC
      LIMIT 1
    ) assignee ON true
    WHERE task.organization_id = p_organization_id
      AND step.is_completed = false
      AND lower(COALESCE(task.status, '')) NOT IN ('completed', 'cancelled')

    UNION ALL

    SELECT
      sub.id,
      'substep'::text,
      sub.title,
      task.title,
      task.priority,
      COALESCE(assignee.due_date, task.due_date),
      assignee.full_name,
      sub.created_at
    FROM public.task_steps_to_steps sub
    JOIN public.task_steps step ON step.id = sub.parent_step_id
    JOIN public.daily_tasks task ON task.id = step.task_id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(NULLIF(btrim(emp.full_name), ''), NULLIF(btrim(prof.full_name), '')) AS full_name,
        due.due_date
      FROM public.task_steps_to_steps_assigned assigned
      JOIN public.employees emp ON emp.id = assigned.employee_id
      LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
      LEFT JOIN LATERAL (
        SELECT dated.due_date
        FROM public.task_steps_assigned_duedate dated
        WHERE dated.task_steps_to_steps_assigned_id = assigned.id
        ORDER BY dated.created_at DESC
        LIMIT 1
      ) due ON true
      WHERE assigned.task_steps_to_steps_id = sub.id
        AND assigned.organization_id = task.organization_id
      ORDER BY assigned.assigned_at DESC
      LIMIT 1
    ) assignee ON true
    WHERE task.organization_id = p_organization_id
      AND sub.is_completed = false
      AND lower(COALESCE(task.status, '')) NOT IN ('completed', 'cancelled')
  ) item
  ORDER BY (item.assignee_name IS NULL) DESC, item.created_at DESC, item.id DESC
  LIMIT 50;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_task_workload(
  p_user_id uuid,
  p_organization_id uuid,
  p_timeframe text
)
RETURNS TABLE (
  employee_id uuid,
  full_name text,
  active_count bigint,
  idle boolean,
  pending_days integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_timeframe text;
  v_today date;
  v_start date;
  v_end date;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
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

  v_timeframe := lower(COALESCE(NULLIF(btrim(COALESCE(p_timeframe, '')), ''), 'week'));
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  IF v_timeframe = 'day' THEN
    v_start := v_today;
    v_end := v_today;
  ELSIF v_timeframe = 'week' THEN
    v_start := v_today - ((EXTRACT(DOW FROM v_today)::int + 6) % 7);
    v_end := v_start + 6;
  ELSIF v_timeframe = 'month' THEN
    v_start := date_trunc('month', v_today::timestamp)::date;
    v_end := (date_trunc('month', v_today::timestamp) + interval '1 month' - interval '1 day')::date;
  ELSE
    RAISE EXCEPTION 'invalid_timeframe' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH people AS (
    SELECT
      emp.id,
      COALESCE(
        NULLIF(btrim(emp.full_name), ''),
        NULLIF(btrim(prof.full_name), ''),
        'Unknown'
      ) AS full_name
    FROM public.employees emp
    LEFT JOIN public.employee_statuses es ON es.id = emp.employee_status_id
    LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
    WHERE emp.organization_id = p_organization_id
      AND COALESCE(emp.pending_removal, false) = false
      AND lower(COALESCE(emp.status, 'active')) NOT IN ('inactive', 'terminated', 'resigned')
      AND lower(regexp_replace(COALESCE(es.name, ''), '[\s_]+', '', 'g'))
        NOT IN ('inactive', 'terminated', 'pendingremoval')
  ),
  hits AS (
    SELECT assigned.employee_id, assigned.assigned_at
    FROM public.daily_tasks_assigned assigned
    JOIN public.daily_tasks task
      ON task.id = assigned.daily_task_id
     AND task.organization_id = p_organization_id
    WHERE assigned.organization_id = p_organization_id
      AND lower(COALESCE(task.status, '')) NOT IN ('completed', 'cancelled')
      AND task.due_date IS NOT NULL
      AND (
        (task.due_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_start AND v_end
        OR (task.due_date AT TIME ZONE 'Asia/Jakarta')::date < v_today
      )

    UNION ALL

    SELECT assigned.employee_id, assigned.assigned_at
    FROM public.task_steps_assigned assigned
    JOIN public.task_steps step ON step.id = assigned.task_step_id
    JOIN public.daily_tasks task
      ON task.id = step.task_id
     AND task.organization_id = p_organization_id
    LEFT JOIN LATERAL (
      SELECT dated.due_date
      FROM public.task_steps_assigned_duedate dated
      WHERE dated.task_steps_assigned_id = assigned.id
      ORDER BY dated.created_at DESC
      LIMIT 1
    ) due ON true
    WHERE assigned.organization_id = p_organization_id
      AND step.is_completed = false
      AND lower(COALESCE(task.status, '')) NOT IN ('completed', 'cancelled')
      AND COALESCE(due.due_date, task.due_date) IS NOT NULL
      AND (
        (COALESCE(due.due_date, task.due_date) AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_start AND v_end
        OR (COALESCE(due.due_date, task.due_date) AT TIME ZONE 'Asia/Jakarta')::date < v_today
      )

    UNION ALL

    SELECT assigned.employee_id, assigned.assigned_at
    FROM public.task_steps_to_steps_assigned assigned
    JOIN public.task_steps_to_steps sub ON sub.id = assigned.task_steps_to_steps_id
    JOIN public.task_steps step ON step.id = sub.parent_step_id
    JOIN public.daily_tasks task
      ON task.id = step.task_id
     AND task.organization_id = p_organization_id
    LEFT JOIN LATERAL (
      SELECT dated.due_date
      FROM public.task_steps_assigned_duedate dated
      WHERE dated.task_steps_to_steps_assigned_id = assigned.id
      ORDER BY dated.created_at DESC
      LIMIT 1
    ) due ON true
    WHERE assigned.organization_id = p_organization_id
      AND sub.is_completed = false
      AND lower(COALESCE(task.status, '')) NOT IN ('completed', 'cancelled')
      AND COALESCE(due.due_date, task.due_date) IS NOT NULL
      AND (
        (COALESCE(due.due_date, task.due_date) AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_start AND v_end
        OR (COALESCE(due.due_date, task.due_date) AT TIME ZONE 'Asia/Jakarta')::date < v_today
      )
  )
  SELECT
    people.id,
    people.full_name,
    count(hits.employee_id),
    count(hits.employee_id) = 0,
    COALESCE(
      MAX(GREATEST(0, floor(EXTRACT(EPOCH FROM (now() - hits.assigned_at)) / 86400)))::integer,
      0
    )
  FROM people
  LEFT JOIN hits ON hits.employee_id = people.id
  GROUP BY people.id, people.full_name
  ORDER BY (count(hits.employee_id) = 0) DESC, people.full_name ASC, people.id ASC
  LIMIT 50;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_list_completed_steps(
  p_user_id uuid,
  p_organization_id uuid,
  p_month text
)
RETURNS TABLE (
  id uuid,
  task_title text,
  step_title text,
  completed_at timestamptz,
  assignee_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_month text;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
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

  v_month := NULLIF(btrim(COALESCE(p_month, '')), '');
  IF v_month IS NOT NULL AND v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'invalid_month' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    step.id,
    task.title,
    step.title,
    COALESCE(step.completed_at, step.updated_at),
    assignee.full_name
  FROM public.task_steps step
  JOIN public.daily_tasks task ON task.id = step.task_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(NULLIF(btrim(emp.full_name), ''), NULLIF(btrim(prof.full_name), '')) AS full_name
    FROM public.task_steps_assigned assigned
    JOIN public.employees emp ON emp.id = assigned.employee_id
    LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
    WHERE assigned.task_step_id = step.id
      AND assigned.organization_id = task.organization_id
    ORDER BY assigned.assigned_at DESC
    LIMIT 1
  ) assignee ON true
  WHERE task.organization_id = p_organization_id
    AND step.is_completed = true
    AND (
      v_month IS NULL
      OR to_char(COALESCE(step.completed_at, step.updated_at) AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') = v_month
    )
  ORDER BY COALESCE(step.completed_at, step.updated_at) DESC NULLS LAST, step.id DESC
  LIMIT 20;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_create_task(
  p_user_id uuid,
  p_organization_id uuid,
  p_title text,
  p_description text,
  p_priority text,
  p_due_date text,
  p_employee_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  priority text,
  due_date timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_can_assign boolean;
  v_title text;
  v_description text;
  v_priority text;
  v_due timestamptz;
  v_row public.daily_tasks%ROWTYPE;
  v_assignment uuid;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
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

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.organization_id = p_organization_id
      AND lower(ur.role) IN ('owner', 'admin', 'hr')
  ) INTO v_can_assign;

  v_title := btrim(COALESCE(p_title, ''));
  IF char_length(v_title) < 1 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    v_description := '';
  ELSIF char_length(btrim(p_description)) > 2000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  ELSE
    v_description := btrim(p_description);
  END IF;

  v_priority := COALESCE(NULLIF(btrim(COALESCE(p_priority, '')), ''), 'medium');
  IF v_priority NOT IN ('low', 'medium', 'high', 'urgent', 'needs_to_be_presented') THEN
    RAISE EXCEPTION 'invalid_priority' USING ERRCODE = '22023';
  END IF;

  IF p_due_date IS NOT NULL AND btrim(p_due_date) <> '' THEN
    IF btrim(p_due_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_due := (btrim(p_due_date) || ' 17:00:00')::timestamp AT TIME ZONE 'Asia/Jakarta';
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END;
    IF to_char(v_due AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') IS DISTINCT FROM btrim(p_due_date) THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_employee_id IS NOT NULL THEN
    IF p_employee_id IS DISTINCT FROM v_self AND NOT v_can_assign THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.employees emp
      WHERE emp.id = p_employee_id AND emp.organization_id = p_organization_id
    ) THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.daily_tasks (
    organization_id, title, description, status, priority, due_date, created_by
  )
  VALUES (
    p_organization_id, v_title, v_description, 'pending', v_priority, v_due, p_user_id
  )
  RETURNING * INTO v_row;

  IF p_employee_id IS NOT NULL THEN
    INSERT INTO public.daily_tasks_assigned (
      organization_id, daily_task_id, employee_id, assigned_by
    )
    VALUES (p_organization_id, v_row.id, p_employee_id, v_self)
    RETURNING daily_tasks_assigned.id INTO v_assignment;

    IF v_due IS NOT NULL THEN
      INSERT INTO public.task_steps_assigned_duedate (
        organization_id, daily_tasks_assigned_id, due_date
      )
      VALUES (p_organization_id, v_assignment, v_due);
    END IF;
  END IF;

  id := v_row.id;
  title := v_row.title;
  status := v_row.status;
  priority := v_row.priority;
  due_date := v_row.due_date;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_update_task(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_title text,
  p_priority text,
  p_due_date text
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  priority text,
  due_date timestamptz
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
  v_priority text;
  v_due timestamptz;
  v_has_due boolean := false;
  v_row public.daily_tasks%ROWTYPE;
  v_assignment uuid;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF p_title IS NULL AND p_priority IS NULL AND p_due_date IS NULL THEN
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

  IF p_title IS NOT NULL THEN
    v_title := btrim(p_title);
    IF char_length(v_title) < 1 OR char_length(v_title) > 200 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_priority IS NOT NULL THEN
    v_priority := btrim(p_priority);
    IF v_priority NOT IN ('low', 'medium', 'high', 'urgent', 'needs_to_be_presented') THEN
      RAISE EXCEPTION 'invalid_priority' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_due_date IS NOT NULL THEN
    v_has_due := true;
    IF btrim(p_due_date) = '' THEN
      v_due := NULL;
    ELSE
      IF btrim(p_due_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
        RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
      END IF;
      BEGIN
        v_due := (btrim(p_due_date) || ' 17:00:00')::timestamp AT TIME ZONE 'Asia/Jakarta';
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
      END;
      IF to_char(v_due AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') IS DISTINCT FROM btrim(p_due_date) THEN
        RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  UPDATE public.daily_tasks task
  SET
    title = COALESCE(v_title, task.title),
    priority = COALESCE(v_priority, task.priority),
    due_date = CASE WHEN v_has_due THEN v_due ELSE task.due_date END,
    updated_at = now()
  WHERE task.id = p_id
    AND task.organization_id = p_organization_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_has_due AND v_due IS NOT NULL THEN
    SELECT assigned.id INTO v_assignment
    FROM public.daily_tasks_assigned assigned
    WHERE assigned.daily_task_id = p_id
      AND assigned.organization_id = p_organization_id
    ORDER BY assigned.assigned_at DESC
    LIMIT 1;
    IF v_assignment IS NOT NULL THEN
      INSERT INTO public.task_steps_assigned_duedate (
        organization_id, daily_tasks_assigned_id, due_date
      )
      VALUES (p_organization_id, v_assignment, v_due);
    END IF;
  END IF;

  id := v_row.id;
  title := v_row.title;
  status := v_row.status;
  priority := v_row.priority;
  due_date := v_row.due_date;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_delete_task(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL THEN
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

  IF NOT EXISTS (
    SELECT 1 FROM public.daily_tasks task
    WHERE task.id = p_id AND task.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.daily_tasks_assigned assigned
    WHERE assigned.daily_task_id = p_id AND assigned.organization_id = p_organization_id
  ) OR EXISTS (
    SELECT 1
    FROM public.task_steps step
    JOIN public.task_steps_assigned assigned ON assigned.task_step_id = step.id
    WHERE step.task_id = p_id
  ) OR EXISTS (
    SELECT 1
    FROM public.task_steps step
    JOIN public.task_steps_to_steps sub ON sub.parent_step_id = step.id
    JOIN public.task_steps_to_steps_assigned assigned ON assigned.task_steps_to_steps_id = sub.id
    WHERE step.task_id = p_id
  ) THEN
    RAISE EXCEPTION 'not_deletable' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.daily_tasks task
  WHERE task.id = p_id
    AND task.organization_id = p_organization_id
  RETURNING task.id INTO v_id;

  id := v_id;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_assign_task(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_employee_id uuid,
  p_due_date text
)
RETURNS TABLE (
  id uuid,
  assignee_name text,
  due_date timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_can_assign boolean;
  v_due timestamptz;
  v_assignment uuid;
  v_name text;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL OR p_employee_id IS NULL THEN
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

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.organization_id = p_organization_id
      AND lower(ur.role) IN ('owner', 'admin', 'hr')
  ) INTO v_can_assign;

  IF p_employee_id IS DISTINCT FROM v_self AND NOT v_can_assign THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.daily_tasks task
    WHERE task.id = p_id AND task.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employees emp
    WHERE emp.id = p_employee_id AND emp.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_due_date IS NOT NULL AND btrim(p_due_date) <> '' THEN
    IF btrim(p_due_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_due := (btrim(p_due_date) || ' 17:00:00')::timestamp AT TIME ZONE 'Asia/Jakarta';
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END;
    IF to_char(v_due AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') IS DISTINCT FROM btrim(p_due_date) THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_due IS NOT NULL THEN
    UPDATE public.daily_tasks task
    SET due_date = v_due, updated_at = now()
    WHERE task.id = p_id AND task.organization_id = p_organization_id;
  END IF;

  DELETE FROM public.daily_tasks_assigned assigned
  WHERE assigned.daily_task_id = p_id
    AND assigned.organization_id = p_organization_id;

  INSERT INTO public.daily_tasks_assigned (
    organization_id, daily_task_id, employee_id, assigned_by
  )
  VALUES (p_organization_id, p_id, p_employee_id, v_self)
  RETURNING daily_tasks_assigned.id INTO v_assignment;

  IF v_due IS NOT NULL THEN
    INSERT INTO public.task_steps_assigned_duedate (
      organization_id, daily_tasks_assigned_id, due_date
    )
    VALUES (p_organization_id, v_assignment, v_due);
  END IF;

  SELECT COALESCE(NULLIF(btrim(emp.full_name), ''), NULLIF(btrim(prof.full_name), ''))
  INTO v_name
  FROM public.employees emp
  LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
  WHERE emp.id = p_employee_id;

  id := p_id;
  assignee_name := v_name;
  due_date := v_due;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_take_task_initiative(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_level text,
  p_due_date text,
  p_employee_id uuid
)
RETURNS TABLE (
  id uuid,
  level text,
  assignee_name text,
  due_date timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_self uuid;
  v_can_assign boolean;
  v_level text;
  v_target uuid;
  v_due timestamptz;
  v_assignment uuid;
  v_name text;
  v_open boolean;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_level := lower(btrim(COALESCE(p_level, '')));
  IF v_level NOT IN ('task', 'step', 'substep') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_due_date IS NULL OR btrim(p_due_date) = '' THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
  END IF;
  IF btrim(p_due_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_due := (btrim(p_due_date) || ' 17:00:00')::timestamp AT TIME ZONE 'Asia/Jakarta';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
  END;
  IF to_char(v_due AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') IS DISTINCT FROM btrim(p_due_date) THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
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

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.organization_id = p_organization_id
      AND lower(ur.role) IN ('owner', 'admin', 'hr')
  ) INTO v_can_assign;

  v_target := COALESCE(p_employee_id, v_self);
  IF v_target IS DISTINCT FROM v_self AND NOT v_can_assign THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employees emp
    WHERE emp.id = v_target AND emp.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_level = 'task' THEN
    SELECT lower(COALESCE(task.status, '')) NOT IN ('completed', 'cancelled')
    INTO v_open
    FROM public.daily_tasks task
    WHERE task.id = p_id AND task.organization_id = p_organization_id;
    IF v_open IS NULL THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_open THEN
      RAISE EXCEPTION 'not_open' USING ERRCODE = '22023';
    END IF;

    UPDATE public.daily_tasks task
    SET due_date = v_due, updated_at = now()
    WHERE task.id = p_id AND task.organization_id = p_organization_id;

    DELETE FROM public.daily_tasks_assigned assigned
    WHERE assigned.daily_task_id = p_id
      AND assigned.organization_id = p_organization_id;

    INSERT INTO public.daily_tasks_assigned (
      organization_id, daily_task_id, employee_id, assigned_by
    )
    VALUES (p_organization_id, p_id, v_target, v_self)
    RETURNING daily_tasks_assigned.id INTO v_assignment;

    INSERT INTO public.task_steps_assigned_duedate (
      organization_id, daily_tasks_assigned_id, due_date
    )
    VALUES (p_organization_id, v_assignment, v_due);
  ELSIF v_level = 'step' THEN
    SELECT step.is_completed = false
      AND lower(COALESCE(task.status, '')) NOT IN ('completed', 'cancelled')
    INTO v_open
    FROM public.task_steps step
    JOIN public.daily_tasks task ON task.id = step.task_id
    WHERE step.id = p_id AND task.organization_id = p_organization_id;
    IF v_open IS NULL THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_open THEN
      RAISE EXCEPTION 'not_open' USING ERRCODE = '22023';
    END IF;

    DELETE FROM public.task_steps_assigned assigned
    WHERE assigned.task_step_id = p_id
      AND assigned.organization_id = p_organization_id;

    INSERT INTO public.task_steps_assigned (
      organization_id, task_step_id, employee_id, assigned_by
    )
    VALUES (p_organization_id, p_id, v_target, v_self)
    RETURNING task_steps_assigned.id INTO v_assignment;

    INSERT INTO public.task_steps_assigned_duedate (
      organization_id, task_steps_assigned_id, due_date
    )
    VALUES (p_organization_id, v_assignment, v_due);
  ELSE
    SELECT sub.is_completed = false
      AND lower(COALESCE(task.status, '')) NOT IN ('completed', 'cancelled')
    INTO v_open
    FROM public.task_steps_to_steps sub
    JOIN public.task_steps step ON step.id = sub.parent_step_id
    JOIN public.daily_tasks task ON task.id = step.task_id
    WHERE sub.id = p_id AND task.organization_id = p_organization_id;
    IF v_open IS NULL THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_open THEN
      RAISE EXCEPTION 'not_open' USING ERRCODE = '22023';
    END IF;

    DELETE FROM public.task_steps_to_steps_assigned assigned
    WHERE assigned.task_steps_to_steps_id = p_id
      AND assigned.organization_id = p_organization_id;

    INSERT INTO public.task_steps_to_steps_assigned (
      organization_id, task_steps_to_steps_id, employee_id, assigned_by
    )
    VALUES (p_organization_id, p_id, v_target, v_self)
    RETURNING task_steps_to_steps_assigned.id INTO v_assignment;

    INSERT INTO public.task_steps_assigned_duedate (
      organization_id, task_steps_to_steps_assigned_id, due_date
    )
    VALUES (p_organization_id, v_assignment, v_due);
  END IF;

  SELECT COALESCE(NULLIF(btrim(emp.full_name), ''), NULLIF(btrim(prof.full_name), ''))
  INTO v_name
  FROM public.employees emp
  LEFT JOIN public.profiles prof ON prof.user_id = emp.user_id
  WHERE emp.id = v_target;

  id := p_id;
  level := v_level;
  assignee_name := v_name;
  due_date := v_due;
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_task_summary(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_task_summary(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_task_summary(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_tasks(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_tasks(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_tasks(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_task_initiative(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_task_initiative(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_task_initiative(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_task_workload(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_task_workload(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_task_workload(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_completed_steps(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_completed_steps(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_completed_steps(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_task(uuid, uuid, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_task(uuid, uuid, text, text, text, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_task(uuid, uuid, text, text, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_update_task(uuid, uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_update_task(uuid, uuid, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_task(uuid, uuid, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_delete_task(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_delete_task(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_delete_task(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_assign_task(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_assign_task(uuid, uuid, uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_assign_task(uuid, uuid, uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_take_task_initiative(uuid, uuid, uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_take_task_initiative(uuid, uuid, uuid, text, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_take_task_initiative(uuid, uuid, uuid, text, text, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
