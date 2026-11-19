-- MCP: create permanent storyboard row ids for briefs that never got them.
-- Row ids were only created when someone opened the storyboard editor in Office,
-- so briefs made or only read through MCP returned shots without shot_id and
-- content.briefs.update.preview could not edit their storyboard.
-- This creates ids only. It never changes brief text, so it needs membership,
-- not storyboard edit rights.

CREATE OR REPLACE FUNCTION public.mcp_ensure_brief_storyboard_shots(
  p_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid,
  p_row_count integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_count integer;
  v_index integer;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_plan_id IS NULL
     OR p_row_count IS NULL OR p_row_count < 0 OR p_row_count > 500 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations AS member
    WHERE member.user_id = p_user_id
      AND member.organization_id = p_organization_id
      AND COALESCE(member.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id
    AND plan.organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::integer
    INTO v_count
  FROM public.brief_storyboard_shots AS shot
  WHERE shot.social_media_plan_id = p_plan_id;

  -- Only fill a plan that has no ids yet. A plan whose ids exist is left alone,
  -- even when the count differs; the Office editor owns row moves.
  IF v_count > 0 OR p_row_count = 0 THEN
    RETURN v_count;
  END IF;

  FOR v_index IN 0..(p_row_count - 1) LOOP
    INSERT INTO public.brief_storyboard_shots (social_media_plan_id, row_index)
    VALUES (p_plan_id, v_index);
  END LOOP;

  UPDATE public.brief_voice_clips AS clip
  SET shot_id = shot.id
  FROM public.brief_storyboard_shots AS shot
  WHERE clip.social_media_plan_id = p_plan_id
    AND shot.social_media_plan_id = p_plan_id
    AND clip.kind = 'vo'
    AND clip.shot_id IS NULL
    AND clip.row_index = shot.row_index;

  UPDATE public.brief_storyboard_images AS image
  SET shot_id = shot.id
  FROM public.brief_storyboard_shots AS shot
  WHERE image.social_media_plan_id = p_plan_id
    AND shot.social_media_plan_id = p_plan_id
    AND image.column_index = 1
    AND image.shot_id IS NULL
    AND image.row_index = shot.row_index;

  RETURN p_row_count;
END;
$mcp$;

COMMENT ON FUNCTION public.mcp_ensure_brief_storyboard_shots(uuid, uuid, uuid, integer) IS
  'MCP content.briefs.get: create permanent storyboard row ids once for a plan that has none, then attach clips and images that still use only row_index. Never edits brief text.';

REVOKE ALL ON FUNCTION public.mcp_ensure_brief_storyboard_shots(uuid, uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_ensure_brief_storyboard_shots(uuid, uuid, uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_ensure_brief_storyboard_shots(uuid, uuid, uuid, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
