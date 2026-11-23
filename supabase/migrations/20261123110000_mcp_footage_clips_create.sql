-- MCP footage.clips.create: register a new clip and all its scenes in one preview → confirm.
-- Step 10 of the Katalog task: new inbox footage could only go to the laptop CSV before,
-- because every MCP footage write edited existing rows only.
-- Scene numbers follow the order of start_seconds. Tags use the same keys as the scene batch.
-- Thumbnails and the 480p preview stay empty until the upload scripts run.

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
      'footage.clips.create',
      'footage.delete',
      'footage.restore',
      'catalog.media.delete',
      'catalog.media.restore',
      'catalog.style.update',
      'catalog.reference.upsert',
      'catalog.shotlist.upsert'
    )
  );

CREATE OR REPLACE FUNCTION public.mcp_footage_normalize_clip_create(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $normalize_create$
DECLARE
  v_key text;
  v_media text;
  v_origin text;
  v_status text;
  v_duration numeric;
  v_text text;
  v_payload jsonb;
  v_scene jsonb;
  v_out jsonb := '[]'::jsonb;
  v_item jsonb;
  v_start numeric;
  v_end numeric;
  v_prev numeric := -1;
  v_tag text;
  v_field text;
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_input) AS k
    WHERE k NOT IN ('file_key', 'media_type', 'origin', 'location', 'product', 'summary', 'note',
                    'duration_seconds', 'storage_status', 'scenes')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_input->'file_key') <> 'string' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_key := public.mcp_footage_clean_key(p_input->>'file_key');

  v_media := lower(btrim(COALESCE(p_input->>'media_type', '')));
  IF v_media NOT IN ('video', 'image') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_origin := lower(btrim(COALESCE(p_input->>'origin', '')));
  IF v_origin NOT IN ('hp', 'ai', 'foto') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  -- INBOX/... is new footage; anything else is already in the bank.
  v_status := lower(btrim(COALESCE(p_input->>'storage_status',
    CASE WHEN upper(v_key) LIKE 'INBOX/%' THEN 'inbox' ELSE 'bank' END)));
  IF v_status NOT IN ('inbox', 'bank') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF jsonb_exists(p_input, 'duration_seconds') AND jsonb_typeof(p_input->'duration_seconds') <> 'null' THEN
    IF jsonb_typeof(p_input->'duration_seconds') <> 'number' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_duration := (p_input->>'duration_seconds')::numeric;
    IF v_duration < 0 OR v_duration > 86400 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_payload := jsonb_build_object(
    'file_key', v_key,
    'media_type', v_media,
    'origin', v_origin,
    'storage_status', v_status,
    'duration_seconds', v_duration
  );

  FOREACH v_field IN ARRAY ARRAY['location', 'product', 'summary', 'note'] LOOP
    IF jsonb_exists(p_input, v_field) THEN
      IF jsonb_typeof(p_input->v_field) <> 'string' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_text := NULLIF(btrim(p_input->>v_field), '');
      IF char_length(COALESCE(v_text, '')) > (CASE WHEN v_field IN ('location', 'product') THEN 500 ELSE 4000 END) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_payload := v_payload || jsonb_build_object(v_field, v_text);
    END IF;
  END LOOP;

  IF jsonb_typeof(p_input->'scenes') <> 'array'
     OR jsonb_array_length(p_input->'scenes') < 1
     OR jsonb_array_length(p_input->'scenes') > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  -- Scenes in start order; each start must be later than the one before.
  FOR v_scene IN
    SELECT s FROM jsonb_array_elements(p_input->'scenes') s
    ORDER BY (CASE WHEN jsonb_typeof(s->'start_seconds') = 'number' THEN (s->>'start_seconds')::numeric END) NULLS FIRST
  LOOP
    IF jsonb_typeof(v_scene) <> 'object' OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(v_scene) AS k
      WHERE k NOT IN ('start_seconds', 'end_seconds', 'scene_kind', 'summary', 'note',
                      'hijab', 'watermark', 'meja_biru', 'lengkuas')
    ) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_scene->'start_seconds') <> 'number' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_start := (v_scene->>'start_seconds')::numeric;
    IF v_start < 0 OR v_start <= v_prev OR (v_duration IS NOT NULL AND v_start > v_duration) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_end := NULL;
    IF jsonb_exists(v_scene, 'end_seconds') AND jsonb_typeof(v_scene->'end_seconds') <> 'null' THEN
      IF jsonb_typeof(v_scene->'end_seconds') <> 'number' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      v_end := (v_scene->>'end_seconds')::numeric;
      IF v_end < v_start OR (v_duration IS NOT NULL AND v_end > v_duration + 0.05) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    END IF;
    v_text := btrim(COALESCE(v_scene->>'scene_kind', ''));
    IF jsonb_typeof(v_scene->'scene_kind') <> 'string' OR v_text = '' OR char_length(v_text) > 80 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    v_item := jsonb_build_object(
      'scene_index', jsonb_array_length(v_out) + 1,
      'start_seconds', v_start,
      'end_seconds', v_end,
      'scene_kind', v_text
    );
    FOREACH v_field IN ARRAY ARRAY['summary', 'note'] LOOP
      IF jsonb_exists(v_scene, v_field) THEN
        IF jsonb_typeof(v_scene->v_field) <> 'string' OR char_length(v_scene->>v_field) > 4000 THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
        v_item := v_item || jsonb_build_object(v_field, NULLIF(btrim(v_scene->>v_field), ''));
      END IF;
    END LOOP;
    FOREACH v_tag IN ARRAY ARRAY['hijab', 'watermark', 'meja_biru', 'lengkuas'] LOOP
      IF jsonb_exists(v_scene, v_tag) THEN
        IF jsonb_typeof(v_scene->v_tag) <> 'boolean' THEN
          RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
        END IF;
        v_item := v_item || jsonb_build_object(v_tag, (v_scene->>v_tag)::boolean);
      END IF;
    END LOOP;

    v_out := v_out || jsonb_build_array(v_item);
    v_prev := v_start;
  END LOOP;

  RETURN v_payload || jsonb_build_object('scenes', v_out);
