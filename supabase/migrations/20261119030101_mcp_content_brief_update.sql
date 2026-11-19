-- Read a brief for an MCP preview, then save the confirmed text.
-- The preview tool writes nothing. The confirm tool records the token id only after
-- the version, field access, and production lock checks.

CREATE OR REPLACE FUNCTION public.mcp_read_content_brief_for_update(
  p_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid
)
RETURNS TABLE (
  version_no integer,
  status text,
  approved boolean,
  revision_locked boolean,
  can_storyboard boolean,
  can_concept boolean,
  can_caption boolean,
  can_link boolean,
  brief text,
  concept text,
  caption text,
  link_reference text,
  shots jsonb
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_status text;
  v_approved boolean;
  v_brief text;
  v_concept text;
  v_caption text;
  v_link text;
  v_shots jsonb;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_plan_id IS NULL THEN
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

  SELECT plan.status, plan.approved, plan.brief
    INTO v_status, v_approved, v_brief
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id
    AND plan.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT audience.description INTO v_concept
  FROM public.brief_target_audiences AS audience
  WHERE audience.social_media_plan_id = p_plan_id;

  SELECT caption_row.content INTO v_caption
  FROM public.brief_captions AS caption_row
  WHERE caption_row.social_media_plan_id = p_plan_id;

  SELECT link_row.content INTO v_link
  FROM public.brief_link_references AS link_row
  WHERE link_row.social_media_plan_id = p_plan_id;

  SELECT COALESCE(MAX(versions.version_no), 0)
    INTO version_no
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = p_plan_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', shot.id, 'row_index', shot.row_index)
      ORDER BY shot.row_index
    ),
    '[]'::jsonb
  )
    INTO v_shots
  FROM public.brief_storyboard_shots AS shot
  WHERE shot.social_media_plan_id = p_plan_id;

  status := v_status;
  approved := COALESCE(v_approved, false);
  revision_locked := public.content_brief_revision_locked(p_plan_id);
  can_storyboard := public.can_edit_content_brief_field(p_plan_id, 'brief_storyboard', p_user_id);
  can_concept := public.can_edit_content_brief_field(p_plan_id, 'brief_concept', p_user_id);
  can_caption := public.can_edit_content_brief_field(p_plan_id, 'brief_caption', p_user_id);
  can_link := public.can_edit_content_brief_field(p_plan_id, 'brief_link', p_user_id);
  brief := v_brief;
  concept := v_concept;
  caption := v_caption;
  link_reference := v_link;
  shots := v_shots;
  RETURN NEXT;
END;
$mcp$;

COMMENT ON FUNCTION public.mcp_read_content_brief_for_update(uuid, uuid, uuid) IS
  'Read one brief, its version, edit rights, and production lock for an MCP preview. Writes nothing.';

