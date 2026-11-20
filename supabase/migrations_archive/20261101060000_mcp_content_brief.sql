-- Content catalog and structured brief create for the connector.
-- Membership is checked here. EXECUTE is service_role only.
-- Does not approve, schedule, upload, or publish.

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
    picked.name,
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
    picked.name,
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
    picked.name,
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
    picked.feature_name,
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

CREATE OR REPLACE FUNCTION public.mcp_create_content_brief(
  p_user_id uuid,
  p_organization_id uuid,
  p_title text,
  p_post_date text,
  p_content_type_id uuid,
  p_service_id uuid,
  p_sub_service_id uuid,
  p_feature_id uuid,
  p_brief text,
  p_concept text,
  p_caption text,
  p_post_aspect text
)
RETURNS TABLE (
  id uuid,
  title text,
  content_type_name text,
  service_name text,
  sub_service_name text,
  feature_name text,
  shot_count integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_title text;
  v_brief text;
  v_concept text;
  v_caption text;
  v_aspect text;
  v_day date;
  v_post_date timestamptz;
  v_pic uuid;
  v_type_name text;
  v_service_id uuid;
  v_service_name text;
  v_sub_id uuid;
  v_sub_name text;
  v_feature_id uuid;
  v_feature_name text;
  v_feature_service uuid;
  v_locked_sub uuid;
  v_shot_count integer;
  v_doc jsonb;
  v_plan public.social_media_plans%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_content_type_id IS NULL THEN
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

  SELECT ct.name
  INTO v_type_name
  FROM public.content_types ct
  WHERE ct.id = p_content_type_id
    AND COALESCE(ct.is_active, true) = true
    AND (ct.organization_id = p_organization_id OR ct.organization_id IS NULL);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF (p_sub_service_id IS NOT NULL OR p_feature_id IS NOT NULL) AND p_service_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_service_id IS NOT NULL THEN
    SELECT svc.id, svc.name
    INTO v_service_id, v_service_name
    FROM public.services svc
    WHERE svc.id = p_service_id
      AND svc.organization_id = p_organization_id
      AND COALESCE(svc.is_active, true) = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_sub_service_id IS NOT NULL THEN
    SELECT sub.id, sub.name
    INTO v_sub_id, v_sub_name
    FROM public.sub_services sub
    WHERE sub.id = p_sub_service_id
      AND sub.organization_id = p_organization_id
      AND sub.service_id = v_service_id
      AND COALESCE(sub.is_active, true) = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_feature_id IS NOT NULL THEN
    SELECT feat.feature_name, feat.service_id, feat.sub_service_id
    INTO v_feature_name, v_feature_service, v_locked_sub
    FROM public.product_knowledge_features feat
    WHERE feat.id = p_feature_id
      AND feat.organization_id = p_organization_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;

    IF v_feature_service IS NOT NULL AND v_feature_service IS DISTINCT FROM v_service_id THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    IF v_locked_sub IS NOT NULL THEN
      IF v_sub_id IS NOT NULL AND v_sub_id IS DISTINCT FROM v_locked_sub THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;

      SELECT sub.id, sub.name
      INTO v_sub_id, v_sub_name
      FROM public.sub_services sub
      WHERE sub.id = v_locked_sub
        AND sub.organization_id = p_organization_id
        AND sub.service_id = v_service_id
        AND COALESCE(sub.is_active, true) = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
      END IF;
    END IF;

    v_feature_id := p_feature_id;
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

  v_brief := NULLIF(btrim(COALESCE(p_brief, '')), '');
  IF v_brief IS NULL
    OR char_length(v_brief) > 20000
    OR position('| Timing | Visual | VO (Voice Over) |' IN v_brief) = 0
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer
  INTO v_shot_count
  FROM regexp_split_to_table(split_part(v_brief, '<!--', 1), E'\n') AS raw_line(line)
  WHERE btrim(line) LIKE '|%'
    AND btrim(line) NOT LIKE '| Timing | Visual | VO (Voice Over) |%'
    AND btrim(line) NOT LIKE '| ---%';

  IF v_shot_count < 1 OR v_shot_count > 30 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_aspect := NULLIF(btrim(COALESCE(p_post_aspect, '')), '');
  IF v_aspect IS NOT NULL AND v_aspect NOT IN ('4:5', '1:1') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_concept := NULLIF(btrim(COALESCE(p_concept, '')), '');
  IF v_concept IS NOT NULL AND (
    char_length(v_concept) > 20000
    OR left(v_concept, 6) <> '{"v":1'
    OR position('portraitPath' IN v_concept) > 0
    OR position('bodyPath' IN v_concept) > 0
    OR position('locationPath' IN v_concept) > 0
    OR position('propertyPath' IN v_concept) > 0
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_concept IS NOT NULL THEN
    BEGIN
      v_doc := v_concept::jsonb;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END;
    IF COALESCE(v_doc->>'v', '') <> '1' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_doc := v_doc - 'postAspect';
    IF lower(btrim(v_type_name)) IN ('post', 'carousel') AND v_aspect IS NOT NULL THEN
      v_doc := v_doc || jsonb_build_object('postAspect', v_aspect);
    END IF;
    v_concept := v_doc::text;
  ELSIF lower(btrim(v_type_name)) IN ('post', 'carousel') AND v_aspect IS NOT NULL THEN
    v_concept := jsonb_build_object(
      'v', 1,
      'postAspect', v_aspect,
      'locations', '[]'::jsonb,
      'characters', '[]'::jsonb,
      'properties', '[]'::jsonb
    )::text;
  END IF;

  v_caption := NULLIF(btrim(COALESCE(p_caption, '')), '');
  IF v_caption IS NOT NULL AND char_length(v_caption) > 2200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.social_media_plans (
    organization_id,
    title,
    brief,
    post_date,
    content_type_id,
    service_id,
    sub_service_id,
    feature_id,
    pic_id
  )
  VALUES (
    p_organization_id,
    v_title,
    v_brief,
    v_post_date,
    p_content_type_id,
    v_service_id,
    v_sub_id,
    v_feature_id,
    v_pic
  )
  RETURNING * INTO v_plan;

  IF v_caption IS NOT NULL THEN
    INSERT INTO public.brief_captions (social_media_plan_id, content)
    VALUES (v_plan.id, v_caption);
  END IF;

  IF v_concept IS NOT NULL THEN
    INSERT INTO public.brief_target_audiences (social_media_plan_id, description)
    VALUES (v_plan.id, v_concept);
  END IF;

  id := v_plan.id;
  title := v_plan.title;
  content_type_name := v_type_name;
  service_name := v_service_name;
  sub_service_name := v_sub_name;
  feature_name := v_feature_name;
  shot_count := v_shot_count;
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_list_content_catalog(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_content_catalog(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_content_catalog(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_content_brief(uuid, uuid, text, text, uuid, uuid, uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_content_brief(uuid, uuid, text, text, uuid, uuid, uuid, uuid, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_content_brief(uuid, uuid, text, text, uuid, uuid, uuid, uuid, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
