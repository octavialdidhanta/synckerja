-- Phase 3 MCP writes. Membership is checked here; EXECUTE is service_role only.
-- No delete, publish, progress change, lead status change, or contact fields.

CREATE OR REPLACE FUNCTION public.mcp_create_content_plan(
  p_user_id uuid,
  p_organization_id uuid,
  p_title text,
  p_post_date text,
  p_brief text
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  post_date timestamptz,
  approved boolean,
  production_status text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_title text;
  v_brief text;
  v_day date;
  v_post_date timestamptz;
  v_plan public.social_media_plans%ROWTYPE;
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

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  IF v_title IS NULL OR char_length(v_title) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_brief := NULLIF(btrim(COALESCE(p_brief, '')), '');
  IF v_brief IS NOT NULL AND char_length(v_brief) > 4000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(COALESCE(p_post_date, '')), '') IS NULL THEN
    v_post_date := NULL;
  ELSE
    IF btrim(p_post_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_day := btrim(p_post_date)::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END;
    IF to_char(v_day, 'YYYY-MM-DD') <> btrim(p_post_date) THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    v_post_date := v_day::timestamp AT TIME ZONE 'Asia/Jakarta';
  END IF;

  INSERT INTO public.social_media_plans (
    organization_id,
    title,
    brief,
    post_date
  )
  VALUES (
    p_organization_id,
    v_title,
    v_brief,
    v_post_date
  )
  RETURNING * INTO v_plan;

  id := v_plan.id;
  title := v_plan.title;
  status := v_plan.status;
  post_date := v_plan.post_date;
  approved := v_plan.approved;
  production_status := v_plan.production_status;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_update_content_plan(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_title text,
  p_post_date text,
  p_brief text
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  post_date timestamptz,
  approved boolean,
  production_status text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_title text;
  v_brief text;
  v_day date;
  v_post_date timestamptz;
  v_plan public.social_media_plans%ROWTYPE;
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

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  IF p_title IS NOT NULL AND (v_title IS NULL OR char_length(v_title) > 200) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_brief := NULLIF(btrim(COALESCE(p_brief, '')), '');
  IF p_brief IS NOT NULL AND (v_brief IS NULL OR char_length(v_brief) > 4000) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_post_date IS NULL OR NULLIF(btrim(p_post_date), '') IS NULL THEN
    v_post_date := NULL;
  ELSE
    IF btrim(p_post_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_day := btrim(p_post_date)::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END;
    IF to_char(v_day, 'YYYY-MM-DD') <> btrim(p_post_date) THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    v_post_date := v_day::timestamp AT TIME ZONE 'Asia/Jakarta';
  END IF;

  IF v_title IS NULL AND v_brief IS NULL AND v_post_date IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('mcp.plan_brief_user', p_user_id::text, true);

  UPDATE public.social_media_plans AS plan
  SET
    title = COALESCE(v_title, plan.title),
    brief = COALESCE(v_brief, plan.brief),
    post_date = COALESCE(v_post_date, plan.post_date),
    updated_at = now()
  WHERE plan.id = p_id
    AND plan.organization_id = p_organization_id
  RETURNING * INTO v_plan;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  id := v_plan.id;
  title := v_plan.title;
  status := v_plan.status;
  post_date := v_plan.post_date;
  approved := v_plan.approved;
  production_status := v_plan.production_status;
  RETURN NEXT;
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

CREATE OR REPLACE FUNCTION public.mcp_update_objective(
  p_user_id uuid,
  p_organization_id uuid,
  p_level text,
  p_id uuid,
  p_title text,
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
DECLARE
  v_level text;
  v_title text;
  v_status text;
  v_saved_id uuid;
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

  v_level := lower(btrim(COALESCE(p_level, '')));
  IF v_level NOT IN ('company', 'department', 'individual') THEN
    RAISE EXCEPTION 'invalid_level' USING ERRCODE = '22023';
  END IF;

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  IF p_title IS NOT NULL AND (v_title IS NULL OR char_length(v_title) > 200) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_status := NULLIF(btrim(COALESCE(p_status, '')), '');
  IF v_status IS NOT NULL AND v_status NOT IN ('draft', 'active', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_title IS NULL AND v_status IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_level = 'company' THEN
    UPDATE public.company_objectives AS objective
    SET
      title = COALESCE(v_title, objective.title),
      status = COALESCE(v_status, objective.status),
      updated_at = now()
    WHERE objective.id = p_id
      AND objective.organization_id = p_organization_id
    RETURNING objective.id INTO v_saved_id;
  ELSIF v_level = 'department' THEN
    UPDATE public.department_objectives AS objective
    SET
      title = COALESCE(v_title, objective.title),
      status = COALESCE(v_status, objective.status),
      updated_at = now()
    WHERE objective.id = p_id
      AND objective.organization_id = p_organization_id
    RETURNING objective.id INTO v_saved_id;
  ELSE
    UPDATE public.individual_objectives AS objective
    SET
      title = COALESCE(v_title, objective.title),
      status = COALESCE(v_status, objective.status),
      updated_at = now()
    WHERE objective.id = p_id
      AND objective.organization_id = p_organization_id
    RETURNING objective.id INTO v_saved_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_level = 'company' THEN
    RETURN QUERY
    SELECT
      objective.id,
      'company'::text,
      objective.title,
      objective.status,
      objective.progress_percentage::double precision,
      objective.cycle_id,
      NULL::text
    FROM public.company_objectives objective
    WHERE objective.id = v_saved_id;
  ELSIF v_level = 'department' THEN
    RETURN QUERY
    SELECT
      objective.id,
      'department'::text,
      objective.title,
      objective.status,
      objective.progress_percentage::double precision,
      objective.cycle_id,
      dep.name
    FROM public.department_objectives objective
    LEFT JOIN public.departments dep ON dep.id = objective.department_id
    WHERE objective.id = v_saved_id;
  ELSE
    RETURN QUERY
    SELECT
      objective.id,
      'individual'::text,
      objective.title,
      objective.status,
      objective.progress_percentage::double precision,
      objective.cycle_id,
      emp.full_name
    FROM public.individual_objectives objective
    LEFT JOIN public.employees emp ON emp.id = objective.employee_id
    WHERE objective.id = v_saved_id;
  END IF;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_create_lead(
  p_user_id uuid,
  p_organization_id uuid,
  p_client text,
  p_title text,
  p_category text,
  p_source text,
  p_fu_priority text,
  p_status text
)
RETURNS TABLE (
  id uuid,
  ticket_id text,
  client text,
  title text,
  source text,
  status text,
  fu_priority text,
  assignee text,
  created_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_client text;
  v_title text;
  v_category text;
  v_source text;
  v_priority text;
  v_status_name text;
  v_status_id uuid;
  v_employee_id uuid;
  v_employee_name text;
  v_profile_name text;
  v_assignee text;
  v_created_by_name text;
  v_lead_id uuid;
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

  v_client := NULLIF(btrim(COALESCE(p_client, '')), '');
  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  v_category := NULLIF(btrim(COALESCE(p_category, '')), '');
  IF v_client IS NULL OR char_length(v_client) > 200
    OR v_title IS NULL OR char_length(v_title) > 200
    OR v_category IS NULL OR char_length(v_category) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_source := NULLIF(btrim(COALESCE(p_source, '')), '');
  IF v_source IS NOT NULL AND char_length(v_source) > 80 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_priority := NULLIF(btrim(COALESCE(p_fu_priority, '')), '');
  IF v_priority IS NOT NULL AND v_priority NOT IN ('High', 'Medium', 'Low', 'Please Follow Up') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_status_name := NULLIF(btrim(COALESCE(p_status, '')), '');
  IF v_status_name IS NOT NULL THEN
    IF lower(v_status_name) IN ('converted', 'closed', 'resolve') OR char_length(v_status_name) > 80 THEN
      RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
    END IF;
    SELECT ls.id
    INTO v_status_id
    FROM public.lead_statuses ls
    WHERE ls.is_active = true
      AND lower(btrim(ls.name)) = lower(v_status_name)
      AND (ls.organization_id = p_organization_id OR ls.organization_id IS NULL)
    ORDER BY (ls.organization_id IS NOT DISTINCT FROM p_organization_id) DESC, ls.sort_order ASC NULLS LAST
    LIMIT 1;
    IF v_status_id IS NULL THEN
      RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT employee.id, NULLIF(btrim(employee.full_name), '')
  INTO v_employee_id, v_employee_name
  FROM public.employees employee
  WHERE employee.user_id = p_user_id
    AND employee.organization_id = p_organization_id
  ORDER BY employee.id ASC
  LIMIT 1;

  SELECT NULLIF(btrim(profile.full_name), '')
  INTO v_profile_name
  FROM public.profiles profile
  WHERE profile.user_id = p_user_id
  LIMIT 1;

  v_assignee := COALESCE(v_employee_name, v_profile_name, 'Unknown');
  v_created_by_name := COALESCE(v_profile_name, v_employee_name, 'Unknown');

  INSERT INTO public.leads AS lead (
    client,
    title,
    category,
    assignee,
    assignee_id,
    fu_priority,
    source,
    status_id,
    organization_id,
    created_by,
    created_by_name,
    followup
  )
  VALUES (
    v_client,
    v_title,
    v_category,
    v_assignee,
    v_employee_id,
    COALESCE(v_priority, 'Please Follow Up'),
    COALESCE(v_source, 'Website'),
    v_status_id,
    p_organization_id,
    p_user_id,
    v_created_by_name,
    0
  )
  RETURNING lead.id INTO v_lead_id;

  RETURN QUERY
  SELECT
    lead.id,
    lead.ticket_id,
    lead.client,
    lead.title,
    lead.source,
    ls.name,
    lead.fu_priority,
    lead.assignee,
    lead.created_at
  FROM public.leads lead
  LEFT JOIN public.lead_statuses ls ON ls.id = lead.status_id
  WHERE lead.id = v_lead_id;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_update_lead(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_client text,
  p_title text,
  p_category text,
  p_source text,
  p_fu_priority text
)
RETURNS TABLE (
  id uuid,
  ticket_id text,
  client text,
  title text,
  source text,
  status text,
  fu_priority text,
  assignee text,
  created_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_client text;
  v_title text;
  v_category text;
  v_source text;
  v_priority text;
  v_saved_id uuid;
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

  v_client := NULLIF(btrim(COALESCE(p_client, '')), '');
  IF p_client IS NOT NULL AND (v_client IS NULL OR char_length(v_client) > 200) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  IF p_title IS NOT NULL AND (v_title IS NULL OR char_length(v_title) > 200) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_category := NULLIF(btrim(COALESCE(p_category, '')), '');
  IF p_category IS NOT NULL AND (v_category IS NULL OR char_length(v_category) > 200) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_source := NULLIF(btrim(COALESCE(p_source, '')), '');
  IF p_source IS NOT NULL AND (v_source IS NULL OR char_length(v_source) > 80) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_priority := NULLIF(btrim(COALESCE(p_fu_priority, '')), '');
  IF v_priority IS NOT NULL AND v_priority NOT IN ('High', 'Medium', 'Low', 'Please Follow Up') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_client IS NULL AND v_title IS NULL AND v_category IS NULL AND v_source IS NULL AND v_priority IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  UPDATE public.leads AS lead
  SET
    client = COALESCE(v_client, lead.client),
    title = COALESCE(v_title, lead.title),
    category = COALESCE(v_category, lead.category),
    source = COALESCE(v_source, lead.source),
    fu_priority = COALESCE(v_priority, lead.fu_priority),
    updated_at = now()
  WHERE lead.id = p_id
    AND lead.organization_id = p_organization_id
  RETURNING lead.id INTO v_saved_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    lead.id,
    lead.ticket_id,
    lead.client,
    lead.title,
    lead.source,
    ls.name,
    lead.fu_priority,
    lead.assignee,
    lead.created_at
  FROM public.leads lead
  LEFT JOIN public.lead_statuses ls ON ls.id = lead.status_id
  WHERE lead.id = v_saved_id;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_create_content_plan(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_content_plan(uuid, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_content_plan(uuid, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_update_content_plan(uuid, uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_update_content_plan(uuid, uuid, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_content_plan(uuid, uuid, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_company_objective(uuid, uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_company_objective(uuid, uuid, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_company_objective(uuid, uuid, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_update_objective(uuid, uuid, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_update_objective(uuid, uuid, text, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_objective(uuid, uuid, text, uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_lead(uuid, uuid, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_lead(uuid, uuid, text, text, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_lead(uuid, uuid, text, text, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_update_lead(uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_update_lead(uuid, uuid, uuid, text, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_lead(uuid, uuid, uuid, text, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
