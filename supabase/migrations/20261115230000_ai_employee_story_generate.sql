-- Fase 2 Design Story: packer Story + perform branch + manual begin + context + run_log.

CREATE OR REPLACE FUNCTION public.ai_employee_story_fields(
  p_organization_id uuid,
  p_payload jsonb
)
RETURNS TABLE (
  brief text,
  caption text,
  content_type_id uuid,
  concept text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caption text;
  v_reason text;
  v_visual text;
  v_headline text;
  v_type uuid;
  v_brief text;
  v_primary text;
  v_secondary text;
  v_accent text;
  v_color text := '';
  v_fonts text := '';
BEGIN
  IF COALESCE(p_payload->>'content_kind', '') IS DISTINCT FROM 'story' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_caption := NULLIF(btrim(COALESCE(p_payload->>'caption', '')), '');
  -- Story caption: shorter than feed carousel; hashtag optional.
  IF v_caption IS NULL OR char_length(v_caption) < 20 OR char_length(v_caption) > 500 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_reason := NULLIF(regexp_replace(btrim(COALESCE(p_payload->>'concept', '')), '\s+', ' ', 'g'), '');
  IF v_reason IS NULL OR char_length(v_reason) < 40 OR char_length(v_reason) > 800 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_visual := left(regexp_replace(replace(btrim(COALESCE(p_payload->>'visual', '')), '|', '/'), '\s+', ' ', 'g'), 800);
  IF v_visual = '' THEN
    v_visual := v_reason;
  END IF;
  v_headline := left(regexp_replace(replace(btrim(COALESCE(p_payload->>'headline', '')), '|', '/'), '\s+', ' ', 'g'), 200);

  v_primary := lower(btrim(COALESCE(p_payload #>> '{palette,primary}', '')));
  v_secondary := lower(btrim(COALESCE(p_payload #>> '{palette,secondary}', '')));
  v_accent := lower(btrim(COALESCE(p_payload #>> '{palette,accent}', '')));
  IF v_primary ~ '^#[0-9a-f]{6}$'
    AND v_secondary ~ '^#[0-9a-f]{6}$'
    AND v_accent ~ '^#[0-9a-f]{6}$'
  THEN
    v_color := format(
      E'\nWarna: primer %s, sekunder %s, aksen %s',
      v_primary, v_secondary, v_accent
    );
  END IF;

  IF NULLIF(btrim(COALESCE(p_payload->>'headline_font', '')), '') IS NOT NULL
     OR NULLIF(btrim(COALESCE(p_payload->>'body_font', '')), '') IS NOT NULL
  THEN
    v_fonts := format(
      E'\nFont: headline %s, body %s',
      COALESCE(NULLIF(btrim(p_payload->>'headline_font'), ''), 'Default'),
      COALESCE(NULLIF(btrim(p_payload->>'body_font'), ''), 'Default')
    );
  END IF;

  v_brief := format(
    E'Format: Instagram Story 9:16 (satu frame)\nHeadline: %s\nVisual: %s\nConcept: %s%s%s\n\n<!--synckerja-brief-sequences:%s-->',
    COALESCE(NULLIF(v_headline, ''), '—'),
    v_visual,
    v_reason,
    v_color,
    v_fonts,
    jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Story',
      'rowCount', 1
    ))::text
  );

  SELECT ct.id
  INTO v_type
  FROM public.content_types ct
  WHERE COALESCE(ct.is_active, true)
    AND (ct.organization_id = p_organization_id OR ct.organization_id IS NULL)
    AND lower(btrim(ct.name)) = 'story'
  ORDER BY (ct.organization_id IS NOT DISTINCT FROM p_organization_id) DESC, ct.id
  LIMIT 1;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'story_type_missing' USING ERRCODE = 'P0002';
  END IF;

  brief := v_brief;
  caption := v_caption;
  content_type_id := v_type;
  concept := jsonb_build_object(
    'v', 1,
    'postAspect', '9:16',
    'reason', v_reason,
    'locations', '[]'::jsonb,
    'characters', '[]'::jsonb,
    'properties', '[]'::jsonb
  )::text;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_story_fields(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_story_fields(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.ai_employee_story_fields(uuid, jsonb) IS
  'Pack Design Story plan fields (9:16). Terpisah dari ai_employee_carousel_fields.';

CREATE OR REPLACE FUNCTION public.ai_employee_sop4_manual_begin(p_user_id uuid, p_employee_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_active boolean;
  v_performance text;
  v_run uuid;
BEGIN
  SELECT employee.organization_id, profile.is_active, profile.performance_status
  INTO v_org, v_active, v_performance
  FROM public.employees employee
  LEFT JOIN public.ai_employee_profiles profile
    ON profile.employee_id = employee.id
   AND profile.organization_id = employee.organization_id
  WHERE employee.id = p_employee_id
    AND COALESCE(employee.is_ai, false)
  FOR UPDATE OF employee;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.ai_employee_require_owner(p_user_id, v_org);

  IF v_active IS NOT TRUE OR v_performance = 'disabled' THEN
    RAISE EXCEPTION 'profile_inactive' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_employee_runs run
    WHERE run.employee_id = p_employee_id
      AND run.organization_id = v_org
      AND run.sop_code = 'SOP4'
      AND run.status = 'running'
  ) THEN
    RAISE EXCEPTION 'too_soon' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ai_employee_runs (employee_id, organization_id, sop_code, status, note, trigger_source)
  VALUES (p_employee_id, v_org, 'SOP4', 'running', 'manual', 'manual')
  RETURNING id INTO v_run;

  RETURN v_run;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_sop4_manual_begin(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_employee_sop4_manual_begin(uuid, uuid) TO ai_employee_runner;

COMMENT ON FUNCTION public.ai_employee_sop4_manual_begin(uuid, uuid) IS
  'Owner memulai run Design Story (SOP4) manual. Guard running per SOP4.';

-- Patch perform: story branch before slides + story_auto_approve.
DO $perform$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_perform(uuid, uuid, text, jsonb)'::regprocedure),
    E'\r\n',
    E'\n'
  );
  old_slides text := $old$    IF jsonb_typeof(v_payload->'slides') = 'array' THEN
      IF p_action <> 'thinking.plan.save' OR v_execution IS NULL THEN
        RAISE EXCEPTION 'execution_not_passed' USING ERRCODE = '42501';
      END IF;
      SELECT packed.brief, packed.caption, packed.content_type_id, packed.concept
      INTO v_carousel_brief, v_carousel_caption, v_carousel_type, v_carousel_concept
      FROM public.ai_employee_carousel_fields(v_org, v_payload) AS packed;
      v_brief := v_carousel_brief;
    END IF;$old$;
  new_slides text := $new$    IF COALESCE(v_payload->>'content_kind', '') = 'story' THEN
      IF p_action <> 'thinking.plan.save' OR v_execution IS NULL THEN
        RAISE EXCEPTION 'execution_not_passed' USING ERRCODE = '42501';
      END IF;
      SELECT packed.brief, packed.caption, packed.content_type_id, packed.concept
      INTO v_carousel_brief, v_carousel_caption, v_carousel_type, v_carousel_concept
      FROM public.ai_employee_story_fields(v_org, v_payload) AS packed;
      v_brief := v_carousel_brief;
    ELSIF jsonb_typeof(v_payload->'slides') = 'array' THEN
      IF p_action <> 'thinking.plan.save' OR v_execution IS NULL THEN
        RAISE EXCEPTION 'execution_not_passed' USING ERRCODE = '42501';
      END IF;
      SELECT packed.brief, packed.caption, packed.content_type_id, packed.concept
      INTO v_carousel_brief, v_carousel_caption, v_carousel_type, v_carousel_concept
      FROM public.ai_employee_carousel_fields(v_org, v_payload) AS packed;
      v_brief := v_carousel_brief;
    END IF;$new$;
  old_auto text := $old$    IF v_service IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.ai_employee_briefs brief
      WHERE brief.employee_id = p_employee_id
        AND brief.organization_id = v_org
        AND brief.content_plan_auto_approve IS TRUE
    ) THEN
      UPDATE public.social_media_plans
      SET approved = true,
          status = 'Approved',
          completion_date = now()
      WHERE id = v_id
        AND approved IS NOT TRUE;
    END IF;$old$;
  new_auto text := $new$    IF v_service IS NOT NULL AND (
      (
        COALESCE(v_payload->>'content_kind', '') = 'story'
        AND EXISTS (
          SELECT 1
          FROM public.ai_employee_story_briefs story_brief
          WHERE story_brief.employee_id = p_employee_id
            AND story_brief.organization_id = v_org
            AND story_brief.story_auto_approve IS TRUE
        )
      )
      OR (
        COALESCE(v_payload->>'content_kind', '') IS DISTINCT FROM 'story'
        AND EXISTS (
          SELECT 1
          FROM public.ai_employee_briefs brief
          WHERE brief.employee_id = p_employee_id
            AND brief.organization_id = v_org
            AND brief.content_plan_auto_approve IS TRUE
        )
      )
    ) THEN
      UPDATE public.social_media_plans
      SET approved = true,
          status = 'Approved',
          completion_date = now()
      WHERE id = v_id
        AND approved IS NOT TRUE;
    END IF;$new$;
BEGIN
  IF position(old_slides IN def) = 0 THEN
    RAISE EXCEPTION 'story perform slides snippet missing';
  END IF;
  IF position(old_auto IN def) = 0 THEN
    RAISE EXCEPTION 'story perform auto-approve snippet missing';
  END IF;
  def := replace(def, old_slides, new_slides);
  def := replace(def, old_auto, new_auto);
  EXECUTE def;
END;
$perform$;

-- Context scope story_brief.
DO $context$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_context(uuid, uuid, text, jsonb)'::regprocedure),
    E'\r\n',
    E'\n'
  );
  old_scope text := $old$IF p_scope NOT IN ('plans', 'calendar', 'catalog', 'pillars', 'thinking', 'feedback', 'tasks', 'brief', 'performance', 'product', 'carousel_paths') THEN$old$;
  new_scope text := $new$IF p_scope NOT IN ('plans', 'calendar', 'catalog', 'pillars', 'thinking', 'feedback', 'tasks', 'brief', 'performance', 'product', 'carousel_paths', 'story_brief') THEN$new$;
  old_paths text := $old$  ELSIF p_scope = 'carousel_paths' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(path) ORDER BY path.queue_order), '[]'::jsonb)
    INTO v_rows
    FROM public.ai_employee_carousel_paths(p_employee_id) path;
  ELSE$old$;
  new_paths text := $new$  ELSIF p_scope = 'carousel_paths' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(path) ORDER BY path.queue_order), '[]'::jsonb)
    INTO v_rows
    FROM public.ai_employee_carousel_paths(p_employee_id) path;
  ELSIF p_scope = 'story_brief' THEN
    SELECT jsonb_build_array(public.ai_employee_story_brief_payload(p_employee_id)) INTO v_rows;
  ELSE$new$;
BEGIN
  IF position(old_scope IN def) = 0 OR position(old_paths IN def) = 0 THEN
    RAISE EXCEPTION 'story_brief context snippet missing';
  END IF;
  def := replace(def, old_scope, new_scope);
  def := replace(def, old_paths, new_paths);
  EXECUTE def;
END;
$context$;

-- Run log includes SOP4.
DO $runlog$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_run_log(uuid, date)'::regprocedure),
    E'\r\n',
    E'\n'
  );
  old_filter text := $$run.sop_code IN ('SOP1', 'SOP2', 'SOP3')$$;
  new_filter text := $$run.sop_code IN ('SOP1', 'SOP2', 'SOP3', 'SOP4')$$;
BEGIN
  IF position(old_filter IN def) = 0 THEN
    RAISE EXCEPTION 'run_log SOP filter snippet missing';
  END IF;
  def := replace(def, old_filter, new_filter);
  EXECUTE def;
END;
$runlog$;
