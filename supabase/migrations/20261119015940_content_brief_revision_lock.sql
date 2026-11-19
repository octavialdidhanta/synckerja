-- Return an approved brief to Need Review when its content changes, and reject the
-- edit while production is approved or the content is scheduled or published.

CREATE OR REPLACE FUNCTION public.content_brief_revision_locked(p_plan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_status text;
  v_production_approved boolean;
  v_production_status text;
  v_post_link text;
BEGIN
  IF p_plan_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT plan.organization_id,
         plan.status,
         plan.production_approved,
         plan.production_status,
         plan.post_link::text
    INTO v_org, v_status, v_production_approved, v_production_status, v_post_link
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF v_org NOT IN (SELECT public.user_organization_ids()) THEN
      RAISE EXCEPTION 'Not allowed'
        USING ERRCODE = '42501';
    END IF;
  ELSIF session_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Not allowed'
      USING ERRCODE = '42501';
  END IF;

  IF v_status = 'Request Revision' THEN
    RETURN false;
  END IF;

  IF COALESCE(v_production_approved, false) OR v_production_status = 'Approved' THEN
    RETURN true;
  END IF;

  IF COALESCE(v_post_link, 'null') NOT IN ('null', '[]', '{}', '""')
     AND NULLIF(btrim(v_post_link), '') IS NOT NULL THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.social_media_scheduled_posts AS scheduled
    WHERE scheduled.social_media_plan_id = p_plan_id
      AND scheduled.status IN ('pending', 'publishing', 'published')
  );
END;
$$;

COMMENT ON FUNCTION public.content_brief_revision_locked(uuid) IS
  'True when brief content cannot change until the brief status is Request Revision.';

