-- 480p previews live in the same private catalog-media bucket.
-- Members may read thumbs, photos, and previews. They still cannot write or delete objects.
-- Deleting a clip, photo, or reference image is a soft delete for 30 days.
-- This file does not delete rows or storage objects.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']::text[]
WHERE id = 'catalog-media';

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
    AND (storage.foldername(name))[2] IN ('thumbs', 'photos', 'previews')
  );

ALTER TABLE public.footage_assets
  ADD CONSTRAINT footage_assets_preview_path_check CHECK (
    preview_storage_path IS NULL
    OR (
      char_length(preview_storage_path) <= 500
      AND preview_storage_path = organization_id::text || '/previews/' || id::text || '.mp4'
    )
  );

COMMENT ON COLUMN public.footage_assets.preview_storage_path IS
  'Private catalog-media object {org}/previews/{asset_id}.mp4. Null until the 480p preview exists. footage.move does not change this path or any storage object.';

ALTER TABLE public.footage_assets
  DROP CONSTRAINT footage_assets_storage_status_check;

ALTER TABLE public.footage_assets
  ADD CONSTRAINT footage_assets_storage_status_check CHECK (
    storage_status IN ('inbox', 'bank', 'missing')
  );

COMMENT ON COLUMN public.footage_assets.storage_status IS
  'inbox, bank, or missing. missing means the laptop file was not at its stored address. The row and its storage objects stay.';

ALTER TABLE public.footage_assets
  ADD COLUMN deleted_at timestamptz;

COMMENT ON COLUMN public.footage_assets.deleted_at IS
  'Soft delete. Hidden from search, get, and member reads. Restore is allowed for 30 days. Purge then removes the row; storage objects are removed by the purge script, not by this column.';

CREATE INDEX footage_assets_deleted_at_idx
  ON public.footage_assets (organization_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

ALTER TABLE public.catalog_menu_photos
  ADD COLUMN deleted_at timestamptz;

ALTER TABLE public.catalog_location_photos
  ADD COLUMN deleted_at timestamptz;

COMMENT ON COLUMN public.catalog_menu_photos.deleted_at IS
  'Soft delete. Hidden from catalog reads. The storage object stays until the purge script removes it.';

COMMENT ON COLUMN public.catalog_location_photos.deleted_at IS
  'Soft delete. Hidden from catalog reads. The storage object stays until the purge script removes it.';

CREATE TABLE public.catalog_media_tombstones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  kind text NOT NULL,
  object_paths text[] NOT NULL,
  payload jsonb NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  purge_after timestamptz NOT NULL,
  restored_at timestamptz,
  purged_at timestamptz,
  CONSTRAINT catalog_media_tombstones_kind_check CHECK (kind = 'reference_image'),
  CONSTRAINT catalog_media_tombstones_paths_check CHECK (cardinality(object_paths) BETWEEN 1 AND 20),
  CONSTRAINT catalog_media_tombstones_payload_check CHECK (
    jsonb_typeof(payload) = 'object'
    AND octet_length(payload::text) <= 100000
  ),
  CONSTRAINT catalog_media_tombstones_state_check CHECK (restored_at IS NULL OR purged_at IS NULL)
);

COMMENT ON TABLE public.catalog_media_tombstones IS
  'Reference image hidden from its document for 30 days. The storage object stays until the purge script removes it.';

CREATE INDEX catalog_media_tombstones_open_idx
  ON public.catalog_media_tombstones (organization_id, deleted_at)
  WHERE restored_at IS NULL AND purged_at IS NULL;

ALTER TABLE public.catalog_media_tombstones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.catalog_media_tombstones FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.catalog_media_tombstones TO service_role;

