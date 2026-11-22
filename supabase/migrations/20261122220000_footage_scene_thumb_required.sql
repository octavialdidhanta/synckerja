-- Scenes can be kept without a thumbnail. Draft naskah stays unmarked here;
-- a later script sets those twenty rows. Existing paths stay valid.

ALTER TABLE public.footage_scenes
  ADD COLUMN thumb_required boolean NOT NULL DEFAULT true;

ALTER TABLE public.footage_scenes
  ADD CONSTRAINT footage_scenes_thumb_required_check CHECK (
    thumb_required OR thumb_storage_path IS NULL
  );

COMMENT ON COLUMN public.footage_scenes.thumb_required IS
  'False means this scene is kept without a thumbnail. A stored path still requires true.';

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
    'thumb_required', s.thumb_required,
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
