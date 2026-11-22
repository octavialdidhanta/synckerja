-- Private thumbnails and catalog photos.
-- Laptop paths stay in file_key and file_path. preview_storage_path stays empty.
-- Members may read their own objects. The upload script uses service_role.
-- No authenticated write or delete policy.

ALTER TABLE public.footage_scenes
  ADD COLUMN thumb_storage_path text;

ALTER TABLE public.footage_scenes
  ADD CONSTRAINT footage_scenes_thumb_path_check CHECK (
    thumb_storage_path IS NULL
    OR (
      char_length(thumb_storage_path) <= 500
      AND thumb_storage_path = organization_id::text || '/thumbs/' || id::text || '.jpg'
    )
  );

COMMENT ON COLUMN public.footage_scenes.thumb_storage_path IS
  'Private catalog-media object for this scene thumbnail. Null until uploaded. The clip preview_storage_path is a later 480p pass.';

ALTER TABLE public.catalog_menu_photos
  ADD COLUMN storage_path text;

ALTER TABLE public.catalog_menu_photos
  ADD CONSTRAINT catalog_menu_photos_storage_path_check CHECK (
    storage_path IS NULL
    OR (
      char_length(storage_path) <= 500
      AND storage_path ~ (
        '^' || organization_id::text || '/photos/' || id::text || '\.(jpg|jpeg|png|webp)$'
      )
    )
  );

COMMENT ON COLUMN public.catalog_menu_photos.storage_path IS
  'Private catalog-media object. file_path stays the laptop path.';

ALTER TABLE public.catalog_location_photos
  ADD COLUMN storage_path text;

ALTER TABLE public.catalog_location_photos
  ADD CONSTRAINT catalog_location_photos_storage_path_check CHECK (
    storage_path IS NULL
    OR (
      char_length(storage_path) <= 500
      AND storage_path ~ (
        '^' || organization_id::text || '/photos/' || id::text || '\.(jpg|jpeg|png|webp)$'
      )
    )
  );

COMMENT ON COLUMN public.catalog_location_photos.storage_path IS
  'Private catalog-media object. file_path stays the laptop path.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-media',
  'catalog-media',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS catalog_media_select ON storage.objects;
CREATE POLICY catalog_media_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'catalog-media'
    AND (storage.foldername(name))[1] IN (
      SELECT public.user_organization_ids()::text
    )
    AND (storage.foldername(name))[2] IN ('thumbs', 'photos')
  );

CREATE OR REPLACE FUNCTION public.mcp_footage_scene_json(p_scene_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $scene$
  SELECT jsonb_build_object(
    'file_key', a.file_key,
    'scene_index', s.scene_index,
    'start_seconds', s.start_seconds::double precision,
    'end_seconds', s.end_seconds::double precision,
    'scene_kind', s.scene_kind,
    'summary', s.summary,
    'location_label', a.location_label,
    'product_label', a.product_label,
    'media_type', a.media_type,
    'thumb_storage_path', s.thumb_storage_path,
    'hijab', COALESCE(tags.hijab, false),
    'watermark_ui', COALESCE(tags.watermark_ui, false),
    'lengkuas', COALESCE(tags.lengkuas, false),
    'meja_biru', COALESCE(tags.meja_biru, false),
    'usage_count', COALESCE(uses.usage_count, 0),
    'banned', ban.id IS NOT NULL,
    'ban_reason', ban.reason
  )
  FROM public.footage_scenes s
  JOIN public.footage_assets a
    ON a.id = s.asset_id
   AND a.organization_id = s.organization_id
  LEFT JOIN LATERAL (
    SELECT
      bool_or(d.key = 'hijab' AND v.value_bool) AS hijab,
      bool_or(d.key = 'watermark_ui' AND v.value_bool) AS watermark_ui,
      bool_or(d.key = 'lengkuas' AND v.value_bool) AS lengkuas,
      bool_or(d.key = 'meja_biru' AND v.value_bool) AS meja_biru
    FROM public.footage_tag_values v
    JOIN public.footage_tag_defs d
      ON d.id = v.tag_def_id
     AND d.organization_id = v.organization_id
    WHERE v.scene_id = s.id
      AND v.organization_id = s.organization_id
  ) tags ON true
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT u.external_ref)::int AS usage_count
    FROM public.footage_usages u
    WHERE u.organization_id = s.organization_id
      AND u.asset_id = s.asset_id
      AND u.external_ref IS NOT NULL
      AND public.mcp_footage_usage_overlaps(s.start_seconds, s.end_seconds, u.in_seconds, u.out_seconds)
  ) uses ON true
  LEFT JOIN public.footage_bans ban
    ON ban.scene_id = s.id
   AND ban.organization_id = s.organization_id
  WHERE s.id = p_scene_id;
$scene$;

REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM service_role;

