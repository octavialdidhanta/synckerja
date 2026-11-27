-- Footage scene strips: a contact strip per video scene (a frame every half second, each labelled with its second in
-- the source clip), made by the Synckerja Agent from the laptop file and kept in catalog-media/<org>/strips/.
-- MCP footage.scenes.strip shows them so in/out points are chosen without opening the laptop file.
--
-- New columns and new Agent functions only: the existing media-upload/media-done flow and older Agents are unchanged.

ALTER TABLE public.footage_scenes
  ADD COLUMN IF NOT EXISTS strip_storage_path text,
  ADD COLUMN IF NOT EXISTS strip_meta jsonb;

COMMENT ON COLUMN public.footage_scenes.strip_storage_path IS
  'catalog-media path of the scene strip jpg (<org>/strips/<scene_id>.jpg), set by the Agent. Null: not made yet.';
COMMENT ON COLUMN public.footage_scenes.strip_meta IS
  'Strip layout {fps, frames, cols, start, labels} so frame n (0-based) is at start + n / fps seconds; or {failed_at, reason} when the Agent could not make it (retried after 7 days).';

-- Scene JSON for MCP footage tools: the stored definition plus strip_storage_path and strip.
CREATE OR REPLACE FUNCTION public.mcp_footage_scene_json(p_scene_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    'strip_storage_path', v_scene.strip_storage_path,
    'strip', CASE WHEN v_scene.strip_storage_path IS NOT NULL THEN v_scene.strip_meta END,
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
$function$;

REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM service_role;

-- Next clips whose video scenes still need a strip (Agent backfill and new footage alike). Clips with a long scene
-- come first: that is where one thumbnail per scene is not enough. Clips the laptop no longer has (missing) and
-- hidden/deleted clips are skipped; a scene that failed is tried again after 7 days.
CREATE OR REPLACE FUNCTION public.agent_footage_strip_todo(p_token_id uuid, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $strip_todo$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 3), 1), 20);
BEGIN
  RETURN (
    WITH todo AS (
      SELECT s.*
      FROM public.footage_scenes s
      WHERE s.organization_id = v_org
        AND s.strip_storage_path IS NULL
        AND s.end_seconds IS NOT NULL
        AND s.end_seconds > s.start_seconds
        AND (s.strip_meta IS NULL OR NOT (s.strip_meta ? 'failed_at')
             OR (s.strip_meta->>'failed_at')::timestamptz < now() - interval '7 days')
    ),
    assets AS (
      SELECT a.id, a.file_key, a.storage_status,
             max(t.end_seconds - t.start_seconds) AS longest, a.created_at
      FROM public.footage_assets a
      JOIN todo t ON t.asset_id = a.id
      WHERE a.organization_id = v_org
        AND a.deleted_at IS NULL
        AND a.media_type = 'video'
        AND a.storage_status IN ('inbox', 'bank')
      GROUP BY a.id
    ),
    picked AS (
      SELECT * FROM assets
      ORDER BY (longest >= 5) DESC, created_at DESC
      LIMIT v_limit
    )
    SELECT jsonb_build_object(
      'remaining', (SELECT count(*) FROM assets),
      'assets', COALESCE(jsonb_agg(jsonb_build_object(
        'asset_id', p.id,
        'file_key', p.file_key,
        'storage_status', p.storage_status,
        'scenes', (
          SELECT jsonb_agg(jsonb_build_object(
            'scene_id', t.id,
            'scene_index', t.scene_index,
            'start_seconds', t.start_seconds,
            'end_seconds', t.end_seconds,
            'strip_path', v_org::text || '/strips/' || t.id::text || '.jpg'
          ) ORDER BY t.scene_index)
          FROM todo t WHERE t.asset_id = p.id
        )
      ) ORDER BY (p.longest >= 5) DESC, p.created_at DESC), '[]'::jsonb)
    )
    FROM picked p
  );
END;
$strip_todo$;

-- The Agent reports strips it uploaded (with their layout) and scenes it could not make.
CREATE OR REPLACE FUNCTION public.agent_footage_strip_done(
  p_token_id uuid,
  p_asset_id uuid,
  p_done jsonb,
  p_failed jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $strip_done$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
  v_item jsonb;
  v_done integer := 0;
  v_failed integer := 0;
  v_n integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.footage_assets
    WHERE id = p_asset_id AND organization_id = v_org AND deleted_at IS NULL AND media_type = 'video'
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF jsonb_typeof(COALESCE(p_done, '[]'::jsonb)) <> 'array' OR jsonb_typeof(COALESCE(p_failed, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_done, '[]'::jsonb)) + jsonb_array_length(COALESCE(p_failed, '[]'::jsonb)) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_done, '[]'::jsonb)) LOOP
    IF NOT (v_item ? 'scene_id') OR (v_item->>'fps')::numeric NOT BETWEEN 0.01 AND 10
       OR (v_item->>'frames')::int NOT BETWEEN 1 AND 60 OR (v_item->>'cols')::int NOT BETWEEN 1 AND 12 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    UPDATE public.footage_scenes s
    SET strip_storage_path = v_org::text || '/strips/' || s.id::text || '.jpg',
        strip_meta = jsonb_build_object(
          'fps', (v_item->>'fps')::numeric,
          'frames', (v_item->>'frames')::int,
          'cols', (v_item->>'cols')::int,
          'start', s.start_seconds,
          'labels', COALESCE((v_item->>'labels')::boolean, false)
        ),
        updated_at = now()
    WHERE s.id = (v_item->>'scene_id')::uuid AND s.asset_id = p_asset_id AND s.organization_id = v_org;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_done := v_done + 1;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_failed, '[]'::jsonb)) LOOP
    UPDATE public.footage_scenes s
    SET strip_meta = jsonb_build_object('failed_at', now(), 'reason', left(COALESCE(v_item->>'reason', ''), 300)),
        updated_at = now()
    WHERE s.id = (v_item->>'scene_id')::uuid AND s.asset_id = p_asset_id AND s.organization_id = v_org
      AND s.strip_storage_path IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_failed := v_failed + v_n;
  END LOOP;

  RETURN jsonb_build_object('asset_id', p_asset_id, 'done', v_done, 'failed', v_failed);
END;
$strip_done$;

REVOKE ALL ON FUNCTION public.agent_footage_strip_todo(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_strip_todo(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.agent_footage_strip_done(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_strip_done(uuid, uuid, jsonb, jsonb) TO service_role;
