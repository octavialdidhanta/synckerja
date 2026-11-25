-- Short location labels are what footage and Anthropic store (PIK1, PIK2, Layar).
-- The location title stays the longer catalog name. Several titles may share one label.
-- Does not switch any organization's industry template and does not rewrite clips.

ALTER TABLE public.catalog_locations
  ADD COLUMN label text;

COMMENT ON COLUMN public.catalog_locations.label IS
  'Short footage label, such as PIK1 or Layar. Several catalog rows may share one label.';

-- A title that starts with a footage label takes that label. Longest label wins.
UPDATE public.catalog_locations AS loc
SET label = picked.label
FROM (
  SELECT DISTINCT ON (l2.id)
    l2.id,
    btrim(a.location_label) AS label
  FROM public.catalog_locations l2
  JOIN public.footage_assets a
    ON a.organization_id = l2.organization_id
   AND a.deleted_at IS NULL
   AND COALESCE(btrim(a.location_label), '') NOT IN ('', '?')
   AND (
     lower(l2.name) = lower(btrim(a.location_label))
     OR left(lower(l2.name), char_length(btrim(a.location_label)) + 1) = lower(btrim(a.location_label)) || ' '
   )
  ORDER BY l2.id, char_length(btrim(a.location_label)) DESC
) AS picked
WHERE loc.id = picked.id
  AND loc.label IS NULL;

UPDATE public.catalog_locations
SET label = left(btrim(name), 80)
WHERE label IS NULL OR btrim(label) = '';

-- Footage labels that have no catalog row yet (PIK2, Office Desk) become a location.
INSERT INTO public.catalog_locations (organization_id, external_id, name, label)
SELECT
  s.organization_id,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.catalog_locations c
      WHERE c.organization_id = s.organization_id
        AND c.external_id = s.base
    ) THEN left(s.base, 60) || '-' || substr(md5(s.organization_id::text || s.label), 1, 8)
    ELSE s.base
  END,
  s.label,
  s.label
FROM (
  SELECT DISTINCT
    a.organization_id,
    btrim(a.location_label) AS label,
    left(
      trim(both '-' FROM regexp_replace(regexp_replace(lower(btrim(a.location_label)), '[^a-z0-9]+', '-', 'g'), '-{2,}', '-', 'g')),
      72
    ) AS base
  FROM public.footage_assets a
  WHERE a.deleted_at IS NULL
    AND COALESCE(btrim(a.location_label), '') NOT IN ('', '?')
    AND NOT EXISTS (
      SELECT 1
      FROM public.catalog_locations l
      WHERE l.organization_id = a.organization_id
        AND lower(btrim(l.label)) = lower(btrim(a.location_label))
    )
) s
WHERE s.base ~ '^[a-z0-9]+(-[a-z0-9]+)*$';

ALTER TABLE public.catalog_locations
  ALTER COLUMN label SET NOT NULL;

ALTER TABLE public.catalog_locations
  ADD CONSTRAINT catalog_locations_label_check CHECK (
    char_length(btrim(label)) > 0
    AND char_length(label) <= 80
    AND btrim(label) <> '?'
  );

CREATE INDEX catalog_locations_org_label_idx
  ON public.catalog_locations (organization_id, label);

-- ---------------------------------------------------------------------------
-- Software template. Same scene kinds as the other packs. Not applied here.
-- ---------------------------------------------------------------------------

INSERT INTO public.catalog_industry_templates (code, label, description, position)
VALUES ('software', 'Perangkat lunak', 'SaaS, aplikasi, ERP', 6);

INSERT INTO public.catalog_industry_template_menu_fields (template_code, field_key, label, position) VALUES
  ('software', 'main', 'Apa yang ditawarkan', 1),
  ('software', 'screen', 'Layar yang harus terlihat', 2),
  ('software', 'audience', 'Untuk siapa', 3),
  ('software', 'larangan', 'Larangan (must NOT)', 4),
  ('software', 'khusus', 'Aturan khusus', 5);

INSERT INTO public.catalog_industry_template_tags (template_code, key, label, applies_to, value_type, position) VALUES
  ('software', 'watermark_ui', 'Watermark/UI', 'scene', 'bool', 1),
  ('software', 'screen_visible', 'Layar terlihat', 'scene', 'bool', 2),
  ('software', 'face_visible', 'Wajah orang', 'scene', 'bool', 3),
  ('software', 'screen_recording', 'Rekaman layar', 'scene', 'bool', 4);

INSERT INTO public.catalog_industry_template_scene_kinds (template_code, key, label, position)
SELECT 'software', k.key, k.label, k.position
FROM public.catalog_industry_template_scene_kinds k
WHERE k.template_code = 'fnb';

