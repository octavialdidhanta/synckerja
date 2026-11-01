-- MCP Thinking Lab: read a locked passed Idea and its chain, store a passed
-- Execution, and save a draft content plan. Run once in the SQL editor.
-- Success with no rows means the functions compiled. Do not run twice.

INSERT INTO public.permission_configurations (
  organization_id,
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
SELECT
  org.id,
  '/thinking-lab',
  'Thinking Lab',
  true,
  ARRAY['owner', 'admin', 'hr', 'employee']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
FROM public.organizations org
WHERE NOT EXISTS (
  SELECT 1
  FROM public.permission_configurations existing
  WHERE existing.organization_id = org.id
    AND existing.page_path = '/thinking-lab'
);

CREATE OR REPLACE FUNCTION public.mcp_list_thinking_ideas(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  statement text,
  master_statement text,
  angle_statement text
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
    idea.id,
    left(btrim(idea.statement), 500),
    left(btrim(master.statement), 500),
    left(btrim(angle.statement), 500)
  FROM public.thinking_lab_ideas idea
  JOIN public.thinking_lab_angles angle
    ON angle.id = idea.angle_id
   AND angle.organization_id = idea.organization_id
  JOIN public.thinking_lab_territories territory
    ON territory.id = angle.territory_id
   AND territory.organization_id = idea.organization_id
  JOIN public.thinking_big_thoughts thought
    ON thought.id = territory.big_thought_id
   AND thought.organization_id = idea.organization_id
  JOIN public.thinking_master_thoughts master
    ON master.id = thought.master_thought_id
   AND master.organization_id = idea.organization_id
   AND master.workspace = 'thinking_lab'
  WHERE idea.organization_id = p_organization_id
    AND idea.status = 'locked'
    AND idea.validation->>'decision' = 'LOLOS'
  ORDER BY idea.updated_at DESC, idea.id DESC
  LIMIT 30;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_get_thinking_chain(
  p_user_id uuid,
  p_organization_id uuid,
  p_idea_id uuid
)
RETURNS TABLE (
  idea_id uuid,
  idea_statement text,
  master_statement text,
  master_subject text,
  big_thought_statement text,
  territory_statement text,
  angle_statement text,
  development_paths jsonb,
  pillars jsonb,
  executions jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_idea_id IS NULL THEN
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
    FROM public.thinking_lab_ideas idea
    JOIN public.thinking_lab_angles angle
      ON angle.id = idea.angle_id
     AND angle.organization_id = idea.organization_id
    JOIN public.thinking_lab_territories territory
      ON territory.id = angle.territory_id
     AND territory.organization_id = idea.organization_id
    JOIN public.thinking_big_thoughts thought
      ON thought.id = territory.big_thought_id
     AND thought.organization_id = idea.organization_id
    JOIN public.thinking_master_thoughts master
      ON master.id = thought.master_thought_id
     AND master.organization_id = idea.organization_id
     AND master.workspace = 'thinking_lab'
    WHERE idea.id = p_idea_id
      AND idea.organization_id = p_organization_id
      AND idea.status = 'locked'
      AND idea.validation->>'decision' = 'LOLOS'
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    idea.id,
    left(btrim(idea.statement), 8000),
    left(btrim(master.statement), 8000),
    NULLIF(left(btrim(COALESCE(master.canonical_semantic->>'subject', '')), 500), ''),
    left(btrim(thought.statement), 8000),
    left(btrim(territory.statement), 8000),
    left(btrim(angle.statement), 8000),
    COALESCE(idea.development_paths, '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pillar.id,
        'name', left(btrim(pillar.name), 200),
        'category', left(btrim(COALESCE(pillar.category, '')), 200),
        'description', left(btrim(COALESCE(pillar.description, '')), 2000)
      ) ORDER BY pillar.is_default DESC, pillar.name)
      FROM public.content_pillars pillar
      WHERE pillar.is_active = true
        AND (pillar.organization_id = p_organization_id OR pillar.is_default = true)
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ex.id,
        'pillar_name', left(btrim(COALESCE(ex.pillar_name, '')), 200),
        'title', left(btrim(COALESCE(ex.script->>'title', '')), 200),
        'admission', ex.admission,
        'canonical_semantic', ex.canonical_semantic,
        'line_issue_count', CASE
          WHEN jsonb_typeof(ex.script -> 'lineIssues') = 'array' THEN jsonb_array_length(ex.script -> 'lineIssues')
          ELSE 0
        END
      ) ORDER BY ex.updated_at DESC)
      FROM (
        SELECT ex_inner.*
        FROM public.thinking_lab_executions ex_inner
        WHERE ex_inner.organization_id = p_organization_id
          AND ex_inner.idea_id = idea.id
        ORDER BY ex_inner.updated_at DESC
        LIMIT 20
      ) ex
    ), '[]'::jsonb)
  FROM public.thinking_lab_ideas idea
  JOIN public.thinking_lab_angles angle
    ON angle.id = idea.angle_id
   AND angle.organization_id = idea.organization_id
  JOIN public.thinking_lab_territories territory
    ON territory.id = angle.territory_id
   AND territory.organization_id = idea.organization_id
  JOIN public.thinking_big_thoughts thought
    ON thought.id = territory.big_thought_id
   AND thought.organization_id = idea.organization_id
  JOIN public.thinking_master_thoughts master
    ON master.id = thought.master_thought_id
   AND master.organization_id = idea.organization_id
   AND master.workspace = 'thinking_lab'
  WHERE idea.id = p_idea_id
    AND idea.organization_id = p_organization_id
    AND idea.status = 'locked'
    AND idea.validation->>'decision' = 'LOLOS';
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_get_thinking_execution(
  p_user_id uuid,
  p_organization_id uuid,
  p_execution_id uuid
)
RETURNS TABLE (
  id uuid,
  idea_id uuid,
  content_pillar_id uuid,
  pillar_name text,
  script jsonb,
  canonical_semantic jsonb,
  admission text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_execution_id IS NULL THEN
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
    FROM public.thinking_lab_executions ex
    JOIN public.thinking_lab_ideas idea
      ON idea.id = ex.idea_id
     AND idea.organization_id = ex.organization_id
    WHERE ex.id = p_execution_id
      AND ex.organization_id = p_organization_id
      AND ex.creative_idea_id IS NULL
      AND idea.status = 'locked'
      AND idea.validation->>'decision' = 'LOLOS'
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    ex.id,
    ex.idea_id,
    ex.content_pillar_id,
    ex.pillar_name,
    ex.script,
    ex.canonical_semantic,
    ex.admission
  FROM public.thinking_lab_executions ex
  JOIN public.thinking_lab_ideas idea
    ON idea.id = ex.idea_id
   AND idea.organization_id = ex.organization_id
  WHERE ex.id = p_execution_id
    AND ex.organization_id = p_organization_id
    AND ex.creative_idea_id IS NULL
    AND idea.status = 'locked'
    AND idea.validation->>'decision' = 'LOLOS';
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_save_thinking_execution(
  p_user_id uuid,
  p_organization_id uuid,
  p_idea_id uuid,
  p_content_pillar_id uuid,
  p_statement text,
  p_script jsonb,
  p_facts jsonb,
  p_admission text
)
RETURNS TABLE (
  id uuid
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_pillar_name text;
  v_existing uuid;
  v_id uuid;
  v_statement text;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_idea_id IS NULL OR p_content_pillar_id IS NULL THEN
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
    FROM public.thinking_lab_ideas idea
    WHERE idea.id = p_idea_id
      AND idea.organization_id = p_organization_id
      AND idea.status = 'locked'
      AND idea.validation->>'decision' = 'LOLOS'
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT pillar.name
  INTO v_pillar_name
  FROM public.content_pillars pillar
  WHERE pillar.id = p_content_pillar_id
    AND pillar.is_active = true
    AND (pillar.organization_id = p_organization_id OR pillar.is_default = true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_statement := NULLIF(left(btrim(COALESCE(p_statement, '')), 20000), '');
  IF v_statement IS NULL
    OR p_admission IS DISTINCT FROM 'GENERATE_VALID'
    OR jsonb_typeof(p_script) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_facts) IS DISTINCT FROM 'object'
    OR COALESCE(p_facts->>'relationToParent', '') IS DISTINCT FROM 'VALID_EXECUTION'
    OR COALESCE(p_facts->>'resolution', '') IS DISTINCT FROM 'RESOLVED'
    OR position('portraitPath' IN p_script::text) > 0
    OR position('bodyPath' IN p_script::text) > 0
    OR position('sheetPath' IN p_script::text) > 0
    OR position('locationPath' IN p_script::text) > 0
    OR position('propertyPath' IN p_script::text) > 0
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT ex.id
  INTO v_existing
  FROM public.thinking_lab_executions ex
  WHERE ex.organization_id = p_organization_id
    AND ex.idea_id = p_idea_id
    AND ex.content_pillar_id = p_content_pillar_id
    AND ex.creative_idea_id IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.thinking_lab_executions ex
    SET pillar = p_content_pillar_id::text,
        pillar_name = v_pillar_name,
        statement = v_statement,
        script = p_script,
        canonical_semantic = p_facts || jsonb_build_object('pillar', v_pillar_name),
        admission = 'GENERATE_VALID'
    WHERE ex.id = v_existing
      AND ex.organization_id = p_organization_id
    RETURNING ex.id INTO v_id;
  ELSE
    INSERT INTO public.thinking_lab_executions (
      organization_id,
      idea_id,
      pillar,
      content_pillar_id,
      pillar_name,
      statement,
      script,
      canonical_semantic,
      admission
    )
    VALUES (
      p_organization_id,
      p_idea_id,
      p_content_pillar_id::text,
      p_content_pillar_id,
      v_pillar_name,
      v_statement,
      p_script,
      p_facts || jsonb_build_object('pillar', v_pillar_name),
      'GENERATE_VALID'
    )
    RETURNING thinking_lab_executions.id INTO v_id;
  END IF;

  id := v_id;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_create_thinking_plan(
  p_user_id uuid,
  p_organization_id uuid,
  p_title text,
  p_post_date text,
  p_content_type_id uuid,
  p_service_id uuid,
  p_sub_service_id uuid,
  p_feature_id uuid,
  p_content_pillar_id uuid,
  p_brief text,
  p_concept text,
  p_caption text
)
RETURNS TABLE (
  id uuid,
  title text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
#variable_conflict use_column
DECLARE
  v_pic uuid;
  v_title text;
  v_type_name text;
  v_service_id uuid;
  v_service_name text;
  v_sub_id uuid;
  v_sub_name text;
  v_feature_id uuid;
  v_feature_name text;
  v_feature_service uuid;
  v_locked_sub uuid;
  v_pillar_name text;
  v_post_date timestamp;
  v_day date;
  v_brief text;
  v_concept text;
  v_caption text;
  v_doc jsonb;
  v_shot_count integer;
  v_plan public.social_media_plans%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_content_type_id IS NULL OR p_content_pillar_id IS NULL THEN
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

  SELECT pillar.name
  INTO v_pillar_name
  FROM public.content_pillars pillar
  WHERE pillar.id = p_content_pillar_id
    AND pillar.is_active = true
    AND (pillar.organization_id = p_organization_id OR pillar.is_default = true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
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
    OR char_length(v_brief) > 200000
    OR position('| Timing | Visual | VO (Voice Over) |' IN v_brief) = 0
    OR position('| Shot |' IN v_brief) = 0
    OR position('Veo 3 prompt' IN v_brief) = 0
    OR position('Master prompt' IN v_brief) = 0
    OR position('portraitPath' IN v_brief) > 0
    OR position('bodyPath' IN v_brief) > 0
    OR position('sheetPath' IN v_brief) > 0
    OR position('locationPath' IN v_brief) > 0
    OR position('propertyPath' IN v_brief) > 0
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer
  INTO v_shot_count
  FROM regexp_split_to_table(split_part(v_brief, '<!--', 1), E'\n') AS raw_line(line)
  WHERE btrim(line) LIKE '|%'
    AND btrim(line) NOT LIKE '| Timing | Visual | VO (Voice Over) |%'
    AND btrim(line) NOT LIKE '| ---%';

  IF v_shot_count < 1 OR v_shot_count > 576 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_concept := NULLIF(btrim(COALESCE(p_concept, '')), '');
  IF v_concept IS NOT NULL AND (
    char_length(v_concept) > 20000
    OR left(v_concept, 6) <> '{"v":1'
    OR position('portraitPath' IN v_concept) > 0
    OR position('bodyPath' IN v_concept) > 0
    OR position('sheetPath' IN v_concept) > 0
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
    pic_id,
    content_pillar_id
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
    v_pic,
    p_content_pillar_id
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
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_list_thinking_ideas(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_thinking_ideas(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_thinking_ideas(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_get_thinking_chain(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_thinking_chain(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_thinking_chain(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_get_thinking_execution(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_thinking_execution(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_thinking_execution(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_save_thinking_execution(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_save_thinking_execution(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_save_thinking_execution(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_thinking_plan(uuid, uuid, text, text, uuid, uuid, uuid, uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_thinking_plan(uuid, uuid, text, text, uuid, uuid, uuid, uuid, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_thinking_plan(uuid, uuid, text, text, uuid, uuid, uuid, uuid, uuid, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