CREATE OR REPLACE FUNCTION public.mcp_get_catalog_product(
  p_user_id uuid,
  p_organization_id uuid,
  p_id text,
  p_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $get_product$
DECLARE
  v_id text := NULLIF(lower(btrim(COALESCE(p_id, ''))), '');
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_by_id public.catalog_menus%ROWTYPE;
  v_by_name public.catalog_menus%ROWTYPE;
  v_menu public.catalog_menus%ROWTYPE;
  v_count integer;
  v_fields jsonb;
  v_photos jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  IF v_id IS NULL AND v_name IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT *
    INTO v_by_id
    FROM public.catalog_menus m
    WHERE m.organization_id = p_organization_id
      AND m.external_id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_name IS NOT NULL THEN
    SELECT count(*)::int
    INTO v_count
    FROM public.catalog_menus m
    WHERE m.organization_id = p_organization_id
      AND (
        lower(btrim(m.name)) = lower(v_name)
        OR EXISTS (
          SELECT 1
          FROM unnest(m.aliases) AS alias
          WHERE lower(btrim(alias)) = lower(v_name)
        )
      );
    IF v_count = 0 THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_count > 1 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_by_name
    FROM public.catalog_menus m
    WHERE m.organization_id = p_organization_id
      AND (
        lower(btrim(m.name)) = lower(v_name)
        OR EXISTS (
          SELECT 1
          FROM unnest(m.aliases) AS alias
          WHERE lower(btrim(alias)) = lower(v_name)
        )
      );
  END IF;

  IF v_id IS NOT NULL AND v_name IS NOT NULL AND v_by_id.id IS DISTINCT FROM v_by_name.id THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_menu := CASE WHEN v_id IS NOT NULL THEN v_by_id ELSE v_by_name END;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', f.field_key,
        'body', f.body,
        'position', f.position
      )
      ORDER BY f.position
    ),
    '[]'::jsonb
  )
  INTO v_fields
  FROM public.catalog_menu_fields f
  WHERE f.menu_id = v_menu.id
    AND f.organization_id = v_menu.organization_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'file_path', p.file_path,
        'storage_path', p.storage_path,
        'label', p.label,
        'ref', p.ref,
        'position', p.position
      )
      ORDER BY p.position
    ),
    '[]'::jsonb
  )
  INTO v_photos
  FROM public.catalog_menu_photos p
  WHERE p.menu_id = v_menu.id
    AND p.organization_id = v_menu.organization_id;

  RETURN jsonb_build_object(
    'id', v_menu.external_id,
    'name', v_menu.name,
    'aliases', to_jsonb(v_menu.aliases),
    'waiting', NOT EXISTS (
      SELECT 1
      FROM public.catalog_menu_fields f
      WHERE f.menu_id = v_menu.id
        AND f.organization_id = v_menu.organization_id
        AND btrim(f.body) <> ''
    ),
    'product_knowledge_id', v_menu.product_knowledge_id,
    'fields', COALESCE(v_fields, '[]'::jsonb),
    'photos', COALESCE(v_photos, '[]'::jsonb)
  );
END;
$get_product$;

CREATE OR REPLACE FUNCTION public.mcp_get_catalog_location(
  p_user_id uuid,
  p_organization_id uuid,
  p_id text,
  p_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $get_location$
DECLARE
  v_id text := NULLIF(lower(btrim(COALESCE(p_id, ''))), '');
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_by_id public.catalog_locations%ROWTYPE;
  v_by_name public.catalog_locations%ROWTYPE;
  v_location public.catalog_locations%ROWTYPE;
  v_count integer;
  v_photos jsonb;
  v_sections jsonb;
  v_areas jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  IF v_id IS NULL AND v_name IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT *
    INTO v_by_id
    FROM public.catalog_locations l
    WHERE l.organization_id = p_organization_id
      AND l.external_id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_name IS NOT NULL THEN
    SELECT count(*)::int
    INTO v_count
    FROM public.catalog_locations l
    WHERE l.organization_id = p_organization_id
      AND lower(btrim(l.name)) = lower(v_name);
    IF v_count = 0 THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_count > 1 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_by_name
    FROM public.catalog_locations l
    WHERE l.organization_id = p_organization_id
      AND lower(btrim(l.name)) = lower(v_name);
  END IF;

  IF v_id IS NOT NULL AND v_name IS NOT NULL AND v_by_id.id IS DISTINCT FROM v_by_name.id THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_location := CASE WHEN v_id IS NOT NULL THEN v_by_id ELSE v_by_name END;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'file_path', p.file_path,
        'storage_path', p.storage_path,
        'label', p.label,
        'ref', p.ref,
        'description', p.description,
        'areas', to_jsonb(p.areas),
        'position', p.position
      )
      ORDER BY p.position
    ),
    '[]'::jsonb
  )
  INTO v_photos
  FROM public.catalog_location_photos p
  WHERE p.location_id = v_location.id
    AND p.organization_id = v_location.organization_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'title', s.title,
        'body', s.body,
        'areas', to_jsonb(s.areas),
        'position', s.position
      )
      ORDER BY s.position
    ),
    '[]'::jsonb
  )
  INTO v_sections
  FROM public.catalog_location_sections s
  WHERE s.location_id = v_location.id
    AND s.organization_id = v_location.organization_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', a.name,
        'body', a.body,
        'position', a.position
      )
      ORDER BY a.position
    ),
    '[]'::jsonb
  )
  INTO v_areas
  FROM public.catalog_location_areas a
  WHERE a.location_id = v_location.id
    AND a.organization_id = v_location.organization_id;

  RETURN jsonb_build_object(
    'id', v_location.external_id,
    'name', v_location.name,
    'waiting',
      NOT EXISTS (
        SELECT 1
        FROM public.catalog_location_sections s
        WHERE s.location_id = v_location.id
          AND s.organization_id = v_location.organization_id
          AND btrim(s.body) <> ''
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.catalog_location_photos p
        WHERE p.location_id = v_location.id
          AND p.organization_id = v_location.organization_id
          AND btrim(COALESCE(p.description, '')) <> ''
      ),
    'photos', COALESCE(v_photos, '[]'::jsonb),
    'sections', COALESCE(v_sections, '[]'::jsonb),
    'areas', COALESCE(v_areas, '[]'::jsonb)
  );
END;
$get_location$;

REVOKE ALL ON FUNCTION public.mcp_get_catalog_product(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_catalog_product(uuid, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_catalog_product(uuid, uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_get_catalog_location(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_catalog_location(uuid, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_catalog_location(uuid, uuid, text, text) TO service_role;
