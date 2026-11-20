-- Mirror katalog awal Story dari brief carousel bila masih kosong.
-- Juga perbarui payload agar baca kosong tetap menampilkan katalog carousel.

UPDATE public.ai_employee_story_briefs story
SET service_ids = ARRAY[carousel.service_ids[1]],
    updated_at = now()
FROM public.ai_employee_briefs carousel
WHERE carousel.employee_id = story.employee_id
  AND carousel.organization_id = story.organization_id
  AND cardinality(COALESCE(story.service_ids, '{}'::uuid[])) = 0
  AND cardinality(COALESCE(carousel.service_ids, '{}'::uuid[])) >= 1;

CREATE OR REPLACE FUNCTION public.ai_employee_story_brief_payload(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_row public.ai_employee_story_briefs%ROWTYPE;
  v_services uuid[];
  v_angles uuid[];
  v_pillars uuid[];
  v_color uuid;
  v_headline text;
  v_body text;
  v_auto boolean;
  v_found boolean := false;
BEGIN
  SELECT employee.organization_id
  INTO v_org
  FROM public.employees employee
  WHERE employee.id = p_employee_id
    AND COALESCE(employee.is_ai, false);
  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_row
  FROM public.ai_employee_story_briefs brief
  WHERE brief.employee_id = p_employee_id
    AND brief.organization_id = v_org;
  v_found := FOUND;

  IF v_found THEN
    v_services := COALESCE(v_row.service_ids, '{}'::uuid[]);
    v_angles := COALESCE(v_row.angle_ids, '{}'::uuid[]);
    v_pillars := COALESCE(v_row.pillar_ids, '{}'::uuid[]);
    v_color := v_row.brand_color_id;
    v_headline := COALESCE(v_row.headline_font, '');
    v_body := COALESCE(v_row.body_font, '');
    v_auto := COALESCE(v_row.story_auto_approve, true);
  ELSE
    v_services := '{}'::uuid[];
    v_angles := '{}'::uuid[];
    v_pillars := '{}'::uuid[];
    v_color := NULL;
    v_headline := '';
    v_body := '';
    v_auto := true;
  END IF;

  -- Katalog awal: mirror dari carousel jika Story belum punya katalog.
  IF cardinality(v_services) = 0 THEN
    SELECT CASE
      WHEN cardinality(COALESCE(carousel.service_ids, '{}'::uuid[])) >= 1
        THEN ARRAY[carousel.service_ids[1]]
      ELSE '{}'::uuid[]
    END
    INTO v_services
    FROM public.ai_employee_briefs carousel
    WHERE carousel.employee_id = p_employee_id
      AND carousel.organization_id = v_org;
    v_services := COALESCE(v_services, '{}'::uuid[]);
  END IF;

  RETURN jsonb_build_object(
    'service_ids', to_jsonb(v_services),
    'angle_ids', to_jsonb(v_angles),
    'pillar_ids', to_jsonb(v_pillars),
    'brand_color_id', v_color,
    'headline_font', v_headline,
    'body_font', v_body,
    'story_auto_approve', v_auto,
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', svc.id,
        'label', left(btrim(svc.name), 80)
      ) ORDER BY svc.name)
      FROM public.services svc
      WHERE svc.organization_id = v_org
        AND svc.id = ANY (v_services)
    ), '[]'::jsonb),
    'angles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', angle.id,
        'label', left(btrim(COALESCE(
          NULLIF(btrim(angle.statement), ''),
          NULLIF(btrim(angle.code), ''),
          angle.id::text
        )), 80)
      ) ORDER BY angle.code)
      FROM public.thinking_lab_angles angle
      WHERE angle.organization_id = v_org
        AND angle.id = ANY (v_angles)
    ), '[]'::jsonb),
    'pillars', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pillar.id,
        'label', left(btrim(pillar.name), 80)
      ) ORDER BY pillar.name)
      FROM public.content_pillars pillar
      WHERE pillar.id = ANY (v_pillars)
    ), '[]'::jsonb),
    'brand_colors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', color.id,
        'brand_name', COALESCE(color.brand_name, ''),
        'primary_color_hex', color.primary_color_hex,
        'secondary_color_hex', color.secondary_color_hex,
        'accent_color_hex', color.accent_color_hex
      ) ORDER BY color.created_at NULLS LAST, color.id)
      FROM public.digital_asset_brand_colors color
      WHERE color.organization_id = v_org
        AND (
          cardinality(v_services) = 0
          OR color.service_id = ANY (v_services)
          OR color.id = v_color
        )
    ), '[]'::jsonb)
  );
END;
$$;
