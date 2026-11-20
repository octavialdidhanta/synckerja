-- Catalog names must be text. product_knowledge_features.feature_name is varchar,
-- and RETURN QUERY rejects that mismatch.
-- A connector-created plan also gets the signed-in member as PIC, so a later
-- brief edit is allowed. A plan that still has no PIC is assigned on the first
-- brief edit by that member.

CREATE OR REPLACE FUNCTION public.mcp_list_content_catalog(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  kind text,
  id uuid,
  name text,
  service_id uuid,
  sub_service_id uuid
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
  SELECT
    'type'::text,
    picked.id,
    picked.name::text,
    NULL::uuid,
    NULL::uuid
  FROM (
    SELECT ct.id, ct.name
    FROM public.content_types ct
    WHERE COALESCE(ct.is_active, true) = true
      AND (ct.organization_id = p_organization_id OR ct.organization_id IS NULL)
    ORDER BY ct.name ASC, ct.id ASC
    LIMIT 100
  ) picked;

  RETURN QUERY
  SELECT
    'service'::text,
    picked.id,
    picked.name::text,
    NULL::uuid,
    NULL::uuid
  FROM (
    SELECT svc.id, svc.name
    FROM public.services svc
    WHERE svc.organization_id = p_organization_id
      AND COALESCE(svc.is_active, true) = true
    ORDER BY svc.name ASC, svc.id ASC
    LIMIT 100
  ) picked;

  RETURN QUERY
  SELECT
    'sub_service'::text,
    picked.id,
    picked.name::text,
    picked.service_id,
    NULL::uuid
  FROM (
    SELECT sub.id, sub.name, sub.service_id
    FROM public.sub_services sub
    WHERE sub.organization_id = p_organization_id
      AND COALESCE(sub.is_active, true) = true
    ORDER BY sub.name ASC, sub.id ASC
    LIMIT 200
  ) picked;

  RETURN QUERY
  SELECT
    'feature'::text,
    picked.id,
    picked.feature_name::text,
    picked.service_id,
    picked.sub_service_id
  FROM (
    SELECT feat.id, feat.feature_name, feat.service_id, feat.sub_service_id
    FROM public.product_knowledge_features feat
    WHERE feat.organization_id = p_organization_id
    ORDER BY feat.feature_name ASC, feat.id ASC
    LIMIT 200
  ) picked;
END;
$mcp$;

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
  v_pic uuid;
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

  SELECT emp.id
  INTO v_pic
  FROM public.employees emp
  LEFT JOIN public.employee_statuses es ON es.id = emp.employee_status_id
  WHERE emp.organization_id = p_organization_id
    AND emp.user_id = p_user_id
    AND COALESCE(emp.pending_removal, false) = false
    AND lower(COALESCE(emp.status, 'active')) NOT IN ('inactive', 'terminated', 'resigned')
    AND lower(regexp_replace(COALESCE(es.name, ''), '[\s_]+', '', 'g'))
      NOT IN ('inactive', 'terminated', 'pendingremoval')
  ORDER BY emp.id ASC
  LIMIT 1;

  IF v_pic IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
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
    post_date,
    pic_id
  )
  VALUES (
    p_organization_id,
    v_title,
    v_brief,
    v_post_date,
    v_pic
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
  v_pic uuid;
  v_existing_pic uuid;
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

  IF v_brief IS NOT NULL THEN
    SELECT plan.pic_id
    INTO v_existing_pic
    FROM public.social_media_plans plan
    WHERE plan.id = p_id
      AND plan.organization_id = p_organization_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;

    IF v_existing_pic IS NULL THEN
      SELECT emp.id
      INTO v_pic
      FROM public.employees emp
      LEFT JOIN public.employee_statuses es ON es.id = emp.employee_status_id
      WHERE emp.organization_id = p_organization_id
        AND emp.user_id = p_user_id
        AND COALESCE(emp.pending_removal, false) = false
        AND lower(COALESCE(emp.status, 'active')) NOT IN ('inactive', 'terminated', 'resigned')
        AND lower(regexp_replace(COALESCE(es.name, ''), '[\s_]+', '', 'g'))
          NOT IN ('inactive', 'terminated', 'pendingremoval')
      ORDER BY emp.id ASC
      LIMIT 1;

      IF v_pic IS NULL THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
      END IF;

      UPDATE public.social_media_plans plan
      SET pic_id = v_pic
      WHERE plan.id = p_id
        AND plan.organization_id = p_organization_id
        AND plan.pic_id IS NULL;
    END IF;
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

REVOKE ALL ON FUNCTION public.mcp_list_content_catalog(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_content_catalog(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_content_catalog(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_content_plan(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_content_plan(uuid, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_content_plan(uuid, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_update_content_plan(uuid, uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_update_content_plan(uuid, uuid, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_content_plan(uuid, uuid, uuid, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