REVOKE ALL ON FUNCTION public.content_brief_revision_locked(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.content_brief_revision_locked(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.content_brief_demote_approval(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.social_media_plans AS plan
  SET status = 'Need Review',
      approved = false,
      completion_date = NULL
  WHERE plan.id = p_plan_id
    AND plan.status IS DISTINCT FROM 'Request Revision'
    AND (COALESCE(plan.approved, false) OR plan.status = 'Approved');
END;
$$;

REVOKE ALL ON FUNCTION public.content_brief_demote_approval(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_content_brief(
  p_plan_id uuid,
  p_base_version integer,
  p_record boolean,
  p_brief text,
  p_concept text,
  p_caption text,
  p_link text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_latest integer;
  v_status text;
  v_current_brief text;
  v_old_concept text;
  v_old_caption text;
  v_old_link text;
  v_new_concept text;
  v_new_caption text;
  v_new_link text;
  v_changed boolean := false;
BEGIN
  IF p_plan_id IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not allowed'
      USING ERRCODE = '42501';
  END IF;

  IF p_base_version IS NULL THEN
    RAISE EXCEPTION 'brief_version_required'
      USING ERRCODE = 'P0001', DETAIL = '0';
  END IF;

  SELECT plan.organization_id, plan.status, plan.brief
    INTO v_org, v_status, v_current_brief
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_org NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'Not allowed'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(MAX(versions.version_no), 0)
    INTO v_latest
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = p_plan_id;

  IF v_latest IS DISTINCT FROM p_base_version THEN
    RAISE EXCEPTION 'brief_version_conflict'
      USING ERRCODE = 'P0001', DETAIL = v_latest::text;
  END IF;

  v_new_concept := NULLIF(btrim(COALESCE(p_concept, '')), '');
  v_new_caption := NULLIF(btrim(COALESCE(p_caption, '')), '');
  v_new_link := NULLIF(btrim(COALESCE(p_link, '')), '');

  SELECT audience.description INTO v_old_concept
  FROM public.brief_target_audiences AS audience
  WHERE audience.social_media_plan_id = p_plan_id;

  SELECT caption.content INTO v_old_caption
  FROM public.brief_captions AS caption
  WHERE caption.social_media_plan_id = p_plan_id;

  SELECT link_ref.content INTO v_old_link
  FROM public.brief_link_references AS link_ref
  WHERE link_ref.social_media_plan_id = p_plan_id;

  IF v_new_concept IS DISTINCT FROM v_old_concept
     OR v_new_caption IS DISTINCT FROM v_old_caption
     OR v_new_link IS DISTINCT FROM v_old_link THEN
    v_changed := true;
  END IF;

  IF public.is_plan_pic(p_plan_id) AND p_brief IS DISTINCT FROM v_current_brief THEN
    v_changed := true;
  END IF;

  IF v_changed AND public.content_brief_revision_locked(p_plan_id) THEN
    RAISE EXCEPTION 'brief_edit_locked'
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_record, false) THEN
    PERFORM public.content_brief_snapshot(p_plan_id, auth.uid(), 'office');
  END IF;

  IF public.is_plan_pic(p_plan_id) THEN
    UPDATE public.social_media_plans
    SET brief = p_brief
    WHERE id = p_plan_id;
  END IF;

  INSERT INTO public.brief_target_audiences (social_media_plan_id, description, updated_at)
  VALUES (p_plan_id, v_new_concept, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET description = EXCLUDED.description,
      updated_at = now();

  INSERT INTO public.brief_captions (social_media_plan_id, content, updated_at)
  VALUES (p_plan_id, v_new_caption, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET content = EXCLUDED.content,
      updated_at = now();

  INSERT INTO public.brief_link_references (social_media_plan_id, content, updated_at)
  VALUES (p_plan_id, v_new_link, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET content = EXCLUDED.content,
      updated_at = now();

  IF v_changed AND v_status IS DISTINCT FROM 'Request Revision' THEN
    PERFORM public.content_brief_demote_approval(p_plan_id);
  END IF;

  SELECT COALESCE(MAX(versions.version_no), 0)
    INTO v_latest
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = p_plan_id;

  RETURN v_latest;
END;
$$;

COMMENT ON FUNCTION public.save_content_brief(uuid, integer, boolean, text, text, text, text) IS
  'Lock the plan, reject a stale base_version or a production/publish lock, optionally snapshot, then write brief, concept, caption, and link. An approved brief returns to Need Review when the content changes.';

CREATE OR REPLACE FUNCTION public.restore_content_brief_version(p_version_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan uuid;
  v_brief text;
  v_concept text;
  v_caption text;
  v_link text;
  v_live_brief text;
  v_live_concept text;
  v_live_caption text;
  v_live_link text;
  v_status text;
  v_changed boolean := false;
  v_recorded uuid;
BEGIN
  IF p_version_id IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Only the PIC can edit brief content'
      USING ERRCODE = '42501';
  END IF;

  SELECT versions.social_media_plan_id,
         versions.brief,
         versions.concept,
         versions.caption,
         versions.link_reference
    INTO v_plan, v_brief, v_concept, v_caption, v_link
  FROM public.content_brief_versions AS versions
  WHERE versions.id = p_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_plan_pic(v_plan) THEN
    RAISE EXCEPTION 'Only the PIC can edit brief content'
      USING ERRCODE = '42501';
  END IF;

  SELECT plan.brief, plan.status
    INTO v_live_brief, v_status
  FROM public.social_media_plans AS plan
  WHERE plan.id = v_plan
  FOR UPDATE;

  SELECT audience.description INTO v_live_concept
  FROM public.brief_target_audiences AS audience
  WHERE audience.social_media_plan_id = v_plan;

  SELECT caption.content INTO v_live_caption
  FROM public.brief_captions AS caption
  WHERE caption.social_media_plan_id = v_plan;

  SELECT link_ref.content INTO v_live_link
  FROM public.brief_link_references AS link_ref
  WHERE link_ref.social_media_plan_id = v_plan;

  v_changed := v_brief IS DISTINCT FROM v_live_brief
    OR v_concept IS DISTINCT FROM v_live_concept
    OR v_caption IS DISTINCT FROM v_live_caption
    OR v_link IS DISTINCT FROM v_live_link;

  IF v_changed AND public.content_brief_revision_locked(v_plan) THEN
    RAISE EXCEPTION 'brief_edit_locked'
      USING ERRCODE = 'P0001';
  END IF;

  v_recorded := public.record_content_brief_version(v_plan);

  UPDATE public.social_media_plans
  SET brief = v_brief
  WHERE id = v_plan;

  INSERT INTO public.brief_target_audiences (social_media_plan_id, description, updated_at)
  VALUES (v_plan, v_concept, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET description = EXCLUDED.description,
      updated_at = now();

  INSERT INTO public.brief_captions (social_media_plan_id, content, updated_at)
  VALUES (v_plan, v_caption, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET content = EXCLUDED.content,
      updated_at = now();

  INSERT INTO public.brief_link_references (social_media_plan_id, content, updated_at)
  VALUES (v_plan, v_link, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET content = EXCLUDED.content,
      updated_at = now();

  IF v_changed AND v_status IS DISTINCT FROM 'Request Revision' THEN
    PERFORM public.content_brief_demote_approval(v_plan);
  END IF;

  RETURN v_recorded;
END;
$$;

COMMENT ON FUNCTION public.restore_content_brief_version(uuid) IS
  'PIC only. Reject a production or publish lock, snapshot the live brief, then write the chosen version. An approved brief returns to Need Review.';

CREATE OR REPLACE FUNCTION public.mcp_update_content_plan(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_title text,
  p_post_date text,
  p_brief text,
  p_base_version integer DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  post_date timestamptz,
  approved boolean,
  production_status text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_title text;
  v_brief text;
  v_day date;
  v_post_date timestamptz;
  v_pic uuid;
  v_existing_pic uuid;
  v_current_brief text;
  v_latest integer;
  v_brief_changed boolean := false;
  v_plan public.social_media_plans%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL THEN
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

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  IF p_title IS NOT NULL AND (v_title IS NULL OR char_length(v_title) > 200) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_brief := NULLIF(btrim(COALESCE(p_brief, '')), '');
  IF p_brief IS NOT NULL AND (v_brief IS NULL OR char_length(v_brief) > 4000) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_post_date IS NULL OR NULLIF(btrim(p_post_date), '') IS NULL THEN
    v_post_date := NULL;
  ELSE
    IF btrim(p_post_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_day := btrim(p_post_date)::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END;
    IF to_char(v_day, 'YYYY-MM-DD') <> btrim(p_post_date) THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    v_post_date := v_day::timestamp AT TIME ZONE 'Asia/Jakarta';
  END IF;

  IF v_title IS NULL AND v_brief IS NULL AND v_post_date IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_brief IS NOT NULL THEN
    SELECT plan.pic_id, plan.brief
      INTO v_existing_pic, v_current_brief
    FROM public.social_media_plans plan
    WHERE plan.id = p_id
      AND plan.organization_id = p_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;

    IF v_brief IS DISTINCT FROM NULLIF(btrim(COALESCE(v_current_brief, '')), '') THEN
      SELECT COALESCE(MAX(versions.version_no), 0)
        INTO v_latest
      FROM public.content_brief_versions AS versions
      WHERE versions.social_media_plan_id = p_id;

      IF p_base_version IS NULL THEN
        RAISE EXCEPTION 'brief_version_required'
          USING ERRCODE = 'P0001', DETAIL = v_latest::text;
      END IF;

      IF p_base_version IS DISTINCT FROM v_latest THEN
        RAISE EXCEPTION 'brief_version_conflict'
          USING ERRCODE = 'P0001', DETAIL = v_latest::text;
      END IF;

      IF public.content_brief_revision_locked(p_id) THEN
        RAISE EXCEPTION 'brief_edit_locked'
          USING ERRCODE = 'P0001';
      END IF;

      PERFORM public.content_brief_snapshot(p_id, p_user_id, 'mcp');
      v_brief_changed := true;
    END IF;

    IF v_existing_pic IS NULL THEN
      SELECT emp.id
        INTO v_pic
      FROM public.employees emp
      LEFT JOIN public.employee_statuses es ON es.id = emp.employee_status_id
      WHERE emp.organization_id = p_organization_id
        AND emp.user_id = p_user_id
        AND COALESCE(emp.pending_removal, false) = false
        AND lower(COALESCE(emp.status, 'active')) NOT IN ('inactive', 'terminated', 'resigned')
        AND lower(regexp_replace(COALESCE(es.name, ''), '[\s_]+', '', 'g'))
          NOT IN ('inactive', 'terminated', 'pendingremoval')
      ORDER BY emp.id ASC
      LIMIT 1;

      IF v_pic IS NULL THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
      END IF;

      UPDATE public.social_media_plans plan
      SET pic_id = v_pic
      WHERE plan.id = p_id
        AND plan.organization_id = p_organization_id
        AND plan.pic_id IS NULL;
    END IF;
  END IF;

  PERFORM set_config('mcp.plan_brief_user', p_user_id::text, true);

  UPDATE public.social_media_plans AS plan
  SET
    title = COALESCE(v_title, plan.title),
    brief = COALESCE(v_brief, plan.brief),
    post_date = COALESCE(v_post_date, plan.post_date),
    updated_at = now()
  WHERE plan.id = p_id
    AND plan.organization_id = p_organization_id
  RETURNING * INTO v_plan;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_brief_changed THEN
    PERFORM public.content_brief_demote_approval(p_id);
    SELECT * INTO v_plan
    FROM public.social_media_plans AS plan
    WHERE plan.id = p_id;
  END IF;

  id := v_plan.id;
  title := v_plan.title;
  status := v_plan.status;
  post_date := v_plan.post_date;
  approved := v_plan.approved;
  production_status := v_plan.production_status;
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_update_content_plan(uuid, uuid, uuid, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_update_content_plan(uuid, uuid, uuid, text, text, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_content_plan(uuid, uuid, uuid, text, text, text, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
