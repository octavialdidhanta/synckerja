-- Content Plan Carousel. thinking.plan.save yang membawa slide menyimpan
-- papan cerita, caption, tipe carousel, dan rasio 4:5. Payload tanpa slide tetap.

CREATE OR REPLACE FUNCTION public.ai_employee_carousel_fields(
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
  v_count integer;
  v_index integer;
  v_slide jsonb;
  v_timing text;
  v_visual text;
  v_vo text;
  v_element text;
  v_tagging text;
  v_lines text[] := ARRAY[
    '| Timing | Visual | VO (Voice Over) | Scene Visual | Element Lainnya | Tagging |',
    '| --- | --- | --- | --- | --- | --- |'
  ];
  v_caption text;
  v_type uuid;
  v_brief text;
BEGIN
  IF jsonb_typeof(p_payload->'slides') <> 'array' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_count := jsonb_array_length(p_payload->'slides');
  IF v_count < 5 OR v_count > 8 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_caption := NULLIF(btrim(COALESCE(p_payload->>'caption', '')), '');
  IF v_caption IS NULL OR char_length(v_caption) > 400 OR position('#' IN v_caption) = 0 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  FOR v_index IN 0 .. v_count - 1 LOOP
    v_slide := p_payload->'slides'->v_index;
    v_timing := regexp_replace(btrim(COALESCE(v_slide->>'timing', '')), '\s+', ' ', 'g');
    v_visual := left(regexp_replace(replace(btrim(COALESCE(v_slide->>'visual', '')), '|', '/'), '\s+', ' ', 'g'), 500);
    v_vo := left(regexp_replace(replace(btrim(COALESCE(v_slide->>'vo', '')), '|', '/'), '\s+', ' ', 'g'), 500);
    v_element := left(regexp_replace(replace(btrim(COALESCE(v_slide->>'element', '')), '|', '/'), '\s+', ' ', 'g'), 500);
    v_tagging := left(regexp_replace(replace(btrim(COALESCE(v_slide->>'tagging', '')), '|', '/'), '\s+', ' ', 'g'), 500);
    IF v_timing IS DISTINCT FROM ('Slide ' || (v_index + 1)::text) OR v_visual = '' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_lines := v_lines || format(
      '| %s |  | %s | %s | %s | %s |',
      v_timing, v_vo, v_visual, v_element, v_tagging
    );
  END LOOP;

  v_brief := array_to_string(v_lines, E'\n') || E'\n\n'
    || format(
      '<!--synckerja-brief-sequences:%s-->',
      jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid(),
        'name', 'Carousel',
        'rowCount', v_count
      ))::text
    );

  SELECT ct.id
  INTO v_type
  FROM public.content_types ct
  WHERE COALESCE(ct.is_active, true)
    AND (ct.organization_id = p_organization_id OR ct.organization_id IS NULL)
    AND lower(btrim(ct.name)) = 'carousel'
  ORDER BY (ct.organization_id IS NOT DISTINCT FROM p_organization_id) DESC, ct.id
  LIMIT 1;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'carousel_type_missing' USING ERRCODE = 'P0002';
  END IF;

  brief := v_brief;
  caption := v_caption;
  content_type_id := v_type;
  concept := jsonb_build_object(
    'v', 1,
    'postAspect', '4:5',
    'locations', '[]'::jsonb,
    'characters', '[]'::jsonb,
    'properties', '[]'::jsonb
  )::text;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_employee_carousel_fields(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

DO $patch$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_perform(uuid, uuid, text, jsonb)'::regprocedure),
    E'\r\n',
    E'\n'
  );
  old_declare text := $old$  v_fields text[];$old$;
  new_declare text := $new$  v_fields text[];
  v_carousel_brief text;
  v_carousel_caption text;
  v_carousel_type uuid;
  v_carousel_concept text;$new$;
  old_insert text := $old$    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,
      product_knowledge_id, product_knowledge_fields, author_employee_id, production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,
      v_product, v_fields, p_employee_id, 'Need Review', false, false, 'draft'
    )
    RETURNING id INTO v_id;$old$;
  new_insert text := $new$    IF jsonb_typeof(v_payload->'slides') = 'array' THEN
      IF p_action <> 'thinking.plan.save' OR v_execution IS NULL THEN
        RAISE EXCEPTION 'execution_not_passed' USING ERRCODE = '42501';
      END IF;
      SELECT packed.brief, packed.caption, packed.content_type_id, packed.concept
      INTO v_carousel_brief, v_carousel_caption, v_carousel_type, v_carousel_concept
      FROM public.ai_employee_carousel_fields(v_org, v_payload) AS packed;
      v_brief := v_carousel_brief;
    END IF;

    INSERT INTO public.social_media_plans (
      organization_id, title, brief, post_date, content_pillar_id, service_id, thinking_idea_id,
      product_knowledge_id, product_knowledge_fields, author_employee_id, content_type_id,
      production_status, approved, production_approved, status
    ) VALUES (
      v_org, v_title, v_brief, v_post, v_pillar, v_service, v_idea,
      v_product, v_fields, p_employee_id, v_carousel_type, 'Need Review', false, false, 'draft'
    )
    RETURNING id INTO v_id;

    IF v_carousel_type IS NOT NULL THEN
      INSERT INTO public.brief_captions (social_media_plan_id, content)
      VALUES (v_id, v_carousel_caption);
      INSERT INTO public.brief_target_audiences (social_media_plan_id, description)
      VALUES (v_id, v_carousel_concept);
    END IF;$new$;
BEGIN
  IF position(old_declare IN def) = 0 OR position(old_insert IN def) = 0 THEN
    RAISE EXCEPTION 'perform snippet missing';
  END IF;
  def := replace(def, old_declare, new_declare);
  def := replace(def, old_insert, new_insert);
  EXECUTE def;
END;
$patch$;

COMMENT ON FUNCTION public.ai_employee_carousel_fields(uuid, jsonb) IS
  'Menyusun brief carousel 5-8 slide, caption berhashtag, tipe carousel, dan rasio 4:5.';
