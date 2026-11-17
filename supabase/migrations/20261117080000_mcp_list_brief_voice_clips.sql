-- MCP read tool content.briefs.voice.list: list existing VO clips for one plan.
-- Read only. Locked to the session organization. Executable by service_role only.

CREATE OR REPLACE FUNCTION public.mcp_list_brief_voice_clips(
  p_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid
)
RETURNS TABLE(
  id uuid,
  kind text,
  row_index integer,
  file_name text,
  spoken_text text,
  storage_path text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_plan_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.social_media_plans plan
    WHERE plan.id = p_plan_id
      AND plan.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    clip.id,
    clip.kind,
    clip.row_index,
    clip.file_name,
    clip.spoken_text,
    clip.storage_path,
    clip.created_at
  FROM public.brief_voice_clips clip
  WHERE clip.organization_id = p_organization_id
    AND clip.social_media_plan_id = p_plan_id
    AND clip.kind = 'vo'
  ORDER BY clip.row_index ASC, clip.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_list_brief_voice_clips(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_brief_voice_clips(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_brief_voice_clips(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.mcp_list_brief_voice_clips(uuid, uuid, uuid) IS
  'MCP content.briefs.voice.list: VO clips for one plan in the session organization.';
