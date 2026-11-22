-- footage.search: hide banned scenes unless include_banned is true, and match a keyword.
-- scene_kind stays the jenis filter. The old signature is dropped so PostgREST has one function.
-- This does not change footage.get or footage.bans.list.

DROP FUNCTION public.mcp_search_footage(uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer);

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

REVOKE ALL ON FUNCTION public.mcp_search_footage(uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_search_footage(uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer, text, boolean) TO service_role;

COMMENT ON FUNCTION public.mcp_search_footage(uuid, uuid, text, text, text, boolean, boolean, text, boolean, integer, text, boolean) IS
  'MCP footage.search. Hides banned scenes unless include_banned is true. scene_kind is the jenis filter.';
