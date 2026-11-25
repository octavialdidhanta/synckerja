-- Switching industry clears product column text. A shared key such as main
-- must not keep a sentence written for the previous industry.
-- Applying the same template again keeps the text.
-- The electronics pilot product is removed on a switch, and also now when
-- Synckerja Office is already on another industry.

UPDATE public.catalog_industry_template_menu_fields
SET label = CASE field_key
  WHEN 'main' THEN 'Hidangan utama'
  WHEN 'topping' THEN 'Topping khas'
  WHEN 'garnish' THEN 'Pelengkap'
  WHEN 'presentation' THEN 'Penyajian'
  WHEN 'sauce' THEN 'Saus'
  WHEN 'larangan' THEN 'Larangan'
  WHEN 'khusus' THEN 'Aturan khusus'
  ELSE label
END
WHERE template_code = 'fnb'
  AND field_key IN ('main', 'topping', 'garnish', 'presentation', 'sauce', 'larangan', 'khusus');

UPDATE public.catalog_menu_field_defs AS d
SET label = f.label,
    updated_at = now()
FROM public.catalog_industry_template_menu_fields AS f
JOIN public.organization_catalog_settings AS s
  ON s.industry_template_code = f.template_code
WHERE f.template_code = 'fnb'
  AND d.organization_id = s.organization_id
  AND d.field_key = f.field_key
  AND d.label IS DISTINCT FROM f.label;

DELETE FROM public.catalog_menus AS m
USING public.organization_catalog_settings AS s
WHERE m.organization_id = s.organization_id
  AND m.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND m.external_id = 'powerbank-20000'
  AND s.industry_template_code <> 'electronics';

CREATE OR REPLACE FUNCTION public.catalog_apply_industry_template_internal(
  p_organization_id uuid,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $apply$
DECLARE
  v_code text := lower(btrim(COALESCE(p_code, '')));
  v_previous text;
  v_tags integer := 0;
  v_fields integer := 0;
  v_kinds integer := 0;
  v_tags_removed integer := 0;
  v_fields_removed integer := 0;
  v_bodies_cleared integer := 0;
  v_layar_slug text;
BEGIN
  IF p_organization_id IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_industry_templates WHERE code = v_code) THEN
    RAISE EXCEPTION 'unknown_template' USING ERRCODE = '22023';
  END IF;

  SELECT s.industry_template_code
  INTO v_previous
  FROM public.organization_catalog_settings s
  WHERE s.organization_id = p_organization_id;

  INSERT INTO public.footage_tag_defs (organization_id, key, label, applies_to, value_type, position)
  SELECT p_organization_id, t.key, t.label, t.applies_to, t.value_type, t.position
  FROM public.catalog_industry_template_tags t
  WHERE t.template_code = v_code
  ON CONFLICT (organization_id, key) DO UPDATE
    SET label = EXCLUDED.label,
        applies_to = EXCLUDED.applies_to,
        value_type = EXCLUDED.value_type,
        position = EXCLUDED.position,
        updated_at = now();
  GET DIAGNOSTICS v_tags = ROW_COUNT;

  DELETE FROM public.footage_tag_defs d
  WHERE d.organization_id = p_organization_id
    AND d.key NOT IN (
      SELECT t.key
      FROM public.catalog_industry_template_tags t
      WHERE t.template_code = v_code
    )
    AND d.key IN (
      SELECT t.key
      FROM public.catalog_industry_template_tags t
    );
  GET DIAGNOSTICS v_tags_removed = ROW_COUNT;

  INSERT INTO public.catalog_menu_field_defs (organization_id, field_key, label, position)
  SELECT p_organization_id, f.field_key, f.label, f.position
  FROM public.catalog_industry_template_menu_fields f
  WHERE f.template_code = v_code
  ON CONFLICT (organization_id, field_key) DO UPDATE
    SET label = EXCLUDED.label,
        position = EXCLUDED.position,
        updated_at = now();
  GET DIAGNOSTICS v_fields = ROW_COUNT;

  DELETE FROM public.catalog_menu_field_defs d
  WHERE d.organization_id = p_organization_id
    AND d.field_key NOT IN (
      SELECT f.field_key
      FROM public.catalog_industry_template_menu_fields f
      WHERE f.template_code = v_code
    )
    AND d.field_key IN (
      SELECT f.field_key
      FROM public.catalog_industry_template_menu_fields f
    );
  GET DIAGNOSTICS v_fields_removed = ROW_COUNT;

  INSERT INTO public.footage_scene_kind_defs (organization_id, key, label, position)
  SELECT p_organization_id, k.key, k.label, k.position
  FROM public.catalog_industry_template_scene_kinds k
  WHERE k.template_code = v_code
  ON CONFLICT (organization_id, key) DO UPDATE
    SET label = EXCLUDED.label,
        position = EXCLUDED.position,
        updated_at = now();
  GET DIAGNOSTICS v_kinds = ROW_COUNT;

  IF v_code = 'software' AND NOT EXISTS (
    SELECT 1
    FROM public.catalog_locations l
    WHERE l.organization_id = p_organization_id
      AND lower(btrim(l.label)) = 'layar'
  ) THEN
    v_layar_slug := CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.catalog_locations c
        WHERE c.organization_id = p_organization_id
          AND c.external_id = 'layar'
      ) THEN 'layar-rekaman'
      ELSE 'layar'
    END;
    INSERT INTO public.catalog_locations (organization_id, external_id, name, label)
    VALUES (p_organization_id, v_layar_slug, 'Layar', 'Layar');
  END IF;

  IF v_previous IS NOT NULL AND v_previous <> v_code THEN
    DELETE FROM public.catalog_menu_fields
    WHERE organization_id = p_organization_id;
    GET DIAGNOSTICS v_bodies_cleared = ROW_COUNT;

    DELETE FROM public.catalog_menus
    WHERE organization_id = p_organization_id
      AND external_id = 'powerbank-20000';
  END IF;

  INSERT INTO public.organization_catalog_settings (organization_id, industry_template_code, applied_at)
  VALUES (p_organization_id, v_code, now())
  ON CONFLICT (organization_id) DO UPDATE
    SET industry_template_code = EXCLUDED.industry_template_code,
        applied_at = now(),
        updated_at = now();

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'industry_template_code', v_code,
    'tags_upserted', v_tags,
    'tags_removed', v_tags_removed,
    'menu_fields_upserted', v_fields,
    'menu_fields_removed', v_fields_removed,
    'menu_bodies_cleared', v_bodies_cleared,
    'scene_kinds_upserted', v_kinds
  );
END;
$apply$;
