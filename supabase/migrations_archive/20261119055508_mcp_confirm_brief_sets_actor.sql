-- content.briefs.update could never save a storyboard change.
-- mcp_confirm_content_brief updates social_media_plans.brief, and the trigger
-- guard_social_media_plan_brief_pic only accepts an MCP write when
-- mcp.plan_brief_user names the member. The function never set it, so every
-- save ended in brief_field_forbidden. Edit rights are still checked first
-- with can_edit_content_brief_field; this only passes the same user on.

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
    -- guard_social_media_plan_brief_pic has no auth.uid() for MCP writes:
    -- tell it which member is saving (transaction-local).
    PERFORM set_config('mcp.plan_brief_user', p_user_id::text, true);
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


NOTIFY pgrst, 'reload schema';
