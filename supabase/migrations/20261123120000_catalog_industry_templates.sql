-- Industry templates + per-org custom menu field defs / scene kinds / tag apply.
-- F&B stays the Sate Sultan pack. Electronics is seeded onto Synckerja Office for the pilot.
-- Does not delete existing tag values. Apply only upserts defs and settings.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.catalog_industry_templates (
  code text PRIMARY KEY,
  label text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_industry_templates_code_check CHECK (code ~ '^[a-z][a-z0-9_]{0,31}$'),
  CONSTRAINT catalog_industry_templates_label_check CHECK (char_length(btrim(label)) > 0)
);

CREATE TABLE public.catalog_industry_template_menu_fields (
  template_code text NOT NULL REFERENCES public.catalog_industry_templates (code) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (template_code, field_key),
  CONSTRAINT catalog_industry_template_menu_fields_key_check CHECK (field_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT catalog_industry_template_menu_fields_label_check CHECK (char_length(btrim(label)) > 0)
);

CREATE TABLE public.catalog_industry_template_tags (
  template_code text NOT NULL REFERENCES public.catalog_industry_templates (code) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  applies_to text NOT NULL DEFAULT 'scene',
  value_type text NOT NULL DEFAULT 'bool',
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (template_code, key),
  CONSTRAINT catalog_industry_template_tags_key_check CHECK (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT catalog_industry_template_tags_label_check CHECK (char_length(btrim(label)) > 0),
  CONSTRAINT catalog_industry_template_tags_applies_check CHECK (applies_to IN ('asset', 'scene')),
  CONSTRAINT catalog_industry_template_tags_type_check CHECK (value_type IN ('bool', 'text'))
);

CREATE TABLE public.catalog_industry_template_scene_kinds (
  template_code text NOT NULL REFERENCES public.catalog_industry_templates (code) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (template_code, key),
  CONSTRAINT catalog_industry_template_scene_kinds_key_check CHECK (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT catalog_industry_template_scene_kinds_label_check CHECK (char_length(btrim(label)) > 0)
);

CREATE TABLE public.organization_catalog_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  industry_template_code text NOT NULL REFERENCES public.catalog_industry_templates (code),
  applied_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.catalog_menu_field_defs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_menu_field_defs_org_key UNIQUE (organization_id, field_key),
  CONSTRAINT catalog_menu_field_defs_key_check CHECK (field_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT catalog_menu_field_defs_label_check CHECK (char_length(btrim(label)) > 0),
  CONSTRAINT catalog_menu_field_defs_position_check CHECK (position >= 0)
);

CREATE TABLE public.footage_scene_kind_defs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT footage_scene_kind_defs_org_key UNIQUE (organization_id, key),
  CONSTRAINT footage_scene_kind_defs_key_check CHECK (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT footage_scene_kind_defs_label_check CHECK (char_length(btrim(label)) > 0),
  CONSTRAINT footage_scene_kind_defs_position_check CHECK (position >= 0)
);

CREATE TRIGGER update_organization_catalog_settings_updated_at
  BEFORE UPDATE ON public.organization_catalog_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_catalog_menu_field_defs_updated_at
  BEFORE UPDATE ON public.catalog_menu_field_defs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_footage_scene_kind_defs_updated_at
  BEFORE UPDATE ON public.footage_scene_kind_defs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_catalog_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_menu_field_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footage_scene_kind_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_industry_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_industry_template_menu_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_industry_template_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_industry_template_scene_kinds ENABLE ROW LEVEL SECURITY;

-- Templates are global read for authenticated members; writes via service_role / migrations only.
CREATE POLICY catalog_industry_templates_select ON public.catalog_industry_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_industry_template_menu_fields_select ON public.catalog_industry_template_menu_fields
  FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_industry_template_tags_select ON public.catalog_industry_template_tags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_industry_template_scene_kinds_select ON public.catalog_industry_template_scene_kinds
  FOR SELECT TO authenticated USING (true);

CREATE POLICY organization_catalog_settings_org ON public.organization_catalog_settings
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY catalog_menu_field_defs_org ON public.catalog_menu_field_defs
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY footage_scene_kind_defs_org ON public.footage_scene_kind_defs
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

GRANT SELECT ON public.catalog_industry_templates TO authenticated;
GRANT SELECT ON public.catalog_industry_template_menu_fields TO authenticated;
GRANT SELECT ON public.catalog_industry_template_tags TO authenticated;
GRANT SELECT ON public.catalog_industry_template_scene_kinds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_catalog_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_menu_field_defs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.footage_scene_kind_defs TO authenticated;
GRANT ALL ON TABLE public.catalog_industry_templates TO service_role;
GRANT ALL ON TABLE public.catalog_industry_template_menu_fields TO service_role;
GRANT ALL ON TABLE public.catalog_industry_template_tags TO service_role;
GRANT ALL ON TABLE public.catalog_industry_template_scene_kinds TO service_role;
GRANT ALL ON TABLE public.organization_catalog_settings TO service_role;
GRANT ALL ON TABLE public.catalog_menu_field_defs TO service_role;
GRANT ALL ON TABLE public.footage_scene_kind_defs TO service_role;

-- ---------------------------------------------------------------------------
-- Seed templates
-- ---------------------------------------------------------------------------

INSERT INTO public.catalog_industry_templates (code, label, description, position) VALUES
  ('fnb', 'F&B', 'Restoran, cafe, makanan & minuman', 1),
  ('fashion', 'Fashion', 'Pakaian, aksesoris, gaya', 2),
  ('electronics', 'Elektronik', 'Gadget, powerbank, perangkat', 3),
  ('property', 'Properti', 'Unit, fasilitas, view', 4),
  ('beauty', 'Kecantikan', 'Shade, tekstur, kemasan', 5);

INSERT INTO public.catalog_industry_template_menu_fields (template_code, field_key, label, position) VALUES
  ('fnb', 'main', 'Main Subject', 1),
  ('fnb', 'topping', 'Signature Topping', 2),
  ('fnb', 'garnish', 'Side Garnishes', 3),
  ('fnb', 'presentation', 'Presentation', 4),
  ('fnb', 'sauce', 'Dipping Sauce', 5),
  ('fnb', 'larangan', 'Larangan (must NOT)', 6),
  ('fnb', 'khusus', 'Aturan khusus', 7),
  ('fashion', 'main', 'Main Subject', 1),
  ('fashion', 'material', 'Bahan', 2),
  ('fashion', 'size', 'Ukuran', 3),
  ('fashion', 'color', 'Warna', 4),
  ('fashion', 'how_to_wear', 'Cara pakai', 5),
  ('fashion', 'larangan', 'Larangan (must NOT)', 6),
  ('fashion', 'khusus', 'Aturan khusus', 7),
  ('electronics', 'main', 'Main Subject', 1),
  ('electronics', 'specs', 'Spesifikasi', 2),
  ('electronics', 'features', 'Fitur', 3),
  ('electronics', 'color', 'Warna', 4),
  ('electronics', 'accessories', 'Aksesoris', 5),
  ('electronics', 'larangan', 'Larangan (must NOT)', 6),
  ('electronics', 'khusus', 'Aturan khusus', 7),
  ('property', 'main', 'Main Subject', 1),
  ('property', 'unit_type', 'Tipe unit', 2),
  ('property', 'facilities', 'Fasilitas', 3),
  ('property', 'view', 'View', 4),
  ('property', 'larangan', 'Larangan (must NOT)', 5),
  ('property', 'khusus', 'Aturan khusus', 6),
  ('beauty', 'main', 'Main Subject', 1),
  ('beauty', 'shade', 'Shade', 2),
  ('beauty', 'texture', 'Tekstur', 3),
  ('beauty', 'packaging', 'Kemasan', 4),
  ('beauty', 'larangan', 'Larangan (must NOT)', 5),
  ('beauty', 'khusus', 'Aturan khusus', 6);

INSERT INTO public.catalog_industry_template_tags (template_code, key, label, applies_to, value_type, position) VALUES
  ('fnb', 'hijab', 'Hijab', 'scene', 'bool', 1),
  ('fnb', 'watermark_ui', 'Watermark/UI', 'scene', 'bool', 2),
  ('fnb', 'lengkuas', 'Lengkuas', 'scene', 'bool', 3),
  ('fnb', 'meja_biru', 'Meja biru', 'scene', 'bool', 4),
  ('fashion', 'watermark_ui', 'Watermark/UI', 'scene', 'bool', 1),
  ('fashion', 'on_model', 'On model', 'scene', 'bool', 2),
  ('fashion', 'flat_lay', 'Flat lay', 'scene', 'bool', 3),
  ('electronics', 'watermark_ui', 'Watermark/UI', 'scene', 'bool', 1),
  ('electronics', 'capacity_shown', 'Kapasitas terlihat', 'scene', 'bool', 2),
  ('electronics', 'product_color_dark', 'Warna gelap', 'scene', 'bool', 3),
  ('property', 'watermark_ui', 'Watermark/UI', 'scene', 'bool', 1),
  ('property', 'interior', 'Interior', 'scene', 'bool', 2),
  ('property', 'exterior', 'Exterior', 'scene', 'bool', 3),
  ('beauty', 'watermark_ui', 'Watermark/UI', 'scene', 'bool', 1),
  ('beauty', 'swatch', 'Swatch', 'scene', 'bool', 2),
  ('beauty', 'on_skin', 'On skin', 'scene', 'bool', 3);

INSERT INTO public.catalog_industry_template_scene_kinds (template_code, key, label, position)
SELECT t.code, k.key, k.label, k.position
FROM public.catalog_industry_templates t
CROSS JOIN (
  VALUES
    ('produk', 'produk aja', 1),
    ('orang', 'ada orang', 2),
    ('suasana', 'suasana', 3),
    ('lokasi', 'lokasi/jalan', 4),
    ('grafis', 'grafis/logo', 5),
    ('berita', 'berita/artikel', 6)
) AS k(key, label, position);

-- ---------------------------------------------------------------------------
-- Apply helper (internal) + MCP RPC
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

  INSERT INTO public.catalog_menu_field_defs (organization_id, field_key, label, position)
  SELECT p_organization_id, f.field_key, f.label, f.position
  FROM public.catalog_industry_template_menu_fields f
  WHERE f.template_code = v_code
  ON CONFLICT (organization_id, field_key) DO UPDATE
    SET label = EXCLUDED.label,
        position = EXCLUDED.position,
        updated_at = now();
  GET DIAGNOSTICS v_fields = ROW_COUNT;

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
    'menu_fields_upserted', v_fields,
    'scene_kinds_upserted', v_kinds
  );
END;
$apply$;

CREATE OR REPLACE FUNCTION public.mcp_apply_industry_template(
  p_user_id uuid,
  p_organization_id uuid,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $mcp$
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  RETURN public.catalog_apply_industry_template_internal(p_organization_id, p_code);
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_list_industry_templates(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $list$
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'code', t.code,
        'label', t.label,
        'description', t.description,
        'position', t.position,
        'menu_fields', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object('field_key', f.field_key, 'label', f.label, 'position', f.position)
            ORDER BY f.position, f.field_key
          ), '[]'::jsonb)
          FROM public.catalog_industry_template_menu_fields f
          WHERE f.template_code = t.code
        ),
        'tags', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'key', g.key, 'label', g.label, 'applies_to', g.applies_to,
              'value_type', g.value_type, 'position', g.position
            )
            ORDER BY g.position, g.key
          ), '[]'::jsonb)
          FROM public.catalog_industry_template_tags g
          WHERE g.template_code = t.code
        )
      )
      ORDER BY t.position, t.code
    )
    FROM public.catalog_industry_templates t
  ), '[]'::jsonb);
