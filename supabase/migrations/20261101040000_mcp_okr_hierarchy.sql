-- OKR hierarchy for the connector.
-- Company key results that a department carries are department objectives.
-- Department key results that a person carries are individual objectives.
-- A percentage key result row is stored on the objective that owns it.

DROP FUNCTION IF EXISTS public.mcp_list_okr_objectives(uuid, uuid, uuid);

CREATE FUNCTION public.mcp_list_okr_objectives(
  p_user_id uuid,
  p_organization_id uuid,
  p_cycle_id uuid
)
RETURNS TABLE (
  id uuid,
  level text,
  title text,
  status text,
  progress_percentage double precision,
  cycle_id uuid,
  owner_name text,
  parent_id uuid,
  department_id uuid,
  department_name text,
  employee_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
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
  SELECT
    q.id,
    q.level,
    q.title,
    q.status,
    q.progress_percentage,
    q.cycle_id,
    q.owner_name,
    q.parent_id,
    q.department_id,
    q.department_name,
    q.employee_id
  FROM (
    SELECT
      c.id,
      'company'::text AS level,
      c.title,
      c.status,
      c.progress_percentage::double precision AS progress_percentage,
      c.cycle_id,
      NULL::text AS owner_name,
      NULL::uuid AS parent_id,
      NULL::uuid AS department_id,
      NULL::text AS department_name,
      NULL::uuid AS employee_id,
      c.updated_at
    FROM public.company_objectives c
    WHERE c.organization_id = p_organization_id
      AND (p_cycle_id IS NULL OR c.cycle_id = p_cycle_id)
    UNION ALL
    SELECT
      d.id,
      'department'::text,
      d.title,
      d.status,
      d.progress_percentage::double precision,
      d.cycle_id,
      dep.name,
      d.company_objective_id,
      d.department_id,
      dep.name,
      NULL::uuid,
      d.updated_at
    FROM public.department_objectives d
    LEFT JOIN public.departments dep ON dep.id = d.department_id
    WHERE d.organization_id = p_organization_id
      AND (p_cycle_id IS NULL OR d.cycle_id = p_cycle_id)
    UNION ALL
    SELECT
      i.id,
      'individual'::text,
      i.title,
      i.status,
      i.progress_percentage::double precision,
      i.cycle_id,
      emp.full_name,
      i.department_objective_id,
      parent_objective.department_id,
      parent_department.name,
      i.employee_id,
      i.updated_at
    FROM public.individual_objectives i
    LEFT JOIN public.employees emp ON emp.id = i.employee_id
    LEFT JOIN public.department_objectives parent_objective
      ON parent_objective.id = i.department_objective_id
    LEFT JOIN public.departments parent_department
      ON parent_department.id = parent_objective.department_id
    WHERE i.organization_id = p_organization_id
      AND (p_cycle_id IS NULL OR i.cycle_id = p_cycle_id)
  ) q
  ORDER BY q.updated_at DESC, q.id ASC
  LIMIT 50;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_list_okr_departments(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
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
  SELECT
    dep.id,
    dep.name
  FROM public.departments dep
  WHERE dep.organization_id = p_organization_id
    AND COALESCE(dep.is_active, true) = true
  ORDER BY dep.name ASC, dep.id ASC
  LIMIT 50;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_create_company_objective(
  p_user_id uuid,
  p_organization_id uuid,
  p_cycle_id uuid,
  p_title text,
  p_why_important text,
  p_status text
)
RETURNS TABLE (
  id uuid,
  level text,
  title text,
  status text,
  progress_percentage double precision,
  cycle_id uuid,
  owner_name text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_title text;
  v_why text;
  v_status text;
  v_objective public.company_objectives%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_cycle_id IS NULL THEN
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
    FROM public.okr_cycles cycle
    WHERE cycle.id = p_cycle_id
      AND cycle.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'invalid_cycle' USING ERRCODE = '22023';
  END IF;

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  IF v_title IS NULL OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_why := NULLIF(btrim(COALESCE(p_why_important, '')), '');
  IF v_why IS NOT NULL AND char_length(v_why) > 2000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_status := COALESCE(NULLIF(btrim(COALESCE(p_status, '')), ''), 'draft');
  IF v_status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.company_objectives (
    organization_id,
    cycle_id,
    title,
    why_important,
    status,
    progress_percentage,
    weight,
    owner_id,
    created_by
  )
  VALUES (
    p_organization_id,
    p_cycle_id,
    v_title,
    v_why,
    v_status,
    0,
    100,
    p_user_id,
    p_user_id
  )
  RETURNING * INTO v_objective;

  INSERT INTO public.key_results (
    title,
    target_value,
    current_value,
    unit,
    metric_type,
    progress_percentage,
    weight,
    company_objective_id
  )
  VALUES (
    v_objective.title,
    100,
    0,
    '%',
    'percentage',
    0,
    100,
    v_objective.id
  );

  id := v_objective.id;
  level := 'company';
  title := v_objective.title;
  status := v_objective.status;
  progress_percentage := v_objective.progress_percentage;
  cycle_id := v_objective.cycle_id;
  owner_name := NULL;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_create_department_objective(
  p_user_id uuid,
  p_organization_id uuid,
  p_company_objective_id uuid,
  p_department_id uuid,
  p_title text,
  p_description text,
  p_status text
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  progress_percentage double precision,
  cycle_id uuid,
  company_objective_id uuid,
  department_id uuid
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_title text;
  v_description text;
  v_status text;
  v_cycle uuid;
  v_department uuid;
  v_row public.department_objectives%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_company_objective_id IS NULL OR p_department_id IS NULL THEN
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

  v_title := btrim(COALESCE(p_title, ''));
  IF char_length(v_title) < 1 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    v_description := NULL;
  ELSIF char_length(btrim(p_description)) > 2000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  ELSE
    v_description := btrim(p_description);
  END IF;

  v_status := COALESCE(NULLIF(btrim(COALESCE(p_status, '')), ''), 'active');
  IF v_status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT objective.cycle_id
  INTO v_cycle
  FROM public.company_objectives objective
  WHERE objective.id = p_company_objective_id
    AND objective.organization_id = p_organization_id;
  IF v_cycle IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT dep.id
  INTO v_department
  FROM public.departments dep
  WHERE dep.id = p_department_id
    AND dep.organization_id = p_organization_id
    AND COALESCE(dep.is_active, true) = true;
  IF v_department IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.department_objectives (
    organization_id,
    cycle_id,
    company_objective_id,
    department_id,
    title,
    description,
    status,
    progress_percentage,
    weight,
    owner_id,
    created_by
  )
  VALUES (
    p_organization_id,
    v_cycle,
    p_company_objective_id,
    v_department,
    v_title,
    v_description,
    v_status,
    0,
    100,
    p_user_id,
    p_user_id
  )
  RETURNING * INTO v_row;

  INSERT INTO public.key_results (
    title,
    target_value,
    current_value,
    unit,
    metric_type,
    progress_percentage,
    weight,
    department_objective_id
  )
  VALUES (
    v_row.title,
    100,
    0,
    '%',
    'percentage',
    0,
    100,
    v_row.id
  );

  id := v_row.id;
  title := v_row.title;
  status := v_row.status;
  progress_percentage := v_row.progress_percentage;
  cycle_id := v_row.cycle_id;
  company_objective_id := v_row.company_objective_id;
  department_id := v_row.department_id;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_create_individual_objective(
  p_user_id uuid,
  p_organization_id uuid,
  p_department_objective_id uuid,
  p_title text,
  p_description text,
  p_status text,
  p_employee_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  progress_percentage double precision,
  cycle_id uuid,
  department_objective_id uuid,
  employee_id uuid
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
  v_status text;
  v_cycle uuid;
  v_department uuid;
  v_employee uuid;
  v_target uuid;
  v_row public.individual_objectives%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_department_objective_id IS NULL THEN
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

  SELECT emp.id
  INTO v_self
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

  v_employee := COALESCE(p_employee_id, v_self);
  IF v_employee IS DISTINCT FROM v_self AND NOT v_can_assign THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_title := btrim(COALESCE(p_title, ''));
  IF char_length(v_title) < 1 OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    v_description := NULL;
  ELSIF char_length(btrim(p_description)) > 2000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  ELSE
    v_description := btrim(p_description);
  END IF;

  v_status := COALESCE(NULLIF(btrim(COALESCE(p_status, '')), ''), 'active');
  IF v_status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT objective.cycle_id, objective.department_id
  INTO v_cycle, v_department
  FROM public.department_objectives objective
  WHERE objective.id = p_department_objective_id
    AND objective.organization_id = p_organization_id;
  IF v_cycle IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT emp.id
  INTO v_target
  FROM public.employees emp
  LEFT JOIN public.employee_statuses es ON es.id = emp.employee_status_id
  WHERE emp.id = v_employee
    AND emp.organization_id = p_organization_id
    AND emp.department_id = v_department
    AND COALESCE(emp.pending_removal, false) = false
    AND lower(COALESCE(emp.status, 'active')) NOT IN ('inactive', 'terminated', 'resigned')
    AND lower(regexp_replace(COALESCE(es.name, ''), '[\s_]+', '', 'g'))
      NOT IN ('inactive', 'terminated', 'pendingremoval');
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.individual_objectives (
    organization_id,
    cycle_id,
    department_objective_id,
    employee_id,
    title,
    description,
    status,
    progress_percentage,
    weight,
    created_by
  )
  VALUES (
    p_organization_id,
    v_cycle,
    p_department_objective_id,
    v_target,
    v_title,
    v_description,
    v_status,
    0,
    100,
    p_user_id
  )
  RETURNING * INTO v_row;

  INSERT INTO public.key_results (
    title,
    target_value,
    current_value,
    unit,
    metric_type,
    progress_percentage,
    weight,
    individual_objective_id
  )
  VALUES (
    v_row.title,
    100,
    0,
    '%',
    'percentage',
    0,
    100,
    v_row.id
  );

  id := v_row.id;
  title := v_row.title;
  status := v_row.status;
  progress_percentage := v_row.progress_percentage;
  cycle_id := v_row.cycle_id;
  department_objective_id := v_row.department_objective_id;
  employee_id := v_row.employee_id;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_link_task_objective(
  p_user_id uuid,
  p_organization_id uuid,
  p_task_id uuid,
  p_individual_objective_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  objective_id uuid
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_id uuid;
  v_title text;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_task_id IS NULL OR p_individual_objective_id IS NULL THEN
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
    FROM public.individual_objectives objective
    WHERE objective.id = p_individual_objective_id
      AND objective.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.daily_tasks AS task
  SET
    objective_id = p_individual_objective_id,
    updated_at = now()
  WHERE task.id = p_task_id
    AND task.organization_id = p_organization_id
  RETURNING task.id, task.title INTO v_id, v_title;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  id := v_id;
  title := v_title;
  objective_id := p_individual_objective_id;
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_list_okr_objectives(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_okr_objectives(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_okr_objectives(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_okr_departments(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_okr_departments(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_okr_departments(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_company_objective(uuid, uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_company_objective(uuid, uuid, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_company_objective(uuid, uuid, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_department_objective(uuid, uuid, uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_department_objective(uuid, uuid, uuid, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_department_objective(uuid, uuid, uuid, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_individual_objective(uuid, uuid, uuid, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_individual_objective(uuid, uuid, uuid, text, text, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_individual_objective(uuid, uuid, uuid, text, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_link_task_objective(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_link_task_objective(uuid, uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_link_task_objective(uuid, uuid, uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