-- ---------------------------------------------------------------------------
-- Member reads hide soft-deleted rows. service_role bypasses these policies.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS footage_assets_org ON public.footage_assets;
CREATE POLICY footage_assets_org
  ON public.footage_assets
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND deleted_at IS NULL
  )
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS footage_scenes_org ON public.footage_scenes;
CREATE POLICY footage_scenes_org
  ON public.footage_scenes
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND NOT EXISTS (
      SELECT 1
      FROM public.footage_assets a
      WHERE a.id = footage_scenes.asset_id
        AND a.organization_id = footage_scenes.organization_id
        AND a.deleted_at IS NOT NULL
    )
  )
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS footage_usages_org ON public.footage_usages;
CREATE POLICY footage_usages_org
  ON public.footage_usages
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND NOT EXISTS (
      SELECT 1
      FROM public.footage_assets a
      WHERE a.id = footage_usages.asset_id
        AND a.organization_id = footage_usages.organization_id
        AND a.deleted_at IS NOT NULL
    )
  )
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS footage_bans_org ON public.footage_bans;
CREATE POLICY footage_bans_org
  ON public.footage_bans
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND NOT EXISTS (
      SELECT 1
      FROM public.footage_scenes s
      JOIN public.footage_assets a
        ON a.id = s.asset_id
       AND a.organization_id = s.organization_id
      WHERE s.id = footage_bans.scene_id
        AND s.organization_id = footage_bans.organization_id
        AND a.deleted_at IS NOT NULL
    )
  )
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS footage_tag_values_org ON public.footage_tag_values;
CREATE POLICY footage_tag_values_org
  ON public.footage_tag_values
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND NOT EXISTS (
      SELECT 1
      FROM public.footage_assets a
      WHERE a.organization_id = footage_tag_values.organization_id
        AND a.deleted_at IS NOT NULL
        AND (
          a.id = footage_tag_values.asset_id
          OR EXISTS (
            SELECT 1
            FROM public.footage_scenes s
            WHERE s.id = footage_tag_values.scene_id
              AND s.organization_id = footage_tag_values.organization_id
              AND s.asset_id = a.id
          )
        )
    )
  )
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS catalog_menu_photos_org ON public.catalog_menu_photos;
CREATE POLICY catalog_menu_photos_org
  ON public.catalog_menu_photos
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND deleted_at IS NULL
  )
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS catalog_location_photos_org ON public.catalog_location_photos;
CREATE POLICY catalog_location_photos_org
  ON public.catalog_location_photos
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND deleted_at IS NULL
  )
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- A deleted clip cannot be edited. Deletes still cascade when purge removes the row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.footage_reject_deleted_asset_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $reject_asset$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL THEN
    IF (to_jsonb(NEW) - 'deleted_at' - 'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD) - 'deleted_at' - 'updated_at') THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN NEW;
END;
$reject_asset$;

CREATE OR REPLACE FUNCTION public.footage_reject_deleted_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $reject_parent$
DECLARE
  v_asset uuid;
  v_org uuid;
BEGIN
  v_org := NEW.organization_id;
  IF TG_TABLE_NAME = 'footage_bans' THEN
    SELECT s.asset_id
    INTO v_asset
    FROM public.footage_scenes s
    WHERE s.id = NEW.scene_id
      AND s.organization_id = v_org;
  ELSIF TG_TABLE_NAME = 'footage_tag_values' AND NEW.asset_id IS NULL THEN
    SELECT s.asset_id
    INTO v_asset
    FROM public.footage_scenes s
    WHERE s.id = NEW.scene_id
      AND s.organization_id = v_org;
  ELSE
    v_asset := NEW.asset_id;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.footage_assets a
    WHERE a.id = v_asset
      AND a.organization_id = v_org
      AND a.deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END;
$reject_parent$;

DROP TRIGGER IF EXISTS footage_assets_reject_deleted_edit ON public.footage_assets;
CREATE TRIGGER footage_assets_reject_deleted_edit
  BEFORE UPDATE ON public.footage_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.footage_reject_deleted_asset_update();

DROP TRIGGER IF EXISTS footage_scenes_reject_deleted_parent ON public.footage_scenes;
CREATE TRIGGER footage_scenes_reject_deleted_parent
  BEFORE INSERT OR UPDATE ON public.footage_scenes
  FOR EACH ROW
  EXECUTE FUNCTION public.footage_reject_deleted_parent();

DROP TRIGGER IF EXISTS footage_usages_reject_deleted_parent ON public.footage_usages;
CREATE TRIGGER footage_usages_reject_deleted_parent
  BEFORE INSERT OR UPDATE ON public.footage_usages
  FOR EACH ROW
  EXECUTE FUNCTION public.footage_reject_deleted_parent();

DROP TRIGGER IF EXISTS footage_tag_values_reject_deleted_parent ON public.footage_tag_values;
CREATE TRIGGER footage_tag_values_reject_deleted_parent
  BEFORE INSERT OR UPDATE ON public.footage_tag_values
  FOR EACH ROW
  EXECUTE FUNCTION public.footage_reject_deleted_parent();

DROP TRIGGER IF EXISTS footage_bans_reject_deleted_parent ON public.footage_bans;
CREATE TRIGGER footage_bans_reject_deleted_parent
  BEFORE INSERT OR UPDATE ON public.footage_bans
  FOR EACH ROW
  EXECUTE FUNCTION public.footage_reject_deleted_parent();

REVOKE ALL ON FUNCTION public.footage_reject_deleted_asset_update() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.footage_reject_deleted_parent() FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.mcp_apply_footage_move(uuid, uuid, uuid) IS
  'MCP footage.move. Sets storage_status to bank and changes the laptop address only. Does not change thumbnail or preview storage paths and does not delete a storage object.';

-- ---------------------------------------------------------------------------
-- Preview rows for delete and restore.
-- ---------------------------------------------------------------------------

ALTER TABLE public.mcp_footage_previews
  DROP CONSTRAINT mcp_footage_previews_tool_check;

ALTER TABLE public.mcp_footage_previews
  ADD CONSTRAINT mcp_footage_previews_tool_check CHECK (
    tool IN (
      'footage.scenes.upsert_batch',
      'footage.usage.log',
      'footage.move',
      'footage.ban.add',
      'footage.clips.upsert',
      'footage.delete',
      'footage.restore',
      'catalog.media.delete',
      'catalog.media.restore'
    )
  );

CREATE OR REPLACE FUNCTION public.catalog_footage_storage_paths(
  p_asset_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $paths$
  SELECT COALESCE(jsonb_agg(item.obj ORDER BY item.sort_key, item.path), '[]'::jsonb)
  FROM (
    SELECT
      1 AS sort_key,
      s.thumb_storage_path AS path,
      jsonb_build_object('kind', 'scene_thumb', 'path', s.thumb_storage_path) AS obj
    FROM public.footage_scenes s
    WHERE s.asset_id = p_asset_id
      AND s.organization_id = p_organization_id
      AND s.thumb_storage_path IS NOT NULL
    UNION ALL
    SELECT
      2,
      a.preview_storage_path,
      jsonb_build_object('kind', 'preview', 'path', a.preview_storage_path)
    FROM public.footage_assets a
    WHERE a.id = p_asset_id
      AND a.organization_id = p_organization_id
      AND a.preview_storage_path IS NOT NULL
    UNION ALL
    SELECT
      3,
      a.thumb_storage_path,
      jsonb_build_object('kind', 'clip_thumb', 'path', a.thumb_storage_path)
    FROM public.footage_assets a
    WHERE a.id = p_asset_id
      AND a.organization_id = p_organization_id
      AND a.thumb_storage_path IS NOT NULL
  ) item;
$paths$;

CREATE OR REPLACE FUNCTION public.catalog_reference_clear_path(p_document jsonb, p_path text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $clear_path$
DECLARE
  v_doc jsonb := p_document;
  v_beats jsonb;
  v_mg jsonb;
  v_item jsonb;
  v_i integer;
  v_targets jsonb := '[]'::jsonb;
  v_laptop text;
BEGIN
  IF jsonb_typeof(v_doc) <> 'object' OR p_path IS NULL OR btrim(p_path) = '' THEN
    RETURN jsonb_build_object('found', false, 'document', p_document, 'targets', '[]'::jsonb);
  END IF;

  IF v_doc->>'sheet_storage_path' = p_path THEN
    v_laptop := v_doc->>'sheet';
    v_doc := jsonb_set(v_doc, '{sheet_storage_path}', 'null'::jsonb, true);
    v_targets := v_targets || jsonb_build_array(jsonb_build_object(
      'slot', 'sheet',
      'key', 'sheet_storage_path',
      'path', p_path,
      'laptop', v_laptop
    ));
  END IF;

  v_beats := v_doc->'beats';
  IF jsonb_typeof(v_beats) = 'array' THEN
    FOR v_i IN 0..jsonb_array_length(v_beats) - 1 LOOP
      v_item := v_beats->v_i;
      IF jsonb_typeof(v_item) = 'object' AND v_item->>'storage_path' = p_path THEN
        v_laptop := v_item->>'thumb';
        v_item := jsonb_set(v_item, '{storage_path}', 'null'::jsonb, true);
        v_beats := jsonb_set(v_beats, ARRAY[v_i::text], v_item, false);
        v_targets := v_targets || jsonb_build_array(jsonb_build_object(
          'slot', 'beat',
          'key', 'storage_path',
          'path', p_path,
          'laptop', v_laptop
        ));
      END IF;
    END LOOP;
    v_doc := jsonb_set(v_doc, '{beats}', v_beats, true);
  END IF;

  v_mg := v_doc->'mg';
  IF jsonb_typeof(v_mg) = 'array' THEN
    FOR v_i IN 0..jsonb_array_length(v_mg) - 1 LOOP
      v_item := v_mg->v_i;
      IF jsonb_typeof(v_item) = 'object' AND v_item->>'storage_path' = p_path THEN
        v_laptop := v_item->>'thumb';
        v_item := jsonb_set(v_item, '{storage_path}', 'null'::jsonb, true);
        v_targets := v_targets || jsonb_build_array(jsonb_build_object(
          'slot', 'mg',
          'key', 'storage_path',
          'path', p_path,
          'laptop', v_laptop
        ));
      END IF;
      IF jsonb_typeof(v_item) = 'object' AND v_item->>'sample_storage_path' = p_path THEN
        v_laptop := v_item->>'sample';
        v_item := jsonb_set(v_item, '{sample_storage_path}', 'null'::jsonb, true);
        v_targets := v_targets || jsonb_build_array(jsonb_build_object(
          'slot', 'mg_sample',
          'key', 'sample_storage_path',
          'path', p_path,
          'laptop', v_laptop
        ));
      END IF;
      IF jsonb_typeof(v_item) = 'object' THEN
        v_mg := jsonb_set(v_mg, ARRAY[v_i::text], v_item, false);
      END IF;
    END LOOP;
    v_doc := jsonb_set(v_doc, '{mg}', v_mg, true);
  END IF;

  RETURN jsonb_build_object(
    'found', jsonb_array_length(v_targets) > 0,
    'document', v_doc,
    'targets', v_targets
  );
END;
$clear_path$;

CREATE OR REPLACE FUNCTION public.catalog_reference_restore_paths(p_document jsonb, p_targets jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $restore_paths$
DECLARE
  v_doc jsonb := p_document;
  v_target jsonb;
  v_beats jsonb;
  v_mg jsonb;
  v_item jsonb;
  v_i integer;
  v_placed boolean;
  v_any_miss boolean := false;
  v_laptop text;
  v_path text;
  v_key text;
  v_rec record;
BEGIN
  IF jsonb_typeof(v_doc) <> 'object' OR jsonb_typeof(p_targets) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'document', p_document);
  END IF;

  FOR v_rec IN SELECT value FROM jsonb_array_elements(p_targets) AS element(value) LOOP
    v_target := v_rec.value;
    v_placed := false;
    v_laptop := NULLIF(v_target->>'laptop', '');
    v_path := NULLIF(v_target->>'path', '');
    v_key := v_target->>'key';
    IF v_laptop IS NULL OR v_path IS NULL THEN
      v_any_miss := true;
      CONTINUE;
    END IF;

    IF v_target->>'slot' = 'sheet' AND v_key = 'sheet_storage_path' AND v_doc->>'sheet' = v_laptop THEN
      IF jsonb_typeof(v_doc->'sheet_storage_path') = 'null'
         OR v_doc->>'sheet_storage_path' IS NULL
         OR v_doc->>'sheet_storage_path' = v_path THEN
        v_doc := jsonb_set(v_doc, '{sheet_storage_path}', to_jsonb(v_path), true);
        v_placed := true;
      END IF;
    END IF;

    IF v_target->>'slot' = 'beat' AND v_key = 'storage_path' AND jsonb_typeof(v_doc->'beats') = 'array' THEN
      v_beats := v_doc->'beats';
      FOR v_i IN 0..jsonb_array_length(v_beats) - 1 LOOP
        v_item := v_beats->v_i;
        IF jsonb_typeof(v_item) = 'object' AND v_item->>'thumb' = v_laptop THEN
          IF jsonb_typeof(v_item->'storage_path') = 'null'
             OR v_item->>'storage_path' IS NULL
             OR v_item->>'storage_path' = v_path THEN
            v_item := jsonb_set(v_item, '{storage_path}', to_jsonb(v_path), true);
            v_beats := jsonb_set(v_beats, ARRAY[v_i::text], v_item, false);
            v_placed := true;
          END IF;
        END IF;
      END LOOP;
      v_doc := jsonb_set(v_doc, '{beats}', v_beats, true);
    END IF;

    IF v_target->>'slot' IN ('mg', 'mg_sample') AND jsonb_typeof(v_doc->'mg') = 'array' THEN
      v_mg := v_doc->'mg';
      FOR v_i IN 0..jsonb_array_length(v_mg) - 1 LOOP
        v_item := v_mg->v_i;
        IF jsonb_typeof(v_item) = 'object'
           AND (
             (v_target->>'slot' = 'mg' AND v_key = 'storage_path' AND v_item->>'thumb' = v_laptop)
             OR (v_target->>'slot' = 'mg_sample' AND v_key = 'sample_storage_path' AND v_item->>'sample' = v_laptop)
           ) THEN
          IF jsonb_typeof(v_item->v_key) = 'null'
             OR v_item->>v_key IS NULL
             OR v_item->>v_key = v_path THEN
            v_item := jsonb_set(v_item, ARRAY[v_key], to_jsonb(v_path), true);
            v_mg := jsonb_set(v_mg, ARRAY[v_i::text], v_item, false);
            v_placed := true;
          END IF;
        END IF;
      END LOOP;
      v_doc := jsonb_set(v_doc, '{mg}', v_mg, true);
    END IF;

    IF NOT v_placed THEN
      v_any_miss := true;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', NOT v_any_miss, 'document', v_doc);
END;
$restore_paths$;

-- ---------------------------------------------------------------------------
-- Delete and restore. Storage objects stay until the purge script.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.catalog_media_grace()
RETURNS interval
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $grace$
  SELECT make_interval(secs => 2592000);
$grace$;

CREATE OR REPLACE FUNCTION public.catalog_footage_usage_digest(
  p_organization_id uuid,
  p_asset_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $usage_digest$
  SELECT COALESCE((
    SELECT md5(string_agg(u.id::text, ',' ORDER BY u.id))
    FROM public.footage_usages u
    WHERE u.organization_id = p_organization_id
      AND u.asset_id = p_asset_id
  ), '');
$usage_digest$;

CREATE OR REPLACE FUNCTION public.catalog_shot_mention_digest(
  p_organization_id uuid,
  p_needle text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $shot_digest$
  SELECT COALESCE((
    SELECT md5(string_agg(j.external_id, ',' ORDER BY j.external_id))
    FROM public.catalog_shot_jobs j
    WHERE j.organization_id = p_organization_id
      AND char_length(COALESCE(p_needle, '')) >= 8
      AND strpos(j.document::text, p_needle) > 0
  ), '');
$shot_digest$;

CREATE OR REPLACE FUNCTION public.mcp_preview_footage_delete(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_delete$
DECLARE
  v_key text;
  v_ack boolean := false;
  v_asset public.footage_assets%ROWTYPE;
  v_scenes integer;
  v_files jsonb;
  v_count integer;
  v_digest text;
  v_usages jsonb;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_input) AS object_key
    WHERE object_key NOT IN ('file_key', 'acknowledge_used')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_input->'file_key') <> 'string' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_key := public.mcp_footage_clean_key(p_input->>'file_key');
  IF jsonb_exists(p_input, 'acknowledge_used') THEN
    IF jsonb_typeof(p_input->'acknowledge_used') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_ack := (p_input->>'acknowledge_used')::boolean;
  END IF;

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_key
    AND a.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::int
  INTO v_scenes
  FROM public.footage_scenes s
  WHERE s.asset_id = v_asset.id
    AND s.organization_id = v_asset.organization_id;

  v_files := public.catalog_footage_storage_paths(v_asset.id, v_asset.organization_id);

  SELECT count(*)::int
  INTO v_count
  FROM public.footage_usages u
  WHERE u.organization_id = v_asset.organization_id
    AND u.asset_id = v_asset.id;
  v_digest := public.catalog_footage_usage_digest(v_asset.organization_id, v_asset.id);

  SELECT COALESCE(jsonb_agg(picked.obj), '[]'::jsonb)
  INTO v_usages
  FROM (
    SELECT jsonb_build_object(
      'external_ref', u.external_ref,
      'title', u.title,
      'in_seconds', u.in_seconds::double precision,
      'out_seconds', u.out_seconds::double precision,
      'social_media_plan_id', u.social_media_plan_id
    ) AS obj
    FROM public.footage_usages u
    WHERE u.organization_id = v_asset.organization_id
      AND u.asset_id = v_asset.id
    ORDER BY u.created_at, u.id
    LIMIT 20
  ) picked;

  IF v_count > 0 AND v_ack IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'file_key', v_asset.file_key,
      'media_type', v_asset.media_type,
      'summary', v_asset.summary,
      'scene_count', v_scenes,
      'storage_files', v_files,
      'used', true,
      'usage_count', v_count,
      'usages', v_usages,
      'can_save', false,
      'storage_kept', true
    );
  END IF;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'footage.delete',
    jsonb_build_object(
      'file_key', v_asset.file_key,
      'asset_id', v_asset.id,
      'acknowledge_used', v_ack,
      'usage_count', v_count,
      'usage_digest', v_digest
    ),
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'file_key', v_asset.file_key,
    'media_type', v_asset.media_type,
    'summary', v_asset.summary,
    'scene_count', v_scenes,
    'storage_files', v_files,
    'used', v_count > 0,
    'usage_count', v_count,
    'usages', v_usages,
    'can_save', true,
    'storage_kept', true,
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_delete$;

CREATE OR REPLACE FUNCTION public.mcp_apply_footage_delete(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_delete$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
  v_count integer;
  v_digest text;
  v_deleted timestamptz;
  v_files jsonb;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id, p_organization_id, p_preview_id, 'footage.delete'
  );

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key'
    AND a.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_asset.id::text <> v_payload->>'asset_id' THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::int
  INTO v_count
  FROM public.footage_usages u
  WHERE u.organization_id = v_asset.organization_id
    AND u.asset_id = v_asset.id;
  v_digest := public.catalog_footage_usage_digest(v_asset.organization_id, v_asset.id);
  IF v_digest IS DISTINCT FROM COALESCE(v_payload->>'usage_digest', '')
     OR v_count IS DISTINCT FROM COALESCE((v_payload->>'usage_count')::integer, -1) THEN
    RAISE EXCEPTION 'used_since_preview' USING ERRCODE = 'P0001';
  END IF;
  IF v_count > 0 AND COALESCE((v_payload->>'acknowledge_used')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'used_needs_confirm' USING ERRCODE = 'P0001';
  END IF;

  v_files := public.catalog_footage_storage_paths(v_asset.id, v_asset.organization_id);

  UPDATE public.footage_assets a
  SET deleted_at = now()
  WHERE a.id = v_asset.id
    AND a.organization_id = p_organization_id
    AND a.deleted_at IS NULL
  RETURNING a.deleted_at INTO v_deleted;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'file_key', v_asset.file_key,
    'deleted_at', v_deleted,
    'purge_after', v_deleted + public.catalog_media_grace(),
    'storage_kept', true,
    'storage_files', v_files
  );
END;
$apply_delete$;

CREATE OR REPLACE FUNCTION public.mcp_preview_footage_restore(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_restore$
DECLARE
  v_key text;
  v_asset public.footage_assets%ROWTYPE;
  v_scenes integer;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_input) AS object_key
    WHERE object_key <> 'file_key'
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_key := public.mcp_footage_clean_key(p_input->>'file_key');

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_key
    AND a.deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::int
  INTO v_scenes
  FROM public.footage_scenes s
  WHERE s.asset_id = v_asset.id
    AND s.organization_id = v_asset.organization_id;

  IF v_asset.deleted_at <= now() - public.catalog_media_grace() THEN
    RETURN jsonb_build_object(
      'file_key', v_asset.file_key,
      'deleted_at', v_asset.deleted_at,
      'purge_after', v_asset.deleted_at + public.catalog_media_grace(),
      'scene_count', v_scenes,
      'can_save', false,
      'reason', 'restore_expired'
    );
  END IF;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'footage.restore',
    jsonb_build_object('file_key', v_asset.file_key, 'asset_id', v_asset.id),
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'file_key', v_asset.file_key,
    'deleted_at', v_asset.deleted_at,
    'purge_after', v_asset.deleted_at + public.catalog_media_grace(),
    'scene_count', v_scenes,
    'can_save', true,
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_restore$;

CREATE OR REPLACE FUNCTION public.mcp_apply_footage_restore(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_restore$
DECLARE
  v_payload jsonb;
  v_asset public.footage_assets%ROWTYPE;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id, p_organization_id, p_preview_id, 'footage.restore'
  );

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_payload->>'file_key'
    AND a.deleted_at IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND OR v_asset.id::text <> v_payload->>'asset_id' THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_asset.deleted_at <= now() - public.catalog_media_grace() THEN
    RAISE EXCEPTION 'restore_expired' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.footage_assets a
  SET deleted_at = NULL
  WHERE a.id = v_asset.id
    AND a.organization_id = p_organization_id;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'file_key', v_asset.file_key,
    'deleted_at', NULL
  );
END;
$apply_restore$;

CREATE OR REPLACE FUNCTION public.mcp_preview_catalog_media_delete(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_media_delete$
DECLARE
  v_kind text;
  v_ack boolean := false;
  v_id uuid;
  v_external text;
  v_path text;
  v_photo_path text;
  v_photo_storage text;
  v_label text;
  v_count integer := 0;
  v_digest text := '';
  v_names jsonb := '[]'::jsonb;
  v_doc jsonb;
  v_cleared jsonb;
  v_preview uuid;
  v_expires timestamptz;
  v_allowed text[];
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_kind := p_input->>'kind';
  IF v_kind = 'menu_photo' OR v_kind = 'location_photo' THEN
    v_allowed := ARRAY['kind', 'id', 'acknowledge_used'];
  ELSIF v_kind = 'reference_image' THEN
    v_allowed := ARRAY['kind', 'external_id', 'storage_path', 'acknowledge_used'];
  ELSE
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_input) AS object_key
    WHERE object_key <> ALL (v_allowed)
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_exists(p_input, 'acknowledge_used') THEN
    IF jsonb_typeof(p_input->'acknowledge_used') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_ack := (p_input->>'acknowledge_used')::boolean;
  END IF;

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  IF v_kind = 'reference_image' THEN
    IF jsonb_typeof(p_input->'external_id') <> 'string'
       OR jsonb_typeof(p_input->'storage_path') <> 'string' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_external := NULLIF(lower(btrim(p_input->>'external_id')), '');
    v_path := btrim(p_input->>'storage_path');
    IF v_external IS NULL OR char_length(v_external) > 80 OR char_length(v_path) > 500
       OR strpos(v_path, p_organization_id::text || '/thumbs/references/') <> 1
       OR strpos(v_path, '..') > 0 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    SELECT r.document
    INTO v_doc
    FROM public.catalog_references r
    WHERE r.organization_id = p_organization_id
      AND r.external_id = v_external;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    v_cleared := public.catalog_reference_clear_path(v_doc, v_path);
    IF COALESCE((v_cleared->>'found')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    v_digest := public.catalog_shot_mention_digest(p_organization_id, v_path);
    SELECT count(*)::int
    INTO v_count
    FROM public.catalog_shot_jobs j
    WHERE j.organization_id = p_organization_id
      AND strpos(j.document::text, v_path) > 0;
  ELSE
    IF jsonb_typeof(p_input->'id') <> 'string'
       OR (p_input->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_id := (p_input->>'id')::uuid;
    IF v_kind = 'menu_photo' THEN
      SELECT p.file_path, p.storage_path, p.label
      INTO v_photo_path, v_photo_storage, v_label
      FROM public.catalog_menu_photos p
      WHERE p.organization_id = p_organization_id
        AND p.id = v_id
        AND p.deleted_at IS NULL;
    ELSE
      SELECT p.file_path, p.storage_path, p.label
      INTO v_photo_path, v_photo_storage, v_label
      FROM public.catalog_location_photos p
      WHERE p.organization_id = p_organization_id
        AND p.id = v_id
        AND p.deleted_at IS NULL;
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    v_digest := public.catalog_shot_mention_digest(p_organization_id, v_photo_path);
    IF char_length(COALESCE(v_photo_path, '')) >= 8 THEN
      SELECT count(*)::int
      INTO v_count
      FROM public.catalog_shot_jobs j
      WHERE j.organization_id = p_organization_id
        AND strpos(j.document::text, v_photo_path) > 0;
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(picked.external_id), '[]'::jsonb)
  INTO v_names
  FROM (
    SELECT j.external_id
    FROM public.catalog_shot_jobs j
    WHERE j.organization_id = p_organization_id
      AND char_length(COALESCE(CASE WHEN v_kind = 'reference_image' THEN v_path ELSE v_photo_path END, '')) >= 8
      AND strpos(j.document::text, CASE WHEN v_kind = 'reference_image' THEN v_path ELSE v_photo_path END) > 0
    ORDER BY j.external_id
    LIMIT 20
  ) picked;

  IF v_count > 0 AND v_ack IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'kind', v_kind,
      'id', v_id,
      'external_id', v_external,
      'file_path', v_photo_path,
      'storage_path', CASE WHEN v_kind = 'reference_image' THEN v_path ELSE v_photo_storage END,
      'label', v_label,
      'used', true,
      'usage_count', v_count,
      'usages', v_names,
      'can_save', false,
      'storage_kept', true
    );
  END IF;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'catalog.media.delete',
    jsonb_build_object(
      'kind', v_kind,
      'id', v_id,
      'external_id', v_external,
      'storage_path', CASE WHEN v_kind = 'reference_image' THEN v_path ELSE v_photo_storage END,
      'file_path', v_photo_path,
      'acknowledge_used', v_ack,
      'usage_count', v_count,
      'usage_digest', v_digest
    ),
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_preview, v_expires;

  RETURN jsonb_build_object(
    'kind', v_kind,
    'id', v_id,
    'external_id', v_external,
    'file_path', v_photo_path,
    'storage_path', CASE WHEN v_kind = 'reference_image' THEN v_path ELSE v_photo_storage END,
    'label', v_label,
    'used', v_count > 0,
    'usage_count', v_count,
    'usages', v_names,
    'can_save', true,
    'storage_kept', true,
    'preview_id', v_preview,
    'expires_at', v_expires
  );
END;
$preview_media_delete$;

CREATE OR REPLACE FUNCTION public.mcp_apply_catalog_media_delete(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_media_delete$
DECLARE
  v_payload jsonb;
  v_kind text;
  v_id uuid;
  v_path text;
  v_file text;
  v_count integer := 0;
  v_digest text;
  v_doc jsonb;
  v_cleared jsonb;
  v_deleted timestamptz;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id, p_organization_id, p_preview_id, 'catalog.media.delete'
  );
  v_kind := v_payload->>'kind';
  v_file := v_payload->>'file_path';
  v_path := v_payload->>'storage_path';

  IF v_kind = 'reference_image' THEN
    v_digest := public.catalog_shot_mention_digest(p_organization_id, v_path);
    SELECT count(*)::int
    INTO v_count
    FROM public.catalog_shot_jobs j
    WHERE j.organization_id = p_organization_id
      AND strpos(j.document::text, v_path) > 0;
  ELSIF char_length(COALESCE(v_file, '')) >= 8 THEN
    v_digest := public.catalog_shot_mention_digest(p_organization_id, v_file);
    SELECT count(*)::int
    INTO v_count
    FROM public.catalog_shot_jobs j
    WHERE j.organization_id = p_organization_id
      AND strpos(j.document::text, v_file) > 0;
  ELSE
    v_digest := '';
  END IF;

  IF v_digest IS DISTINCT FROM COALESCE(v_payload->>'usage_digest', '')
     OR v_count IS DISTINCT FROM COALESCE((v_payload->>'usage_count')::integer, -1) THEN
    RAISE EXCEPTION 'used_since_preview' USING ERRCODE = 'P0001';
  END IF;
  IF v_count > 0 AND COALESCE((v_payload->>'acknowledge_used')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'used_needs_confirm' USING ERRCODE = 'P0001';
  END IF;

  IF v_kind = 'menu_photo' OR v_kind = 'location_photo' THEN
    v_id := (v_payload->>'id')::uuid;
    IF v_kind = 'menu_photo' THEN
      UPDATE public.catalog_menu_photos p
      SET deleted_at = now()
      WHERE p.organization_id = p_organization_id
        AND p.id = v_id
        AND p.deleted_at IS NULL
      RETURNING p.deleted_at INTO v_deleted;
    ELSE
      UPDATE public.catalog_location_photos p
      SET deleted_at = now()
      WHERE p.organization_id = p_organization_id
        AND p.id = v_id
        AND p.deleted_at IS NULL
      RETURNING p.deleted_at INTO v_deleted;
    END IF;
    IF v_deleted IS NULL THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  ELSIF v_kind = 'reference_image' THEN
    SELECT r.document
    INTO v_doc
    FROM public.catalog_references r
    WHERE r.organization_id = p_organization_id
      AND r.external_id = v_payload->>'external_id'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    v_cleared := public.catalog_reference_clear_path(v_doc, v_path);
    IF COALESCE((v_cleared->>'found')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.catalog_references r
    SET document = v_cleared->'document'
    WHERE r.organization_id = p_organization_id
      AND r.external_id = v_payload->>'external_id';
    INSERT INTO public.catalog_media_tombstones (
      organization_id, kind, object_paths, payload, purge_after
    )
    VALUES (
      p_organization_id,
      'reference_image',
      ARRAY[v_path],
      jsonb_build_object(
        'external_id', v_payload->>'external_id',
        'targets', v_cleared->'targets'
      ),
      now() + public.catalog_media_grace()
    )
    RETURNING deleted_at INTO v_deleted;
  ELSE
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'kind', v_kind,
    'id', v_id,
    'external_id', v_payload->>'external_id',
    'storage_path', v_path,
    'deleted_at', v_deleted,
    'purge_after', v_deleted + public.catalog_media_grace(),
    'storage_kept', true
  );
END;
$apply_media_delete$;

CREATE OR REPLACE FUNCTION public.mcp_preview_catalog_media_restore(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_media_restore$
DECLARE
  v_kind text;
  v_id uuid;
  v_external text;
  v_path text;
  v_deleted timestamptz;
  v_row public.catalog_media_tombstones%ROWTYPE;
  v_doc jsonb;
  v_restored jsonb;
  v_preview uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_kind := p_input->>'kind';
  IF v_kind = 'menu_photo' OR v_kind = 'location_photo' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_input) AS object_key
      WHERE object_key NOT IN ('kind', 'id')
    ) OR (p_input->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_id := (p_input->>'id')::uuid;
    IF v_kind = 'menu_photo' THEN
      SELECT p.deleted_at, p.storage_path
      INTO v_deleted, v_path
      FROM public.catalog_menu_photos p
      WHERE p.organization_id = p_organization_id
        AND p.id = v_id
        AND p.deleted_at IS NOT NULL;
    ELSE
      SELECT p.deleted_at, p.storage_path
      INTO v_deleted, v_path
      FROM public.catalog_location_photos p
      WHERE p.organization_id = p_organization_id
        AND p.id = v_id
        AND p.deleted_at IS NOT NULL;
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  ELSIF v_kind = 'reference_image' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_input) AS object_key
      WHERE object_key NOT IN ('kind', 'external_id', 'storage_path')
    ) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_external := NULLIF(lower(btrim(p_input->>'external_id')), '');
    v_path := btrim(COALESCE(p_input->>'storage_path', ''));
    IF v_external IS NULL OR strpos(v_path, p_organization_id::text || '/thumbs/references/') <> 1 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    SELECT *
    INTO v_row
    FROM public.catalog_media_tombstones t
    WHERE t.organization_id = p_organization_id
      AND t.kind = 'reference_image'
      AND t.restored_at IS NULL
      AND t.purged_at IS NULL
      AND t.object_paths = ARRAY[v_path]
      AND t.payload->>'external_id' = v_external
    ORDER BY t.deleted_at DESC
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    v_deleted := v_row.deleted_at;
    SELECT r.document
    INTO v_doc
    FROM public.catalog_references r
    WHERE r.organization_id = p_organization_id
      AND r.external_id = v_external;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    v_restored := public.catalog_reference_restore_paths(v_doc, v_row.payload->'targets');
    IF COALESCE((v_restored->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_deleted <= now() - public.catalog_media_grace() THEN
    RETURN jsonb_build_object(
      'kind', v_kind,
      'id', v_id,
      'external_id', v_external,
      'storage_path', v_path,
      'deleted_at', v_deleted,
      'can_save', false,
      'reason', 'restore_expired'
    );
  END IF;

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'catalog.media.restore',
    jsonb_build_object(
      'kind', v_kind,
      'id', v_id,
      'external_id', v_external,
      'storage_path', v_path,
      'tombstone_id', CASE WHEN v_kind = 'reference_image' THEN v_row.id ELSE NULL END
    ),
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_preview, v_expires;

  RETURN jsonb_build_object(
    'kind', v_kind,
    'id', v_id,
    'external_id', v_external,
    'storage_path', v_path,
    'deleted_at', v_deleted,
    'purge_after', v_deleted + public.catalog_media_grace(),
    'can_save', true,
    'preview_id', v_preview,
    'expires_at', v_expires
  );
END;
$preview_media_restore$;

CREATE OR REPLACE FUNCTION public.mcp_apply_catalog_media_restore(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_media_restore$
DECLARE
  v_payload jsonb;
  v_kind text;
  v_id uuid;
  v_deleted timestamptz;
  v_row public.catalog_media_tombstones%ROWTYPE;
  v_doc jsonb;
  v_restored jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(
    p_user_id, p_organization_id, p_preview_id, 'catalog.media.restore'
  );
  v_kind := v_payload->>'kind';

  IF v_kind = 'menu_photo' OR v_kind = 'location_photo' THEN
    v_id := (v_payload->>'id')::uuid;
    IF v_kind = 'menu_photo' THEN
      SELECT p.deleted_at
      INTO v_deleted
      FROM public.catalog_menu_photos p
      WHERE p.organization_id = p_organization_id
        AND p.id = v_id
        AND p.deleted_at IS NOT NULL
      FOR UPDATE;
    ELSE
      SELECT p.deleted_at
      INTO v_deleted
      FROM public.catalog_location_photos p
      WHERE p.organization_id = p_organization_id
        AND p.id = v_id
        AND p.deleted_at IS NOT NULL
      FOR UPDATE;
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_deleted <= now() - public.catalog_media_grace() THEN
      RAISE EXCEPTION 'restore_expired' USING ERRCODE = 'P0001';
    END IF;
    IF v_kind = 'menu_photo' THEN
      UPDATE public.catalog_menu_photos p
      SET deleted_at = NULL
      WHERE p.id = v_id
        AND p.organization_id = p_organization_id;
    ELSE
      UPDATE public.catalog_location_photos p
      SET deleted_at = NULL
      WHERE p.id = v_id
        AND p.organization_id = p_organization_id;
    END IF;
  ELSIF v_kind = 'reference_image' THEN
    SELECT *
    INTO v_row
    FROM public.catalog_media_tombstones t
    WHERE t.id = (v_payload->>'tombstone_id')::uuid
      AND t.organization_id = p_organization_id
      AND t.restored_at IS NULL
      AND t.purged_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_row.deleted_at <= now() - public.catalog_media_grace() THEN
      RAISE EXCEPTION 'restore_expired' USING ERRCODE = 'P0001';
    END IF;
    SELECT r.document
    INTO v_doc
    FROM public.catalog_references r
    WHERE r.organization_id = p_organization_id
      AND r.external_id = v_payload->>'external_id'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    v_restored := public.catalog_reference_restore_paths(v_doc, v_row.payload->'targets');
    IF COALESCE((v_restored->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.catalog_references r
    SET document = v_restored->'document'
    WHERE r.organization_id = p_organization_id
      AND r.external_id = v_payload->>'external_id';
    UPDATE public.catalog_media_tombstones t
    SET restored_at = now()
    WHERE t.id = v_row.id;
  ELSE
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'kind', v_kind,
    'id', CASE WHEN v_kind = 'reference_image' THEN NULL ELSE v_id END,
    'external_id', v_payload->>'external_id',
    'storage_path', v_payload->>'storage_path',
    'deleted_at', NULL
  );
END;
$apply_media_restore$;

-- ---------------------------------------------------------------------------
-- Purge lists rows and then deletes those rows. It does not delete storage.
-- The script removes the objects through the Storage API first.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_catalog_media_purge_plan(p_grace_seconds integer DEFAULT 2592000)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $purge_plan$
DECLARE
  v_grace interval;
  v_footage jsonb;
  v_menu jsonb;
  v_location jsonb;
  v_references jsonb;
BEGIN
  IF p_grace_seconds IS NULL OR p_grace_seconds < 0 OR p_grace_seconds > 31622400 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_grace := make_interval(secs => p_grace_seconds);

  SELECT COALESCE(jsonb_agg(item.obj), '[]'::jsonb)
  INTO v_footage
  FROM (
    SELECT jsonb_build_object(
      'id', a.id,
      'organization_id', a.organization_id,
      'paths', public.catalog_footage_storage_paths(a.id, a.organization_id)
    ) AS obj
    FROM public.footage_assets a
    WHERE a.deleted_at IS NOT NULL
      AND a.deleted_at <= now() - v_grace
    ORDER BY a.deleted_at
    LIMIT 200
  ) item;

  SELECT COALESCE(jsonb_agg(item.obj), '[]'::jsonb)
  INTO v_menu
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'organization_id', p.organization_id,
      'paths', CASE
        WHEN p.storage_path IS NULL THEN '[]'::jsonb
        ELSE jsonb_build_array(p.storage_path)
      END
    ) AS obj
    FROM public.catalog_menu_photos p
    WHERE p.deleted_at IS NOT NULL
      AND p.deleted_at <= now() - v_grace
    ORDER BY p.deleted_at
    LIMIT 200
  ) item;

  SELECT COALESCE(jsonb_agg(item.obj), '[]'::jsonb)
  INTO v_location
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'organization_id', p.organization_id,
      'paths', CASE
        WHEN p.storage_path IS NULL THEN '[]'::jsonb
        ELSE jsonb_build_array(p.storage_path)
      END
    ) AS obj
    FROM public.catalog_location_photos p
    WHERE p.deleted_at IS NOT NULL
      AND p.deleted_at <= now() - v_grace
    ORDER BY p.deleted_at
    LIMIT 200
  ) item;

  SELECT COALESCE(jsonb_agg(item.obj), '[]'::jsonb)
  INTO v_references
  FROM (
    SELECT jsonb_build_object(
      'id', t.id,
      'organization_id', t.organization_id,
      'paths', to_jsonb(t.object_paths)
    ) AS obj
    FROM public.catalog_media_tombstones t
    WHERE t.restored_at IS NULL
      AND t.purged_at IS NULL
      AND t.deleted_at <= now() - v_grace
    ORDER BY t.deleted_at
    LIMIT 200
  ) item;

  RETURN jsonb_build_object(
    'footage', v_footage,
    'menu_photos', v_menu,
    'location_photos', v_location,
    'reference_images', v_references
  );
END;
$purge_plan$;

CREATE OR REPLACE FUNCTION public.mcp_catalog_media_purge_commit(
  p_ids jsonb,
  p_grace_seconds integer DEFAULT 2592000
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $purge_commit$
DECLARE
  v_grace interval;
  v_footage integer := 0;
  v_menu integer := 0;
  v_location integer := 0;
  v_references integer := 0;
BEGIN
  IF p_ids IS NULL OR jsonb_typeof(p_ids) <> 'object'
     OR p_grace_seconds IS NULL OR p_grace_seconds < 0 OR p_grace_seconds > 31622400 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_grace := make_interval(secs => p_grace_seconds);

  DELETE FROM public.footage_assets a
  WHERE a.deleted_at IS NOT NULL
    AND a.deleted_at <= now() - v_grace
    AND a.id IN (
      SELECT value::uuid
      FROM jsonb_array_elements_text(COALESCE(p_ids->'footage', '[]'::jsonb))
    );
  GET DIAGNOSTICS v_footage = ROW_COUNT;

  DELETE FROM public.catalog_menu_photos p
  WHERE p.deleted_at IS NOT NULL
    AND p.deleted_at <= now() - v_grace
    AND p.id IN (
      SELECT value::uuid
      FROM jsonb_array_elements_text(COALESCE(p_ids->'menu_photos', '[]'::jsonb))
    );
  GET DIAGNOSTICS v_menu = ROW_COUNT;

  DELETE FROM public.catalog_location_photos p
  WHERE p.deleted_at IS NOT NULL
    AND p.deleted_at <= now() - v_grace
    AND p.id IN (
      SELECT value::uuid
      FROM jsonb_array_elements_text(COALESCE(p_ids->'location_photos', '[]'::jsonb))
    );
  GET DIAGNOSTICS v_location = ROW_COUNT;

  UPDATE public.catalog_media_tombstones t
  SET purged_at = now()
  WHERE t.restored_at IS NULL
    AND t.purged_at IS NULL
    AND t.deleted_at <= now() - v_grace
    AND t.id IN (
      SELECT value::uuid
      FROM jsonb_array_elements_text(COALESCE(p_ids->'reference_images', '[]'::jsonb))
    );
  GET DIAGNOSTICS v_references = ROW_COUNT;

  RETURN jsonb_build_object(
    'footage', v_footage,
    'menu_photos', v_menu,
    'location_photos', v_location,
    'reference_images', v_references
  );
END;
$purge_commit$;

REVOKE ALL ON FUNCTION public.catalog_media_grace() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.catalog_footage_storage_paths(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.catalog_footage_usage_digest(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.catalog_shot_mention_digest(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.catalog_reference_clear_path(jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.catalog_reference_restore_paths(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.mcp_preview_footage_delete(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_footage_delete(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_footage_delete(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_footage_delete(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_preview_footage_restore(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_footage_restore(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_footage_restore(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_footage_restore(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_preview_catalog_media_delete(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_catalog_media_delete(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_catalog_media_delete(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_catalog_media_delete(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_preview_catalog_media_restore(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_catalog_media_restore(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_catalog_media_restore(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_catalog_media_restore(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_catalog_media_purge_plan(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_catalog_media_purge_plan(integer) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_catalog_media_purge_commit(jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_catalog_media_purge_commit(jsonb, integer) TO service_role;

COMMENT ON FUNCTION public.mcp_preview_footage_delete(uuid, uuid, jsonb) IS
  'MCP footage.delete.preview. Shows scenes, storage files, and content uses. Saves nothing. A used clip needs acknowledge_used before a token is issued.';
COMMENT ON FUNCTION public.mcp_apply_footage_delete(uuid, uuid, uuid) IS
  'MCP footage.delete. Sets deleted_at. Does not delete storage objects or the laptop file.';
COMMENT ON FUNCTION public.mcp_preview_footage_restore(uuid, uuid, jsonb) IS
  'MCP footage.restore.preview. Allowed for 30 days after deleted_at.';
COMMENT ON FUNCTION public.mcp_apply_footage_restore(uuid, uuid, uuid) IS
  'MCP footage.restore. Clears deleted_at. Does not change storage objects.';
COMMENT ON FUNCTION public.mcp_catalog_media_purge_plan(integer) IS
  'Lists soft-deleted catalog media past the grace period. Does not delete rows or storage objects.';
COMMENT ON FUNCTION public.mcp_catalog_media_purge_commit(jsonb, integer) IS
  'Deletes rows that are still past the grace period. Does not delete storage objects.';

-- Reads hide soft-deleted clips and photos.

CREATE OR REPLACE FUNCTION public.mcp_search_footage(
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
  p_include_banned boolean DEFAULT NULL
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
        AND a.deleted_at IS NULL
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
                ON d.id = v.tag_def_id
               AND d.organization_id = v.organization_id
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
                ON d.id = v.tag_def_id
               AND d.organization_id = v.organization_id
              WHERE v.scene_id = s.id
                AND v.organization_id = s.organization_id
                AND d.key = 'watermark_ui'
                AND v.value_bool IS TRUE
            ) = p_watermark
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
            SELECT 1
            FROM public.footage_bans ban
            WHERE ban.scene_id = s.id
              AND ban.organization_id = s.organization_id
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
          OR EXISTS (
            SELECT 1
            FROM public.footage_usages u
            WHERE u.organization_id = s.organization_id
              AND u.asset_id = s.asset_id
              AND (
                strpos(lower(COALESCE(u.external_ref, '')), v_query) > 0
                OR strpos(lower(COALESCE(u.title, '')), v_query) > 0
              )
          )
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

  RETURN jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'scenes', COALESCE(v_scenes, '[]'::jsonb)
  );
END;
$search$;

CREATE OR REPLACE FUNCTION public.mcp_get_footage(
  p_user_id uuid,
  p_organization_id uuid,
  p_file_key text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $get$
DECLARE
  v_key text := NULLIF(btrim(COALESCE(p_file_key, '')), '');
  v_asset public.footage_assets%ROWTYPE;
  v_scenes jsonb;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_asset
  FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id
    AND a.file_key = v_key
    AND a.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(
    jsonb_agg(public.mcp_footage_scene_json(s.id) ORDER BY s.scene_index),
    '[]'::jsonb
  )
  INTO v_scenes
  FROM public.footage_scenes s
  WHERE s.asset_id = v_asset.id
    AND s.organization_id = v_asset.organization_id;

  RETURN jsonb_build_object(
    'file_key', v_asset.file_key,
    'media_type', v_asset.media_type,
    'origin', v_asset.origin,
    'location_label', v_asset.location_label,
    'product_label', v_asset.product_label,
    'summary', v_asset.summary,
    'note', v_asset.note,
    'duration_seconds', v_asset.duration_seconds::double precision,
    'storage_status', v_asset.storage_status,
    'preview_storage_path', v_asset.preview_storage_path,
    'scenes', COALESCE(v_scenes, '[]'::jsonb)
  );
END;
$get$;

CREATE OR REPLACE FUNCTION public.mcp_list_footage_bans(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $bans$
DECLARE
  v_total integer;
  v_bans jsonb;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);

  SELECT
    count(*)::int,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'file_key', a.file_key,
          'scene_index', s.scene_index,
          'reason', b.reason
        )
        ORDER BY a.file_key, s.scene_index
      ),
      '[]'::jsonb
    )
  INTO v_total, v_bans
  FROM public.footage_bans b
  JOIN public.footage_scenes s
    ON s.id = b.scene_id
   AND s.organization_id = b.organization_id
  JOIN public.footage_assets a
    ON a.id = s.asset_id
   AND a.organization_id = s.organization_id
  WHERE b.organization_id = p_organization_id
    AND a.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'bans', COALESCE(v_bans, '[]'::jsonb)
  );
END;
$bans$;

CREATE OR REPLACE FUNCTION public.mcp_list_catalog_products(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $list_products$
DECLARE
  v_products jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  SELECT COALESCE(jsonb_agg(item.payload ORDER BY item.name), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT
      m.name,
      jsonb_build_object(
        'id', m.external_id,
        'name', m.name,
        'aliases', to_jsonb(m.aliases),
        'photo_count', (
          SELECT count(*)::int
          FROM public.catalog_menu_photos p
          WHERE p.menu_id = m.id
            AND p.organization_id = m.organization_id
            AND p.deleted_at IS NULL
        ),
        'waiting', NOT EXISTS (
          SELECT 1
          FROM public.catalog_menu_fields f
          WHERE f.menu_id = m.id
            AND f.organization_id = m.organization_id
            AND btrim(f.body) <> ''
        )
      ) AS payload
    FROM public.catalog_menus m
    WHERE m.organization_id = p_organization_id
  ) item;

  RETURN jsonb_build_object(
    'total', COALESCE(jsonb_array_length(v_products), 0),
    'products', COALESCE(v_products, '[]'::jsonb)
  );
END;
$list_products$;

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
    AND p.organization_id = v_menu.organization_id
    AND p.deleted_at IS NULL;

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

CREATE OR REPLACE FUNCTION public.mcp_list_catalog_locations(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $list_locations$
DECLARE
  v_locations jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  SELECT COALESCE(jsonb_agg(item.payload ORDER BY item.name), '[]'::jsonb)
  INTO v_locations
  FROM (
    SELECT
      l.name,
      jsonb_build_object(
        'id', l.external_id,
        'name', l.name,
        'photo_count', (
          SELECT count(*)::int
          FROM public.catalog_location_photos p
          WHERE p.location_id = l.id
            AND p.organization_id = l.organization_id
            AND p.deleted_at IS NULL
        ),
        'waiting',
          NOT EXISTS (
            SELECT 1
            FROM public.catalog_location_sections s
            WHERE s.location_id = l.id
              AND s.organization_id = l.organization_id
              AND btrim(s.body) <> ''
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.catalog_location_photos p
            WHERE p.location_id = l.id
              AND p.organization_id = l.organization_id
            AND p.deleted_at IS NULL
              AND btrim(COALESCE(p.description, '')) <> ''
          )
      ) AS payload
    FROM public.catalog_locations l
    WHERE l.organization_id = p_organization_id
  ) item;

  RETURN jsonb_build_object(
    'total', COALESCE(jsonb_array_length(v_locations), 0),
    'locations', COALESCE(v_locations, '[]'::jsonb)
  );
END;
$list_locations$;

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
    AND p.organization_id = v_location.organization_id
    AND p.deleted_at IS NULL;

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
    AND p.deleted_at IS NULL
          AND btrim(COALESCE(p.description, '')) <> ''
      ),
    'photos', COALESCE(v_photos, '[]'::jsonb),
    'sections', COALESCE(v_sections, '[]'::jsonb),
    'areas', COALESCE(v_areas, '[]'::jsonb)
  );
END;
$get_location$;

REVOKE ALL ON FUNCTION public.mcp_search_footage(uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_search_footage(uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer, text, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_get_footage(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_footage(uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_list_footage_bans(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_footage_bans(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_list_catalog_products(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_catalog_products(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_get_catalog_product(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_catalog_product(uuid, uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_list_catalog_locations(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_catalog_locations(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_get_catalog_location(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_catalog_location(uuid, uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.mcp_search_footage(uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer, text, boolean) IS
  'MCP footage.search. Hides banned scenes unless include_banned is true. Hides soft-deleted clips.';
COMMENT ON FUNCTION public.mcp_get_footage(uuid, uuid, text) IS
  'MCP footage.get. A soft-deleted clip is not_found. Includes preview_storage_path.';