CREATE OR REPLACE FUNCTION public.mcp_confirm_content_brief(
  p_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid,
  p_base_version integer,
  p_confirm_id uuid,
  p_brief text,
  p_concept text,
  p_caption text,
  p_link text
)
RETURNS TABLE (
  id uuid,
  version_no integer,
  status text,
  approved boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_status text;
  v_approved boolean;
  v_current_brief text;
  v_old_concept text;
  v_old_caption text;
  v_old_link text;
  v_new_brief text;
  v_new_concept text;
  v_new_caption text;
  v_new_link text;
  v_latest integer;
  v_storyboard_changed boolean := false;
  v_concept_changed boolean := false;
  v_caption_changed boolean := false;
  v_link_changed boolean := false;
  v_changed boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_plan_id IS NULL
     OR p_base_version IS NULL OR p_confirm_id IS NULL THEN
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

  SELECT plan.status, plan.approved, plan.brief
    INTO v_status, v_approved, v_current_brief
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id
    AND plan.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(MAX(versions.version_no), 0)
    INTO v_latest
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = p_plan_id;

  IF v_latest IS DISTINCT FROM p_base_version THEN
    RAISE EXCEPTION 'brief_version_conflict'
      USING ERRCODE = 'P0001', DETAIL = v_latest::text;
  END IF;

  SELECT audience.description INTO v_old_concept
  FROM public.brief_target_audiences AS audience
  WHERE audience.social_media_plan_id = p_plan_id;

  SELECT caption_row.content INTO v_old_caption
  FROM public.brief_captions AS caption_row
  WHERE caption_row.social_media_plan_id = p_plan_id;

  SELECT link_row.content INTO v_old_link
  FROM public.brief_link_references AS link_row
  WHERE link_row.social_media_plan_id = p_plan_id;

  v_new_brief := COALESCE(p_brief, '');
  v_new_concept := NULLIF(btrim(COALESCE(p_concept, '')), '');
  v_new_caption := NULLIF(btrim(COALESCE(p_caption, '')), '');
  v_new_link := NULLIF(btrim(COALESCE(p_link, '')), '');

  v_storyboard_changed := NULLIF(btrim(v_new_brief), '')
    IS DISTINCT FROM NULLIF(btrim(COALESCE(v_current_brief, '')), '');
  v_concept_changed := v_new_concept IS DISTINCT FROM NULLIF(btrim(COALESCE(v_old_concept, '')), '');
  v_caption_changed := v_new_caption IS DISTINCT FROM NULLIF(btrim(COALESCE(v_old_caption, '')), '');
  v_link_changed := v_new_link IS DISTINCT FROM NULLIF(btrim(COALESCE(v_old_link, '')), '');
  v_changed := v_storyboard_changed OR v_concept_changed OR v_caption_changed OR v_link_changed;

  IF v_storyboard_changed AND NOT public.can_edit_content_brief_field(p_plan_id, 'brief_storyboard', p_user_id) THEN
    RAISE EXCEPTION 'brief_field_forbidden'
      USING ERRCODE = 'P0001', DETAIL = 'brief_storyboard';
  END IF;

  IF v_concept_changed AND NOT public.can_edit_content_brief_field(p_plan_id, 'brief_concept', p_user_id) THEN
    RAISE EXCEPTION 'brief_field_forbidden'
      USING ERRCODE = 'P0001', DETAIL = 'brief_concept';
  END IF;

  IF v_caption_changed AND NOT public.can_edit_content_brief_field(p_plan_id, 'brief_caption', p_user_id) THEN
    RAISE EXCEPTION 'brief_field_forbidden'
      USING ERRCODE = 'P0001', DETAIL = 'brief_caption';
  END IF;

  IF v_link_changed AND NOT public.can_edit_content_brief_field(p_plan_id, 'brief_link', p_user_id) THEN
    RAISE EXCEPTION 'brief_field_forbidden'
      USING ERRCODE = 'P0001', DETAIL = 'brief_link';
  END IF;

  IF v_changed AND public.content_brief_revision_locked(p_plan_id) THEN
    RAISE EXCEPTION 'brief_edit_locked' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.mcp_tool_confirmations (id, organization_id, user_id, tool)
    VALUES (p_confirm_id, p_organization_id, p_user_id, 'content.briefs.update');
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'confirmation_used' USING ERRCODE = 'P0001';
  END;

  IF v_changed THEN
    PERFORM public.content_brief_snapshot(p_plan_id, p_user_id, 'mcp');
  END IF;

  IF v_storyboard_changed THEN
    UPDATE public.social_media_plans AS plan
    SET brief = v_new_brief,
        updated_at = now()
    WHERE plan.id = p_plan_id;
  END IF;

  IF v_concept_changed THEN
    INSERT INTO public.brief_target_audiences (social_media_plan_id, description, updated_at)
    VALUES (p_plan_id, v_new_concept, now())
    ON CONFLICT (social_media_plan_id) DO UPDATE
    SET description = EXCLUDED.description,
        updated_at = now();
  END IF;

  IF v_caption_changed THEN
    INSERT INTO public.brief_captions (social_media_plan_id, content, updated_at)
    VALUES (p_plan_id, v_new_caption, now())
    ON CONFLICT (social_media_plan_id) DO UPDATE
    SET content = EXCLUDED.content,
        updated_at = now();
  END IF;

  IF v_link_changed THEN
    INSERT INTO public.brief_link_references (social_media_plan_id, content, updated_at)
    VALUES (p_plan_id, v_new_link, now())
    ON CONFLICT (social_media_plan_id) DO UPDATE
    SET content = EXCLUDED.content,
        updated_at = now();
  END IF;

  IF v_changed THEN
    PERFORM public.content_brief_demote_approval(p_plan_id);
  END IF;

  SELECT plan.status, plan.approved
    INTO v_status, v_approved
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id;

  SELECT COALESCE(MAX(versions.version_no), 0)
    INTO v_latest
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = p_plan_id;

  id := p_plan_id;
  version_no := v_latest;
  status := v_status;
  approved := COALESCE(v_approved, false);
  RETURN NEXT;
END;
$mcp$;

COMMENT ON FUNCTION public.mcp_confirm_content_brief(uuid, uuid, uuid, integer, uuid, text, text, text, text) IS
  'Save a confirmed MCP brief edit. Checks version, field access, and the production lock before recording the confirmation. The snapshot source is mcp.';

REVOKE ALL ON FUNCTION public.mcp_read_content_brief_for_update(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_confirm_content_brief(uuid, uuid, uuid, integer, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_read_content_brief_for_update(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_confirm_content_brief(uuid, uuid, uuid, integer, uuid, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
