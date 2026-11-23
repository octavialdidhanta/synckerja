-- Synckerja Agent — step 3: the Agent registers new inbox footage by itself.
--
-- The laptop Agent finds a new file in FOOTAGE UPLOAD, detects scenes, and registers the clip here
-- with no human confirmation (unlike MCP footage.clips.create). That is safe because the Agent can
-- only ADD a clip whose file_key is new for its own organization, and attach its own thumbnails and
-- 480p preview. It cannot edit, delete or re-tag existing footage.
-- Scenes arrive untagged (scene_kind 'belum ditag'); step 4 (AI tagging) fills them in.

-- Token → organization, refusing a revoked/expired token or one without the scope.
CREATE OR REPLACE FUNCTION public.agent_token_org(p_token_id uuid, p_scope text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $token_org$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.agent_tokens
  WHERE id = p_token_id
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND p_scope = ANY (scopes);
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'token_inactive' USING ERRCODE = '42501';
  END IF;
  RETURN v_org;
END;
$token_org$;

-- Which of these file_keys does the organization already have (soft-deleted ones included)?
CREATE OR REPLACE FUNCTION public.agent_footage_check(p_token_id uuid, p_file_keys text[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $check$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
BEGIN
  IF p_file_keys IS NULL OR cardinality(p_file_keys) > 500 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('existing', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'file_key', a.file_key,
      'asset_id', a.id,
      'deleted', a.deleted_at IS NOT NULL,
      'has_preview', a.preview_storage_path IS NOT NULL,
      'scenes_without_thumb', (
        SELECT count(*) FROM public.footage_scenes s
        WHERE s.asset_id = a.id AND s.thumb_storage_path IS NULL AND s.thumb_required
      )
    ) ORDER BY a.file_key)
    FROM public.footage_assets a
    WHERE a.organization_id = v_org
      AND a.file_key = ANY (p_file_keys)
  ), '[]'::jsonb));
END;
$check$;

-- Register one new clip and its scenes. Same input as MCP footage.clips.create.
CREATE OR REPLACE FUNCTION public.agent_footage_register(p_token_id uuid, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $register$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
  v_payload jsonb;
  v_asset_id uuid;
  v_scene_id uuid;
  v_item jsonb;
  v_scenes jsonb := '[]'::jsonb;
BEGIN
  -- The Agent registers new inbox files only; moving to the bank is a separate, later step.
  IF upper(COALESCE(p_input->>'file_key', '')) NOT LIKE 'INBOX/%' OR p_input ? 'storage_status' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_payload := public.mcp_footage_normalize_clip_create(p_input);

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'footage_asset:' || v_org::text || ':' || (v_payload->>'file_key'), 0
  ));
  IF EXISTS (
    SELECT 1 FROM public.footage_assets a
    WHERE a.organization_id = v_org AND a.file_key = v_payload->>'file_key'
  ) THEN
    RAISE EXCEPTION 'file_key_taken' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.footage_assets (
    organization_id, file_key, media_type, origin, location_label, product_label,
    summary, note, duration_seconds, storage_status
  ) VALUES (
    v_org,
    v_payload->>'file_key',
    v_payload->>'media_type',
    v_payload->>'origin',
    v_payload->>'location',
    v_payload->>'product',
    v_payload->>'summary',
    v_payload->>'note',
    (v_payload->>'duration_seconds')::numeric,
    'inbox'
  )
  RETURNING id INTO v_asset_id;

  FOR v_item IN SELECT s FROM jsonb_array_elements(v_payload->'scenes') s LOOP
    INSERT INTO public.footage_scenes (
      organization_id, asset_id, scene_index, start_seconds, end_seconds, scene_kind, summary, note
    ) VALUES (
      v_org,
      v_asset_id,
      (v_item->>'scene_index')::integer,
      (v_item->>'start_seconds')::numeric,
      (v_item->>'end_seconds')::numeric,
      v_item->>'scene_kind',
      v_item->>'summary',
      v_item->>'note'
    )
    RETURNING id INTO v_scene_id;
    v_scenes := v_scenes || jsonb_build_array(jsonb_build_object(
      'scene_id', v_scene_id,
      'scene_index', (v_item->>'scene_index')::integer,
      'start_seconds', (v_item->>'start_seconds')::numeric,
      'end_seconds', (v_item->>'end_seconds')::numeric
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'asset_id', v_asset_id,
    'file_key', v_payload->>'file_key',
    'scenes', v_scenes
  );
END;
$register$;

-- Storage paths the Agent may write for one of its clips: the 480p preview and one jpg per scene.
CREATE OR REPLACE FUNCTION public.agent_footage_media_targets(p_token_id uuid, p_asset_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $targets$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
  v_media text;
BEGIN
  SELECT media_type INTO v_media
  FROM public.footage_assets
  WHERE id = p_asset_id AND organization_id = v_org AND deleted_at IS NULL;
  IF v_media IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'asset_id', p_asset_id,
    'preview_path', CASE WHEN v_media = 'video' THEN v_org::text || '/previews/' || p_asset_id::text || '.mp4' END,
    'scenes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'scene_id', s.id,
        'scene_index', s.scene_index,
        'start_seconds', s.start_seconds,
        'end_seconds', s.end_seconds,
        'thumb_path', v_org::text || '/thumbs/' || s.id::text || '.jpg'
      ) ORDER BY s.scene_index)
      FROM public.footage_scenes s
      WHERE s.asset_id = p_asset_id
    ), '[]'::jsonb)
  );
END;
$targets$;

-- After the uploads: point the rows at the files. Only the exact paths above are accepted.
CREATE OR REPLACE FUNCTION public.agent_footage_media_done(
  p_token_id uuid,
  p_asset_id uuid,
  p_preview boolean,
  p_scene_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $done$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
  v_media text;
  v_thumbs integer := 0;
BEGIN
  SELECT media_type INTO v_media
  FROM public.footage_assets
  WHERE id = p_asset_id AND organization_id = v_org AND deleted_at IS NULL;
  IF v_media IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(p_preview, false) THEN
    IF v_media <> 'video' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    UPDATE public.footage_assets
    SET preview_storage_path = v_org::text || '/previews/' || p_asset_id::text || '.mp4', updated_at = now()
    WHERE id = p_asset_id;
  END IF;
  IF p_scene_ids IS NOT NULL AND cardinality(p_scene_ids) > 0 THEN
    UPDATE public.footage_scenes s
    SET thumb_storage_path = v_org::text || '/thumbs/' || s.id::text || '.jpg', updated_at = now()
    WHERE s.asset_id = p_asset_id AND s.id = ANY (p_scene_ids);
    GET DIAGNOSTICS v_thumbs = ROW_COUNT;
    IF v_thumbs <> cardinality(p_scene_ids) THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN jsonb_build_object('asset_id', p_asset_id, 'preview', COALESCE(p_preview, false), 'thumbs', v_thumbs);
END;
$done$;

REVOKE ALL ON FUNCTION public.agent_token_org(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_token_org(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.agent_footage_check(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_check(uuid, text[]) TO service_role;
REVOKE ALL ON FUNCTION public.agent_footage_register(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_register(uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.agent_footage_media_targets(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_media_targets(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.agent_footage_media_done(uuid, uuid, boolean, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_media_done(uuid, uuid, boolean, uuid[]) TO service_role;
