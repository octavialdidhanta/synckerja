-- Reject a brief save when a newer version exists, then write the four content fields
-- in the same transaction. Office and content.plans.update share version_no.

CREATE OR REPLACE FUNCTION public.content_brief_snapshot(
  p_plan_id uuid,
  p_actor uuid,
  p_source text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_brief text;
  v_concept text;
  v_caption text;
  v_link text;
  v_hash text;
  v_last_hash text;
  v_next integer;
  v_id uuid;
BEGIN
  IF p_plan_id IS NULL OR p_source NOT IN ('office', 'mcp') THEN
    RAISE EXCEPTION 'Not allowed'
      USING ERRCODE = '42501';
  END IF;

  SELECT plan.organization_id, plan.brief
    INTO v_org, v_brief
  FROM public.social_media_plans AS plan
  WHERE plan.id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT audience.description
    INTO v_concept
  FROM public.brief_target_audiences AS audience
  WHERE audience.social_media_plan_id = p_plan_id;

  SELECT caption.content
    INTO v_caption
  FROM public.brief_captions AS caption
  WHERE caption.social_media_plan_id = p_plan_id;

  SELECT link_ref.content
    INTO v_link
  FROM public.brief_link_references AS link_ref
  WHERE link_ref.social_media_plan_id = p_plan_id;

  v_hash := md5(
    CASE WHEN v_brief IS NULL THEN 'N' ELSE 'T' || v_brief END
    || E'\x1f' ||
    CASE WHEN v_concept IS NULL THEN 'N' ELSE 'T' || v_concept END
    || E'\x1f' ||
    CASE WHEN v_caption IS NULL THEN 'N' ELSE 'T' || v_caption END
    || E'\x1f' ||
    CASE WHEN v_link IS NULL THEN 'N' ELSE 'T' || v_link END
  );

  SELECT versions.content_hash
    INTO v_last_hash
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = p_plan_id
  ORDER BY versions.version_no DESC
  LIMIT 1;

  IF v_last_hash IS NOT NULL AND v_last_hash = v_hash THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(MAX(versions.version_no), 0) + 1
    INTO v_next
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = p_plan_id;

  INSERT INTO public.content_brief_versions (
    organization_id,
    social_media_plan_id,
    version_no,
    brief,
    concept,
    caption,
    link_reference,
    content_hash,
    created_by,
    source
  ) VALUES (
    v_org,
    p_plan_id,
    v_next,
    v_brief,
    v_concept,
    v_caption,
    v_link,
    v_hash,
    p_actor,
    p_source
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.content_brief_snapshot(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_content_brief_version(p_plan_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF p_plan_id IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not allowed'
      USING ERRCODE = '42501';
  END IF;

  SELECT plan.organization_id
    INTO v_org
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

  RETURN public.content_brief_snapshot(p_plan_id, auth.uid(), 'office');
END;
$$;

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
BEGIN
  IF p_plan_id IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not allowed'
      USING ERRCODE = '42501';
  END IF;

  IF p_base_version IS NULL THEN
    RAISE EXCEPTION 'brief_version_required'
      USING ERRCODE = 'P0001', DETAIL = '0';
  END IF;

  SELECT plan.organization_id
    INTO v_org
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

  IF COALESCE(p_record, false) THEN
    PERFORM public.content_brief_snapshot(p_plan_id, auth.uid(), 'office');
  END IF;

  IF public.is_plan_pic(p_plan_id) THEN
    UPDATE public.social_media_plans
    SET brief = p_brief
    WHERE id = p_plan_id;
  END IF;

  INSERT INTO public.brief_target_audiences (social_media_plan_id, description, updated_at)
  VALUES (p_plan_id, NULLIF(btrim(COALESCE(p_concept, '')), ''), now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET description = EXCLUDED.description,
      updated_at = now();

  INSERT INTO public.brief_captions (social_media_plan_id, content, updated_at)
  VALUES (p_plan_id, NULLIF(btrim(COALESCE(p_caption, '')), ''), now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET content = EXCLUDED.content,
      updated_at = now();

  INSERT INTO public.brief_link_references (social_media_plan_id, content, updated_at)
  VALUES (p_plan_id, NULLIF(btrim(COALESCE(p_link, '')), ''), now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET content = EXCLUDED.content,
      updated_at = now();

  SELECT COALESCE(MAX(versions.version_no), 0)
    INTO v_latest
  FROM public.content_brief_versions AS versions
  WHERE versions.social_media_plan_id = p_plan_id;

  RETURN v_latest;
END;
$$;

COMMENT ON FUNCTION public.save_content_brief(uuid, integer, boolean, text, text, text, text) IS
  'Lock the plan, reject a stale base_version, optionally snapshot, then write brief, concept, caption, and link. Does not change status or approval.';

REVOKE ALL ON FUNCTION public.save_content_brief(uuid, integer, boolean, text, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_content_brief(uuid, integer, boolean, text, text, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.mcp_update_content_plan(uuid, uuid, uuid, text, text, text);

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

      PERFORM public.content_brief_snapshot(p_id, p_user_id, 'mcp');
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

DROP FUNCTION IF EXISTS public.mcp_get_content_brief(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.mcp_get_content_brief(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid
)
RETURNS TABLE(
  id uuid,
  title text,
  status text,
  approved boolean,
  production_status text,
  post_date timestamptz,
  updated_at timestamptz,
  content_type_name text,
  service_name text,
  sub_service_name text,
  feature_name text,
  pillar_name text,
  pic_name text,
  brief text,
  concept jsonb,
  concept_text text,
  caption text,
  has_drive_file boolean,
  published boolean,
  version_no integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_raw text;
  v_doc jsonb;
  v_concept jsonb;
  v_concept_text text;
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.social_media_plans plan
    WHERE plan.id = p_id
      AND plan.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT ta.description
  INTO v_raw
  FROM public.brief_target_audiences ta
  WHERE ta.social_media_plan_id = p_id
  ORDER BY ta.updated_at DESC NULLS LAST, ta.created_at DESC
  LIMIT 1;

  v_raw := NULLIF(btrim(COALESCE(v_raw, '')), '');
  IF v_raw IS NOT NULL AND left(v_raw, 1) = '{' THEN
    BEGIN
      v_doc := v_raw::jsonb;
    EXCEPTION WHEN others THEN
      v_doc := NULL;
    END;
  END IF;

  IF v_doc IS NOT NULL AND jsonb_typeof(v_doc) = 'object' THEN
    v_concept := jsonb_build_object(
      'voice_over', NULLIF(left(btrim(COALESCE(v_doc->>'voiceOver', '')), 4000), ''),
      'post_aspect', NULLIF(btrim(COALESCE(v_doc->>'postAspect', '')), ''),
      'characters', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'handle', left(btrim(COALESCE(item->>'handle', item->>'name', '')), 80),
          'description', left(btrim(COALESCE(item->>'description', '')), 500)
        ))
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_doc->'characters') = 'array' THEN v_doc->'characters' ELSE '[]'::jsonb END) AS item
        WHERE jsonb_typeof(item) = 'object'
      ), '[]'::jsonb),
      'locations', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'handle', left(btrim(COALESCE(item->>'handle', item->>'name', '')), 80),
          'description', left(btrim(COALESCE(item->>'description', '')), 500)
        ))
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_doc->'locations') = 'array' THEN v_doc->'locations' ELSE '[]'::jsonb END) AS item
        WHERE jsonb_typeof(item) = 'object'
      ), '[]'::jsonb),
      'properties', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'handle', left(btrim(COALESCE(item->>'handle', item->>'name', '')), 80),
          'description', left(btrim(COALESCE(item->>'description', '')), 500)
        ))
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_doc->'properties') = 'array' THEN v_doc->'properties' ELSE '[]'::jsonb END) AS item
        WHERE jsonb_typeof(item) = 'object'
      ), '[]'::jsonb)
    );
  ELSIF v_raw IS NOT NULL THEN
    v_concept_text := left(v_raw, 4000);
  END IF;

  RETURN QUERY
  SELECT
    plan.id,
    plan.title::text,
    plan.status::text,
    plan.approved,
    plan.production_status::text,
    plan.post_date,
    plan.updated_at,
    ct.name::text,
    svc.name::text,
    sub.name::text,
    feat.feature_name::text,
    pillar.name::text,
    emp.full_name::text,
    left(COALESCE(plan.brief, ''), 25000)::text,
    v_concept,
    v_concept_text,
    (
      SELECT left(cap.content, 2200)::text
      FROM public.brief_captions cap
      WHERE cap.social_media_plan_id = plan.id
      ORDER BY cap.updated_at DESC NULLS LAST, cap.created_at DESC
      LIMIT 1
    ),
    NULLIF(btrim(COALESCE(plan.google_drive_link, '')), '') IS NOT NULL,
    COALESCE(plan.post_link::text, 'null') NOT IN ('null', '[]', '{}', '""'),
    COALESCE((
      SELECT MAX(versions.version_no)
      FROM public.content_brief_versions AS versions
      WHERE versions.social_media_plan_id = plan.id
    ), 0)::integer
  FROM public.social_media_plans plan
  LEFT JOIN public.content_types ct ON ct.id = plan.content_type_id
  LEFT JOIN public.services svc ON svc.id = plan.service_id AND svc.organization_id = plan.organization_id
  LEFT JOIN public.sub_services sub ON sub.id = plan.sub_service_id AND sub.organization_id = plan.organization_id
  LEFT JOIN public.product_knowledge_features feat ON feat.id = plan.feature_id AND feat.organization_id = plan.organization_id
  LEFT JOIN public.content_pillars pillar ON pillar.id = plan.content_pillar_id
  LEFT JOIN public.employees emp ON emp.id = plan.pic_id AND emp.organization_id = plan.organization_id
  WHERE plan.id = p_id
    AND plan.organization_id = p_organization_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_get_content_brief(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_get_content_brief(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_content_brief(uuid, uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
