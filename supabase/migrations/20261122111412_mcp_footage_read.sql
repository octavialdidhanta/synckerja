-- MCP footage read: search scenes, open one clip, list bans.
-- Organization comes from the MCP session. service_role only.
-- Overlap matches katalog.py usage(): a 0–0 scene counts as used when the
-- clip has any use with in and out times; a timed scene overlaps when
-- in < end - 0.05 and out > start + 0.05. Menu aliases are not applied.

CREATE OR REPLACE FUNCTION public.mcp_footage_require_member(p_user_id uuid, p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $member$
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true)
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
END;
$member$;

CREATE OR REPLACE FUNCTION public.mcp_footage_usage_overlaps(
  p_start numeric,
  p_end numeric,
  p_in numeric,
  p_out numeric
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $overlap$
  SELECT COALESCE(
    p_in IS NOT NULL
    AND p_out IS NOT NULL
    AND (
      (p_start = 0 AND p_end = 0)
      OR (
        p_end IS NOT NULL
        AND p_in < p_end - 0.05
        AND p_out > p_start + 0.05
      )
    ),
    false
  );
$overlap$;

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
  p_limit integer DEFAULT NULL
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
    AND a.file_key = v_key;

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
  WHERE b.organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'total', COALESCE(v_total, 0),
    'bans', COALESCE(v_bans, '[]'::jsonb)
  );
END;
$bans$;

REVOKE ALL ON FUNCTION public.mcp_footage_require_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_footage_require_member(uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_footage_usage_overlaps(numeric, numeric, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_footage_usage_overlaps(numeric, numeric, numeric, numeric) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.mcp_search_footage(uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_search_footage(uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_search_footage(uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_get_footage(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_footage(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_footage(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_footage_bans(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_footage_bans(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_footage_bans(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.mcp_search_footage(uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer) IS
  'MCP footage.search. Session org only. Returns total and at most 50 scenes.';
COMMENT ON FUNCTION public.mcp_get_footage(uuid, uuid, text) IS
  'MCP footage.get. Session org only. Missing clip raises not_found.';
COMMENT ON FUNCTION public.mcp_list_footage_bans(uuid, uuid) IS
  'MCP footage.bans.list. Session org only.';
