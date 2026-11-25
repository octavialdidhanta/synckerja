-- Applying an industry template replaces tags and product columns that belong
-- to another template. Keys the organization added by hand (not in any
-- template) stay. Scene kinds stay: every template uses the same set.
-- Tag answers for a removed tag go with the tag (ON DELETE CASCADE).
-- Product text in catalog_menu_fields stays, so switching back can show it again.

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
  v_tags integer := 0;
  v_fields integer := 0;
  v_kinds integer := 0;
  v_tags_removed integer := 0;
  v_fields_removed integer := 0;
BEGIN
  IF p_organization_id IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_industry_templates WHERE code = v_code) THEN
    RAISE EXCEPTION 'unknown_template' USING ERRCODE = '22023';
  END IF;

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
    'scene_kinds_upserted', v_kinds
  );
END;
$apply$;