END;
$list$;

CREATE OR REPLACE FUNCTION public.mcp_get_catalog_settings(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $get$
DECLARE
  v_settings public.organization_catalog_settings%ROWTYPE;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  SELECT * INTO v_settings
  FROM public.organization_catalog_settings
  WHERE organization_id = p_organization_id;
  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'industry_template_code', v_settings.industry_template_code,
    'applied_at', v_settings.applied_at,
    'menu_field_defs', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('field_key', d.field_key, 'label', d.label, 'position', d.position)
        ORDER BY d.position, d.field_key
      )
      FROM public.catalog_menu_field_defs d
      WHERE d.organization_id = p_organization_id
    ), '[]'::jsonb),
    'tag_defs', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', t.key, 'label', t.label, 'applies_to', t.applies_to,
          'value_type', t.value_type, 'position', t.position
        )
        ORDER BY t.position, t.key
      )
      FROM public.footage_tag_defs t
      WHERE t.organization_id = p_organization_id
    ), '[]'::jsonb),
    'scene_kind_defs', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('key', k.key, 'label', k.label, 'position', k.position)
        ORDER BY k.position, k.key
      )
      FROM public.footage_scene_kind_defs k
      WHERE k.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
END;
$get$;

REVOKE ALL ON FUNCTION public.catalog_apply_industry_template_internal(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.catalog_apply_industry_template_internal(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_apply_industry_template_internal(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_apply_industry_template(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_apply_industry_template(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_industry_template(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_industry_templates(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_industry_templates(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_industry_templates(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_get_catalog_settings(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_catalog_settings(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_catalog_settings(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Scene JSON: legacy keys + generic tags map
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_footage_scene_json(p_scene_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $json$
DECLARE
  v_scene public.footage_scenes%ROWTYPE;
  v_asset public.footage_assets%ROWTYPE;
  v_tags jsonb := '{}'::jsonb;
  v_usage_count integer;
  v_banned boolean;
  v_ban_reason text;
BEGIN
  SELECT * INTO v_scene FROM public.footage_scenes WHERE id = p_scene_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_asset FROM public.footage_assets WHERE id = v_scene.asset_id;

  SELECT COALESCE(jsonb_object_agg(d.key, CASE
      WHEN d.value_type = 'bool' THEN to_jsonb(COALESCE(v.value_bool, false))
      ELSE to_jsonb(COALESCE(v.value_text, ''))
    END), '{}'::jsonb)
  INTO v_tags
  FROM public.footage_tag_defs d
  LEFT JOIN public.footage_tag_values v
    ON v.tag_def_id = d.id
   AND v.organization_id = d.organization_id
   AND v.scene_id = v_scene.id
  WHERE d.organization_id = v_scene.organization_id
    AND d.applies_to = 'scene';

  SELECT count(*)::int INTO v_usage_count
  FROM public.footage_usages u
  WHERE u.organization_id = v_scene.organization_id
    AND u.asset_id = v_scene.asset_id
    AND public.mcp_footage_usage_overlaps(
      v_scene.start_seconds, v_scene.end_seconds, u.in_seconds, u.out_seconds
    );

  SELECT true, b.reason INTO v_banned, v_ban_reason
  FROM public.footage_bans b
  WHERE b.scene_id = v_scene.id
  LIMIT 1;
  v_banned := COALESCE(v_banned, false);

  RETURN jsonb_build_object(
    'scene_id', v_scene.id,
    'file_key', v_asset.file_key,
    'scene_index', v_scene.scene_index,
    'start_seconds', v_scene.start_seconds,
    'end_seconds', v_scene.end_seconds,
    'scene_kind', v_scene.scene_kind,
    'summary', v_scene.summary,
    'note', v_scene.note,
    'location_label', v_asset.location_label,
    'product_label', v_asset.product_label,
    'media_type', v_asset.media_type,
    'storage_status', v_asset.storage_status,
    'thumb_storage_path', v_scene.thumb_storage_path,
    'thumb_required', COALESCE(v_scene.thumb_required, true),
    'preview_storage_path', v_asset.preview_storage_path,
    'hijab', COALESCE((v_tags->>'hijab')::boolean, false),
    'watermark_ui', COALESCE((v_tags->>'watermark_ui')::boolean, false),
    'lengkuas', COALESCE((v_tags->>'lengkuas')::boolean, false),
    'meja_biru', COALESCE((v_tags->>'meja_biru')::boolean, false),
    'tags', v_tags,
    'usage_count', v_usage_count,
    'banned', v_banned,
    'ban_reason', v_ban_reason
  );
END;
$json$;

REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM service_role;

-- ---------------------------------------------------------------------------
-- footage.search: add optional p_tags jsonb map { key: bool|string }
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.mcp_search_footage(
  uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer, text, boolean
);

CREATE FUNCTION public.mcp_search_footage(
  p_user_id uuid,
  p_organization_id uuid,
  p_location text DEFAULT NULL,
  p_product text DEFAULT NULL,
  p_scene_kind text DEFAULT NULL,
  p_hijab boolean DEFAULT NULL,
  p_watermark boolean DEFAULT NULL,
  p_media_type text DEFAULT NULL,
  p_unused boolean DEFAULT NULL,
  p_limit integer DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_include_banned boolean DEFAULT NULL,
  p_tags jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $search$
DECLARE
  v_location text := NULLIF(btrim(COALESCE(p_location, '')), '');
  v_product text := NULLIF(btrim(COALESCE(p_product, '')), '');
  v_kind text := NULLIF(btrim(COALESCE(p_scene_kind, '')), '');
  v_media text := NULLIF(lower(btrim(COALESCE(p_media_type, ''))), '');
  v_query text := NULLIF(lower(btrim(COALESCE(p_query, ''))), '');
  v_limit integer := COALESCE(p_limit, 30);
  v_tags jsonb := CASE WHEN p_tags IS NULL OR p_tags = 'null'::jsonb THEN '{}'::jsonb ELSE p_tags END;
  v_total integer;
  v_scenes jsonb;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);

  IF v_limit < 1 OR v_limit > 50 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF v_media IS NOT NULL AND v_media NOT IN ('video', 'image') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF v_query IS NOT NULL AND char_length(v_query) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_tags) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT page.total, page.scenes
  INTO v_total, v_scenes
  FROM (
    WITH matched AS (
      SELECT s.id, a.file_key, s.scene_index
      FROM public.footage_scenes s
      JOIN public.footage_assets a
        ON a.id = s.asset_id
       AND a.organization_id = s.organization_id
      WHERE s.organization_id = p_organization_id
        AND (v_location IS NULL OR lower(btrim(COALESCE(a.location_label, ''))) = lower(v_location))
        AND (
          v_product IS NULL
          OR EXISTS (
            SELECT 1
            FROM unnest(string_to_array(COALESCE(a.product_label, ''), ';')) AS part
            WHERE btrim(part) <> ''
              AND lower(btrim(part)) = lower(v_product)
          )
        )
        AND (v_kind IS NULL OR lower(btrim(s.scene_kind)) = lower(v_kind))
        AND (
          p_hijab IS NULL
          OR (
            EXISTS (
              SELECT 1
              FROM public.footage_tag_values v
              JOIN public.footage_tag_defs d
                ON d.id = v.tag_def_id AND d.organization_id = v.organization_id
              WHERE v.scene_id = s.id
                AND v.organization_id = s.organization_id
                AND d.key = 'hijab'
                AND v.value_bool IS TRUE
            ) = p_hijab
          )
        )
        AND (
          p_watermark IS NULL
          OR (
            EXISTS (
              SELECT 1
              FROM public.footage_tag_values v
              JOIN public.footage_tag_defs d
                ON d.id = v.tag_def_id AND d.organization_id = v.organization_id
              WHERE v.scene_id = s.id
                AND v.organization_id = s.organization_id
                AND d.key = 'watermark_ui'
                AND v.value_bool IS TRUE
            ) = p_watermark
          )
        )
        AND (
          v_tags = '{}'::jsonb
          OR NOT EXISTS (
            SELECT 1
            FROM jsonb_each(v_tags) AS req(key, val)
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.footage_tag_defs d
              JOIN public.footage_tag_values v
                ON v.tag_def_id = d.id AND v.organization_id = d.organization_id
              WHERE d.organization_id = s.organization_id
                AND d.key = req.key
                AND v.scene_id = s.id
                AND (
                  (d.value_type = 'bool' AND v.value_bool IS NOT DISTINCT FROM (req.val #>> '{}')::boolean)
                  OR (d.value_type = 'text' AND lower(COALESCE(v.value_text, '')) = lower(req.val #>> '{}'))
                )
            )
          )
        )
        AND (v_media IS NULL OR a.media_type = v_media)
        AND (
          p_unused IS NOT TRUE
          OR NOT EXISTS (
            SELECT 1
            FROM public.footage_usages u
            WHERE u.organization_id = s.organization_id
              AND u.asset_id = s.asset_id
              AND public.mcp_footage_usage_overlaps(s.start_seconds, s.end_seconds, u.in_seconds, u.out_seconds)
          )
        )
        AND (
          p_include_banned IS TRUE
          OR NOT EXISTS (
            SELECT 1 FROM public.footage_bans ban
            WHERE ban.scene_id = s.id AND ban.organization_id = s.organization_id
          )
        )
        AND (
          v_query IS NULL
          OR strpos(lower(COALESCE(s.summary, '')), v_query) > 0
          OR strpos(lower(COALESCE(s.note, '')), v_query) > 0
          OR strpos(lower(COALESCE(a.summary, '')), v_query) > 0
          OR strpos(lower(COALESCE(a.note, '')), v_query) > 0
          OR strpos(lower(a.file_key), v_query) > 0
          OR strpos(lower(COALESCE(a.product_label, '')), v_query) > 0
        )
    )
    SELECT
      (SELECT count(*)::int FROM matched) AS total,
      COALESCE((
        SELECT jsonb_agg(public.mcp_footage_scene_json(picked.id) ORDER BY picked.file_key, picked.scene_index)
        FROM (
          SELECT m.id, m.file_key, m.scene_index
          FROM matched m
          ORDER BY m.file_key, m.scene_index
          LIMIT v_limit
        ) picked
      ), '[]'::jsonb) AS scenes
  ) page;

  RETURN jsonb_build_object('total', v_total, 'scenes', v_scenes);
END;
$search$;

REVOKE ALL ON FUNCTION public.mcp_search_footage(
  uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer, text, boolean, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_search_footage(
  uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer, text, boolean, jsonb
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_search_footage(
  uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer, text, boolean, jsonb
) TO service_role;

-- ---------------------------------------------------------------------------
-- Apply packs + pilot seed (Synckerja Office electronics + powerbank product)
-- ---------------------------------------------------------------------------

SELECT public.catalog_apply_industry_template_internal(
  '5fa70166-0a35-4f0d-94b3-54f19b3f8c30'::uuid,
  'fnb'
);

SELECT public.catalog_apply_industry_template_internal(
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'electronics'
);

INSERT INTO public.catalog_menus (organization_id, external_id, name, aliases)
VALUES (
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'powerbank-20000',
  'Powerbank 20000mAh',
  ARRAY['powerbank']::text[]
)
ON CONFLICT (organization_id, external_id) DO UPDATE
  SET name = EXCLUDED.name,
      aliases = EXCLUDED.aliases,
      updated_at = now();

INSERT INTO public.catalog_menu_fields (organization_id, menu_id, field_key, body, position)
SELECT
  m.organization_id,
  m.id,
  f.field_key,
  f.body,
  f.position
FROM public.catalog_menus m
CROSS JOIN (
  VALUES
    ('main', 'A compact 20000mAh USB-C powerbank with a matte dark-grey shell and rounded corners.', 1),
    ('specs', 'Capacity 20000mAh, USB-C PD input/output, dual USB-A, LED percentage display.', 2),
    ('features', 'Fast charge, pass-through charging, pocketable brick shape.', 3),
    ('color', 'Matte dark grey with subtle brand mark near the ports.', 4),
    ('accessories', 'Short USB-C cable only; no box text readable.', 5),
    ('larangan', 'No food props. No restaurant tables. No hijab-focused framing rules.', 6),
    ('khusus', 'Keep the LED digits readable; do not invent wireless charging coils.', 7)
) AS f(field_key, body, position)
WHERE m.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND m.external_id = 'powerbank-20000'
ON CONFLICT (menu_id, field_key) DO UPDATE
  SET body = EXCLUDED.body,
      position = EXCLUDED.position;

-- Minimal Office footage so filters/tags can be exercised after deploy.
WITH asset AS (
  INSERT INTO public.footage_assets (
    organization_id, file_key, media_type, origin, location_label, product_label,
    summary, storage_status, duration_seconds
  )
  VALUES (
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
    'office-demo/powerbank/clip1.mp4',
    'video',
    'ai',
    'Office Desk',
    'powerbank',
    'Powerbank demo clip',
    'bank',
    6
  )
  ON CONFLICT (organization_id, file_key) DO UPDATE
    SET location_label = EXCLUDED.location_label,
        product_label = EXCLUDED.product_label,
        summary = EXCLUDED.summary,
        storage_status = EXCLUDED.storage_status,
        duration_seconds = EXCLUDED.duration_seconds
  RETURNING id, organization_id
),
scene AS (
  INSERT INTO public.footage_scenes (
    organization_id, asset_id, scene_index, start_seconds, end_seconds,
    scene_kind, summary, note, thumb_required
  )
  SELECT
    a.organization_id,
    a.id,
    1,
    0,
    3,
    'produk',
    'Close-up of matte grey powerbank LED',
    'capacity readable',
    false
  FROM asset a
  ON CONFLICT (asset_id, start_seconds) DO UPDATE
    SET end_seconds = EXCLUDED.end_seconds,
        scene_kind = EXCLUDED.scene_kind,
        summary = EXCLUDED.summary,
        note = EXCLUDED.note,
        thumb_required = EXCLUDED.thumb_required
  RETURNING id, organization_id
)
INSERT INTO public.footage_tag_values (organization_id, tag_def_id, scene_id, value_bool)
SELECT s.organization_id, d.id, s.id, true
FROM scene s
JOIN public.footage_tag_defs d
  ON d.organization_id = s.organization_id
 AND d.key IN ('capacity_shown', 'product_color_dark')
ON CONFLICT (tag_def_id, scene_id) WHERE scene_id IS NOT NULL DO UPDATE
  SET value_bool = EXCLUDED.value_bool,
      value_text = NULL,
      updated_at = now();

COMMENT ON TABLE public.catalog_industry_templates IS
  'Global industry packs for Content Studio menu fields, footage tags, and scene kinds.';
COMMENT ON TABLE public.catalog_menu_field_defs IS
  'Per-org product form fields copied from an industry template; orgs may add more keys.';
COMMENT ON TABLE public.footage_scene_kind_defs IS
  'Per-org scene kind options for Footage filters; defaults come from the industry template.';
COMMENT ON FUNCTION public.mcp_apply_industry_template(uuid, uuid, text) IS
  'Upsert tag defs, menu field defs, and scene kinds from an industry template onto the org. Does not delete existing defs or values.';

-- ---------------------------------------------------------------------------
-- Scene batch: accept generic tags map { key: bool|string } (def must exist)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_footage_scene_tag_value(
  p_organization_id uuid,
  p_scene_id uuid,
  p_key text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $tag_val$
  SELECT COALESCE((
    SELECT CASE
      WHEN d.value_type = 'text' THEN to_jsonb(COALESCE(v.value_text, ''))
      ELSE to_jsonb(COALESCE(v.value_bool, false))
    END
    FROM public.footage_tag_defs d
    LEFT JOIN public.footage_tag_values v
      ON v.tag_def_id = d.id
     AND v.organization_id = d.organization_id
     AND v.scene_id = p_scene_id
    WHERE d.organization_id = p_organization_id
      AND d.key = p_key
    LIMIT 1
  ), 'null'::jsonb);
$tag_val$;

CREATE OR REPLACE FUNCTION public.mcp_footage_set_scene_tag_value(
  p_organization_id uuid,
  p_scene_id uuid,
  p_key text,
  p_value jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $set_any$
DECLARE
  v_def public.footage_tag_defs%ROWTYPE;
  v_bool boolean;
  v_text text;
BEGIN
  SELECT * INTO v_def
  FROM public.footage_tag_defs d
  WHERE d.organization_id = p_organization_id AND d.key = p_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_def.value_type = 'bool' THEN
    IF jsonb_typeof(p_value) <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_bool := (p_value #>> '{}')::boolean;
    UPDATE public.footage_tag_values v
    SET value_bool = v_bool, value_text = NULL, updated_at = now()
    WHERE v.organization_id = p_organization_id
      AND v.tag_def_id = v_def.id
      AND v.scene_id = p_scene_id;
    IF NOT FOUND THEN
      INSERT INTO public.footage_tag_values (organization_id, tag_def_id, scene_id, value_bool)
      VALUES (p_organization_id, v_def.id, p_scene_id, v_bool);
    END IF;
  ELSE
    IF jsonb_typeof(p_value) <> 'string' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_text := btrim(p_value #>> '{}');
    IF char_length(v_text) > 200 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    UPDATE public.footage_tag_values v
    SET value_text = v_text, value_bool = NULL, updated_at = now()
    WHERE v.organization_id = p_organization_id
      AND v.tag_def_id = v_def.id
      AND v.scene_id = p_scene_id;
    IF NOT FOUND THEN
      INSERT INTO public.footage_tag_values (organization_id, tag_def_id, scene_id, value_text)
      VALUES (p_organization_id, v_def.id, p_scene_id, v_text);
    END IF;
  END IF;
END;
$set_any$;

CREATE OR REPLACE FUNCTION public.mcp_footage_normalize_scene_batch(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $normalize$
DECLARE
  v_key text;
  v_item jsonb;
  v_clean jsonb;
  v_scenes jsonb := '[]'::jsonb;
  v_seen integer[] := ARRAY[]::integer[];
  v_index numeric;
  v_index_int integer;
  v_text text;
  v_i integer;
  v_tags jsonb;
  v_tag_key text;
  v_tag_val jsonb;
  v_tags_clean jsonb;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_input) AS k
    WHERE k NOT IN ('file_key', 'scenes')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_input->'file_key') <> 'string' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_key := public.mcp_footage_clean_key(p_input->>'file_key');

  IF jsonb_typeof(p_input->'scenes') <> 'array'
     OR jsonb_array_length(p_input->'scenes') < 1
     OR jsonb_array_length(p_input->'scenes') > 50 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  FOR v_i IN 0 .. jsonb_array_length(p_input->'scenes') - 1 LOOP
    v_item := p_input->'scenes'->v_i;
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_object_keys(v_item) AS k
      WHERE k NOT IN (
        'scene_index', 'scene_kind', 'summary', 'note',
        'hijab', 'watermark', 'meja_biru', 'lengkuas', 'tags'
      )
    ) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_item->'scene_index') <> 'number' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_index := (v_item->>'scene_index')::numeric;
    IF v_index <> trunc(v_index) OR v_index < 1 OR v_index > 100000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_index_int := v_index::integer;
    IF v_index_int = ANY (v_seen) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_seen := v_seen || v_index_int;
    v_clean := jsonb_build_object('scene_index', v_index_int);

    IF jsonb_exists(v_item, 'scene_kind') THEN
      IF jsonb_typeof(v_item->'scene_kind') <> 'string' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_text := btrim(v_item->>'scene_kind');
      IF char_length(v_text) < 1 OR char_length(v_text) > 80 THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('scene_kind', v_text);
    END IF;

    IF jsonb_exists(v_item, 'summary') THEN
      IF jsonb_typeof(v_item->'summary') <> 'string' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_text := btrim(v_item->>'summary');
      IF char_length(v_text) > 4000 THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('summary', v_text);
    END IF;

    IF jsonb_exists(v_item, 'note') THEN
      IF jsonb_typeof(v_item->'note') <> 'string' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_text := btrim(v_item->>'note');
      IF char_length(v_text) > 4000 THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('note', v_text);
    END IF;

    IF jsonb_exists(v_item, 'hijab') THEN
      IF jsonb_typeof(v_item->'hijab') <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('hijab', (v_item->>'hijab')::boolean);
    END IF;
    IF jsonb_exists(v_item, 'watermark') THEN
      IF jsonb_typeof(v_item->'watermark') <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('watermark', (v_item->>'watermark')::boolean);
    END IF;
    IF jsonb_exists(v_item, 'meja_biru') THEN
      IF jsonb_typeof(v_item->'meja_biru') <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('meja_biru', (v_item->>'meja_biru')::boolean);
    END IF;
    IF jsonb_exists(v_item, 'lengkuas') THEN
      IF jsonb_typeof(v_item->'lengkuas') <> 'boolean' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_clean := v_clean || jsonb_build_object('lengkuas', (v_item->>'lengkuas')::boolean);
    END IF;

    IF jsonb_exists(v_item, 'tags') THEN
      v_tags := v_item->'tags';
      IF jsonb_typeof(v_tags) <> 'object' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_tags_clean := '{}'::jsonb;
      FOR v_tag_key, v_tag_val IN SELECT * FROM jsonb_each(v_tags) LOOP
        IF v_tag_key !~ '^[a-z][a-z0-9_]{0,63}$' THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
        IF jsonb_typeof(v_tag_val) NOT IN ('boolean', 'string') THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
        IF jsonb_typeof(v_tag_val) = 'string' THEN
          v_text := btrim(v_tag_val #>> '{}');
          IF char_length(v_text) < 1 OR char_length(v_text) > 200 THEN
            RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
          END IF;
          v_tags_clean := v_tags_clean || jsonb_build_object(v_tag_key, v_text);
        ELSE
          v_tags_clean := v_tags_clean || jsonb_build_object(v_tag_key, (v_tag_val #>> '{}')::boolean);
        END IF;
      END LOOP;
      IF v_tags_clean <> '{}'::jsonb THEN
        v_clean := v_clean || jsonb_build_object('tags', v_tags_clean);
      END IF;
    END IF;

    IF (SELECT count(*) FROM jsonb_object_keys(v_clean)) < 2 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_scenes := v_scenes || jsonb_build_array(v_clean);
  END LOOP;

  RETURN jsonb_build_object('file_key', v_key, 'scenes', v_scenes);
END;
$normalize$;

CREATE OR REPLACE FUNCTION public.mcp_preview_footage_scene_batch(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_scenes$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
  v_scene public.footage_scenes%ROWTYPE;
  v_item jsonb;
  v_changes jsonb := '[]'::jsonb;
  v_before jsonb;
  v_after jsonb;
  v_i integer;
  v_id uuid;
  v_expires timestamptz;
  v_storage_key text;
  v_input_key text;
  v_tag_key text;
  v_tag_val jsonb;
  v_before_tags jsonb;
  v_after_tags jsonb;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_normalize_scene_batch(p_input);

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  FOR v_i IN 0 .. jsonb_array_length(v_payload->'scenes') - 1 LOOP
    v_item := v_payload->'scenes'->v_i;
    SELECT *
    INTO v_scene
    FROM public.footage_scenes s
    WHERE s.organization_id = p_organization_id
      AND s.asset_id = v_asset.id
      AND s.scene_index = (v_item->>'scene_index')::integer;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;

    v_before := '{}'::jsonb;
    v_after := '{}'::jsonb;

    IF jsonb_exists(v_item, 'scene_kind') THEN
      v_before := v_before || jsonb_build_object('scene_kind', v_scene.scene_kind);
      v_after := v_after || jsonb_build_object('scene_kind', v_item->>'scene_kind');
    END IF;
    IF jsonb_exists(v_item, 'summary') THEN
      v_before := v_before || jsonb_build_object('summary', v_scene.summary);
      v_after := v_after || jsonb_build_object('summary', NULLIF(v_item->>'summary', ''));
    END IF;
    IF jsonb_exists(v_item, 'note') THEN
      v_before := v_before || jsonb_build_object('note', v_scene.note);
      v_after := v_after || jsonb_build_object('note', NULLIF(v_item->>'note', ''));
    END IF;

    FOREACH v_input_key IN ARRAY ARRAY['hijab', 'watermark', 'meja_biru', 'lengkuas'] LOOP
      IF jsonb_exists(v_item, v_input_key) THEN
        v_storage_key := CASE v_input_key
          WHEN 'watermark' THEN 'watermark_ui'
          ELSE v_input_key
        END;
        IF NOT EXISTS (
          SELECT 1
          FROM public.footage_tag_defs d
          WHERE d.organization_id = p_organization_id
            AND d.key = v_storage_key
        ) THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
        v_before := v_before || jsonb_build_object(
          v_input_key,
          public.mcp_footage_scene_tag(p_organization_id, v_scene.id, v_storage_key)
        );
        v_after := v_after || jsonb_build_object(v_input_key, (v_item->>v_input_key)::boolean);
      END IF;
    END LOOP;

    IF jsonb_exists(v_item, 'tags') THEN
      v_before_tags := '{}'::jsonb;
      v_after_tags := '{}'::jsonb;
      FOR v_tag_key, v_tag_val IN SELECT * FROM jsonb_each(v_item->'tags') LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.footage_tag_defs d
          WHERE d.organization_id = p_organization_id AND d.key = v_tag_key
        ) THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
        v_before_tags := v_before_tags || jsonb_build_object(
          v_tag_key,
          public.mcp_footage_scene_tag_value(p_organization_id, v_scene.id, v_tag_key)
        );
        v_after_tags := v_after_tags || jsonb_build_object(v_tag_key, v_tag_val);
      END LOOP;
      v_before := v_before || jsonb_build_object('tags', v_before_tags);
      v_after := v_after || jsonb_build_object('tags', v_after_tags);
    END IF;

    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'scene_index', (v_item->>'scene_index')::integer,
      'before', v_before,
      'after', v_after
    ));
  END LOOP;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'footage.scenes.upsert_batch',
    v_payload,
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'file_key', v_payload->>'file_key',
    'changes', v_changes,
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_scenes$;

CREATE OR REPLACE FUNCTION public.mcp_apply_footage_scene_batch(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_scenes$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
  v_scene public.footage_scenes%ROWTYPE;
  v_item jsonb;
  v_i integer;
  v_input_key text;
  v_storage_key text;
  v_tag_key text;
  v_tag_val jsonb;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id,
    p_organization_id,
    p_preview_id,
    'footage.scenes.upsert_batch'
  );

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  FOR v_i IN 0 .. jsonb_array_length(v_payload->'scenes') - 1 LOOP
    v_item := v_payload->'scenes'->v_i;
    SELECT *
    INTO v_scene
    FROM public.footage_scenes s
    WHERE s.organization_id = p_organization_id
      AND s.asset_id = v_asset.id
      AND s.scene_index = (v_item->>'scene_index')::integer
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.footage_scenes s
    SET
      scene_kind = CASE WHEN jsonb_exists(v_item, 'scene_kind') THEN v_item->>'scene_kind' ELSE s.scene_kind END,
      summary = CASE WHEN jsonb_exists(v_item, 'summary') THEN NULLIF(v_item->>'summary', '') ELSE s.summary END,
      note = CASE WHEN jsonb_exists(v_item, 'note') THEN NULLIF(v_item->>'note', '') ELSE s.note END
    WHERE s.id = v_scene.id
      AND s.organization_id = p_organization_id;

    FOREACH v_input_key IN ARRAY ARRAY['hijab', 'watermark', 'meja_biru', 'lengkuas'] LOOP
      IF jsonb_exists(v_item, v_input_key) THEN
        v_storage_key := CASE v_input_key
          WHEN 'watermark' THEN 'watermark_ui'
          ELSE v_input_key
        END;
        PERFORM public.mcp_footage_set_scene_tag(
          p_organization_id,
          v_scene.id,
          v_storage_key,
          (v_item->>v_input_key)::boolean
        );
      END IF;
    END LOOP;

    IF jsonb_exists(v_item, 'tags') THEN
      FOR v_tag_key, v_tag_val IN SELECT * FROM jsonb_each(v_item->'tags') LOOP
        PERFORM public.mcp_footage_set_scene_tag_value(
          p_organization_id,
          v_scene.id,
          v_tag_key,
          v_tag_val
        );
      END LOOP;
    END IF;
  END LOOP;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'file_key', v_asset.file_key,
    'scene_count', jsonb_array_length(v_payload->'scenes')
  );
END;
$apply_scenes$;

REVOKE ALL ON FUNCTION public.mcp_footage_scene_tag_value(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_footage_set_scene_tag_value(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_footage_scene_tag_value(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_footage_set_scene_tag_value(uuid, uuid, text, jsonb) TO service_role;
