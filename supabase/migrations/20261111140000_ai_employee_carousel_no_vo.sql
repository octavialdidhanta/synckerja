-- Carousel storyboard has on-slide text, not a voice-over column.

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
    '| Timing | Visual | Scene Visual | Teks | Element Lainnya | Tagging |',
    '| --- | --- | --- | --- | --- | --- |'
  ];
  v_caption text;
  v_reason text;
  v_type uuid;
  v_brief text;
BEGIN
  IF jsonb_typeof(p_payload->'slides') <> 'array' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_count := jsonb_array_length(p_payload->'slides');
  IF v_count < 2 OR v_count > 10 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_caption := NULLIF(btrim(COALESCE(p_payload->>'caption', '')), '');
  IF v_caption IS NULL OR char_length(v_caption) > 400 OR position('#' IN v_caption) = 0 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_reason := NULLIF(regexp_replace(btrim(COALESCE(p_payload->>'concept', '')), '\s+', ' ', 'g'), '');
  IF v_reason IS NULL OR char_length(v_reason) < 40 OR char_length(v_reason) > 800 THEN
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
      v_timing, v_visual, v_vo, v_element, v_tagging
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
    'reason', v_reason,
    'locations', '[]'::jsonb,
    'characters', '[]'::jsonb,
    'properties', '[]'::jsonb
  )::text;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.ai_employee_carousel_fields(uuid, jsonb) IS
  'Menyusun brief carousel tanpa kolom voice over: Scene Visual, Teks, Element Lainnya, caption, tipe carousel, dan alasan Concept.';

NOTIFY pgrst, 'reload schema';