-- ---------------------------------------------------------------------------
-- Apply still replaces another industry's tags and columns.
-- Software also makes sure the short label Layar exists.
-- ---------------------------------------------------------------------------

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
  v_layar_slug text;
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

-- Allowed location labels are the catalog's short labels, not titles and not old clip text.
-- Menus include one distinguishing line from the main field. Section notes stay short.

CREATE OR REPLACE FUNCTION public.agent_catalog_context(p_token_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $context$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
BEGIN
  RETURN jsonb_build_object(
    'tag_defs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', t.key, 'label', t.label, 'value_type', t.value_type) ORDER BY t.position, t.key)
      FROM public.footage_tag_defs t
      WHERE t.organization_id = v_org AND t.applies_to = 'scene'
    ), '[]'::jsonb),
    'scene_kinds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', k.key, 'label', k.label) ORDER BY k.position, k.key)
      FROM public.footage_scene_kind_defs k WHERE k.organization_id = v_org
    ), '[]'::jsonb),
    'menus', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', m.name,
        'aliases', COALESCE(to_jsonb(m.aliases), '[]'::jsonb),
        'line', (
          SELECT left(btrim(f.body), 160)
          FROM public.catalog_menu_fields f
          WHERE f.menu_id = m.id AND f.field_key = 'main' AND btrim(f.body) <> ''
          LIMIT 1
        )
      ) ORDER BY m.created_at)
      FROM public.catalog_menus m WHERE m.organization_id = v_org
    ), '[]'::jsonb),
    'product_labels', COALESCE((
      SELECT jsonb_agg(p ORDER BY p) FROM (
        SELECT DISTINCT btrim(x) AS p
        FROM public.footage_assets a, unnest(string_to_array(a.product_label, ';')) x
        WHERE a.organization_id = v_org AND a.deleted_at IS NULL AND a.tag_status = 'dicek' AND btrim(x) <> ''
      ) q
    ), '[]'::jsonb),
    'location_labels', COALESCE((
      SELECT jsonb_agg(l ORDER BY l) FROM (
        SELECT DISTINCT btrim(loc.label) AS l
        FROM public.catalog_locations loc
        WHERE loc.organization_id = v_org
          AND COALESCE(btrim(loc.label), '') NOT IN ('', '?')
      ) q
    ), '[]'::jsonb),
    'locations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'label', l.label,
        'name', l.name,
        'notes', (
          SELECT left(string_agg(s.title || ': ' || s.body, E'\n' ORDER BY s.position), 400)
          FROM public.catalog_location_sections s
          WHERE s.location_id = l.id
        )
      ) ORDER BY l.label, l.name)
      FROM public.catalog_locations l WHERE l.organization_id = v_org
    ), '[]'::jsonb),
    'bans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('reason', b.reason, 'scene', left(COALESCE(s.summary, ''), 200)))
      FROM (SELECT * FROM public.footage_bans WHERE organization_id = v_org ORDER BY created_at DESC LIMIT 40) b
      JOIN public.footage_scenes s ON s.id = b.scene_id
    ), '[]'::jsonb),
    'examples', COALESCE((
      SELECT jsonb_agg(e) FROM (
        SELECT jsonb_build_object(
          'location', a.location_label,
          'product', a.product_label,
          'scene_kind', s.scene_kind,
          'summary', s.summary,
          'tags', COALESCE((
            SELECT jsonb_object_agg(d.key, COALESCE(to_jsonb(v.value_bool), to_jsonb(v.value_text)))
            FROM public.footage_tag_values v JOIN public.footage_tag_defs d ON d.id = v.tag_def_id
            WHERE v.scene_id = s.id
          ), '{}'::jsonb)
        ) AS e
        FROM public.footage_scenes s
        JOIN public.footage_assets a ON a.id = s.asset_id
        WHERE s.organization_id = v_org AND a.deleted_at IS NULL AND a.tag_status = 'dicek'
          AND COALESCE(btrim(s.summary), '') <> ''
        ORDER BY s.updated_at DESC
        LIMIT 40
      ) q
    ), '[]'::jsonb),
    'location_thumbs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('location', q.location_label, 'path', q.thumb_storage_path))
      FROM (
        SELECT a.location_label, s.thumb_storage_path,
               row_number() OVER (PARTITION BY a.location_label ORDER BY s.updated_at DESC) AS n
        FROM public.footage_scenes s
        JOIN public.footage_assets a ON a.id = s.asset_id
        WHERE s.organization_id = v_org AND a.deleted_at IS NULL AND a.tag_status = 'dicek'
          AND s.thumb_storage_path IS NOT NULL
          AND s.scene_kind IN ('suasana', 'lokasi', 'orang')
          AND COALESCE(btrim(a.location_label), '') NOT IN ('', '?')
      ) q
      WHERE q.n <= 3
    ), '[]'::jsonb)
  );
END;
$context$;