END;
$normalize_create$;

CREATE OR REPLACE FUNCTION public.mcp_preview_footage_clip_create(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_create$
DECLARE
  v_payload jsonb;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_normalize_clip_create(p_input);

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  -- A soft-deleted clip still owns its file_key: restore it instead of creating a twin.
  IF EXISTS (
    SELECT 1 FROM public.footage_assets a
    WHERE a.organization_id = p_organization_id
      AND a.file_key = v_payload->>'file_key'
  ) THEN
    RAISE EXCEPTION 'file_key_taken' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (p_organization_id, p_user_id, 'footage.clips.create', v_payload, now() + interval '15 minutes')
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'clip', v_payload - 'scenes',
    'scenes', v_payload->'scenes',
    'scene_count', jsonb_array_length(v_payload->'scenes'),
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_create$;

CREATE OR REPLACE FUNCTION public.mcp_apply_footage_clip_create(
  p_user_id uuid,
  p_organization_id uuid,
  p_preview_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_create$
DECLARE
  v_payload jsonb;
  v_asset_id uuid;
  v_scene_id uuid;
  v_item jsonb;
  v_tag text;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(p_user_id, p_organization_id, p_preview_id, 'footage.clips.create');

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'footage_asset:' || p_organization_id::text || ':' || (v_payload->>'file_key'), 0
  ));
  IF EXISTS (
    SELECT 1 FROM public.footage_assets a
    WHERE a.organization_id = p_organization_id
      AND a.file_key = v_payload->>'file_key'
  ) THEN
    RAISE EXCEPTION 'file_key_taken' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.footage_assets (
    organization_id, file_key, media_type, origin, location_label, product_label,
    summary, note, duration_seconds, storage_status
  ) VALUES (
    p_organization_id,
    v_payload->>'file_key',
    v_payload->>'media_type',
    v_payload->>'origin',
    v_payload->>'location',
    v_payload->>'product',
    v_payload->>'summary',
    v_payload->>'note',
    (v_payload->>'duration_seconds')::numeric,
    v_payload->>'storage_status'
  )
  RETURNING id INTO v_asset_id;

  FOR v_item IN SELECT s FROM jsonb_array_elements(v_payload->'scenes') s LOOP
    INSERT INTO public.footage_scenes (
      organization_id, asset_id, scene_index, start_seconds, end_seconds, scene_kind, summary, note
    ) VALUES (
      p_organization_id,
      v_asset_id,
      (v_item->>'scene_index')::integer,
      (v_item->>'start_seconds')::numeric,
      (v_item->>'end_seconds')::numeric,
      v_item->>'scene_kind',
      v_item->>'summary',
      v_item->>'note'
    )
    RETURNING id INTO v_scene_id;

    FOREACH v_tag IN ARRAY ARRAY['hijab', 'watermark', 'meja_biru', 'lengkuas'] LOOP
      IF jsonb_exists(v_item, v_tag) THEN
        PERFORM public.mcp_footage_set_scene_tag(
          p_organization_id,
          v_scene_id,
          CASE v_tag WHEN 'watermark' THEN 'watermark_ui' ELSE v_tag END,
          (v_item->>v_tag)::boolean
        );
      END IF;
    END LOOP;
  END LOOP;

  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'saved', true,
    'file_key', v_payload->>'file_key',
    'storage_status', v_payload->>'storage_status',
    'scene_count', jsonb_array_length(v_payload->'scenes')
  );
END;
$apply_create$;

REVOKE ALL ON FUNCTION public.mcp_footage_normalize_clip_create(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_preview_footage_clip_create(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_footage_clip_create(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_footage_clip_create(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_footage_clip_create(uuid, uuid, uuid) TO service_role;
