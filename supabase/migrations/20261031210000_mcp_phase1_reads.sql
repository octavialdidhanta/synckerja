-- Phase 1 MCP reads. Membership is checked here; EXECUTE is service_role only.

CREATE OR REPLACE FUNCTION public.mcp_list_content_calendar(
  p_user_id uuid,
  p_organization_id uuid,
  p_month text
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  END IF;
  IF v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'invalid_month' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.status,
    p.post_date,
    p.approved,
    p.production_status
  FROM public.social_media_plans p
  WHERE p.organization_id = p_organization_id
    AND p.post_date IS NOT NULL
    AND to_char(p.post_date AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') = v_month
  ORDER BY p.post_date ASC, p.id ASC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_okr_cycles(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  year integer,
  quarter text,
  period_type text,
  start_date date,
  end_date date,
  is_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    c.id,
    c.name,
    c.year,
    c.quarter::text,
    c.period_type::text,
    c.start_date,
    c.end_date,
    c.is_active
  FROM public.okr_cycles c
  WHERE c.organization_id = p_organization_id
  ORDER BY c.is_active DESC, c.start_date DESC NULLS LAST, c.id ASC
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_okr_objectives(
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
  owner_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    q.owner_name
  FROM (
    SELECT
      c.id,
      'company'::text AS level,
      c.title,
      c.status,
      c.progress_percentage::double precision AS progress_percentage,
      c.cycle_id,
      NULL::text AS owner_name,
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
      i.updated_at
    FROM public.individual_objectives i
    LEFT JOIN public.employees emp ON emp.id = i.employee_id
    WHERE i.organization_id = p_organization_id
      AND (p_cycle_id IS NULL OR i.cycle_id = p_cycle_id)
  ) q
  ORDER BY q.updated_at DESC, q.id ASC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_crm_leads(
  p_user_id uuid,
  p_organization_id uuid,
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
  SELECT
    l.id,
    l.ticket_id,
    l.client,
    l.title,
    l.source,
    ls.name,
    l.fu_priority,
    l.assignee,
    l.created_at
  FROM public.leads l
  LEFT JOIN public.lead_statuses ls ON ls.id = l.status_id
  WHERE l.organization_id = p_organization_id
    AND (v_status IS NULL OR lower(btrim(ls.name)) = v_status)
  ORDER BY l.created_at DESC, l.id ASC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_list_content_calendar(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_content_calendar(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_content_calendar(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_okr_cycles(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_okr_cycles(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_okr_cycles(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_okr_objectives(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_okr_objectives(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_okr_objectives(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_crm_leads(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_crm_leads(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_crm_leads(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
