-- Plan month for daily tasks through the connector.
-- Claude sends YYYY-MM. Office stores the first day of that month at midnight UTC.
-- A due date in another month stays valid.

DROP FUNCTION IF EXISTS public.mcp_list_tasks(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.mcp_create_task(uuid, uuid, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.mcp_update_task(uuid, uuid, uuid, text, text, text);

CREATE FUNCTION public.mcp_list_tasks(
  p_user_id uuid,
  p_organization_id uuid,
  p_status text,
  p_month text
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  priority text,
  due_date timestamptz,
  assignee_name text,
  creator_name text,
  plan_month text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_status text;
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

  v_status := NULLIF(lower(btrim(COALESCE(p_status, ''))), '');
  IF v_status IS NOT NULL AND v_status NOT IN ('pending', 'in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  v_month := NULLIF(btrim(COALESCE(p_month, '')), '');
  IF v_month IS NOT NULL AND v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'invalid_month' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    task.id,
    task.title,
    task.status,
    task.priority,
    task.due_date,
    assignee.full_name,
    COALESCE(creator_employee.full_name, creator_profile.full_name),
    to_char(task.plan_date AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM')
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
    AND (
      v_month IS NULL
      OR to_char(task.plan_date AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') = v_month
    )
  ORDER BY task.created_at DESC, task.id DESC
  LIMIT 30;
END;
$mcp$;

CREATE FUNCTION public.mcp_create_task(
  p_user_id uuid,
  p_organization_id uuid,
  p_title text,
  p_description text,
  p_priority text,
  p_due_date text,
  p_employee_id uuid,
  p_plan_month text
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  priority text,
  due_date timestamptz,
  plan_month text
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
  v_plan_month text;
  v_plan timestamptz;
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

  v_plan_month := NULLIF(btrim(COALESCE(p_plan_month, '')), '');
  IF v_plan_month IS NULL OR v_plan_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_plan := (v_plan_month || '-01 00:00:00')::timestamp AT TIME ZONE 'UTC';

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
    organization_id, title, description, status, priority, due_date, plan_date, created_by
  )
  VALUES (
    p_organization_id, v_title, v_description, 'pending', v_priority, v_due, v_plan, p_user_id
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
  plan_month := to_char(v_row.plan_date AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM');
  RETURN NEXT;
END;
$mcp$;

CREATE FUNCTION public.mcp_update_task(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_title text,
  p_priority text,
  p_due_date text,
  p_plan_month text
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  priority text,
  due_date timestamptz,
  plan_month text
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
  v_has_plan boolean := false;
  v_plan_month text;
  v_plan timestamptz;
  v_row public.daily_tasks%ROWTYPE;
  v_assignment uuid;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF p_title IS NULL AND p_priority IS NULL AND p_due_date IS NULL AND p_plan_month IS NULL THEN
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

  IF p_plan_month IS NOT NULL THEN
    v_has_plan := true;
    v_plan_month := btrim(p_plan_month);
    IF v_plan_month = '' OR v_plan_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_plan := (v_plan_month || '-01 00:00:00')::timestamp AT TIME ZONE 'UTC';
  END IF;

  UPDATE public.daily_tasks task
  SET
    title = COALESCE(v_title, task.title),
    priority = COALESCE(v_priority, task.priority),
    due_date = CASE WHEN v_has_due THEN v_due ELSE task.due_date END,
    plan_date = CASE WHEN v_has_plan THEN v_plan ELSE task.plan_date END,
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
  plan_month := to_char(v_row.plan_date AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM');
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_list_tasks(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_tasks(uuid, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_tasks(uuid, uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_task(uuid, uuid, text, text, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_task(uuid, uuid, text, text, text, text, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_task(uuid, uuid, text, text, text, text, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_update_task(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_update_task(uuid, uuid, uuid, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_task(uuid, uuid, uuid, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
