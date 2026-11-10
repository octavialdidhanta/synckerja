-- MCP read tool content.briefs.get: read one content plan's storyboard, script, concept and caption.
-- Read only. Locked to the session organization. Executable by service_role only (the MCP server).

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
  published boolean
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
    -- Whitelist only: image paths (portraitPath, bodyPath, locationPath, ...) never leave the database.
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
    COALESCE(plan.post_link::text, 'null') NOT IN ('null', '[]', '{}', '""')
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
