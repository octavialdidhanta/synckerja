-- Gate 2 in one yes: content.briefs.create.preview shows the brief and the shot list together,
-- and content.briefs.create with that confirm_token saves the new content plan, its brief, and its
-- shot list (external_id = the new ContentID) in one transaction. Either everything is saved or nothing.
-- The confirm id is recorded once, so a repeated call never creates a second content plan.

CREATE OR REPLACE FUNCTION public.mcp_create_content_brief_confirmed(
  p_user_id uuid,
  p_organization_id uuid,
  p_confirm_id uuid,
  p_title text,
  p_post_date text,
  p_content_type_id uuid,
  p_service_id uuid,
  p_sub_service_id uuid,
  p_feature_id uuid,
  p_brief text,
  p_concept text,
  p_caption text,
  p_post_aspect text,
  p_shotlist jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $create_confirmed$
DECLARE
  v_plan record;
  v_external_id text;
  v_job jsonb;
  v_shotlist jsonb := NULL;
BEGIN
  IF p_confirm_id IS NULL THEN
    RAISE EXCEPTION 'confirmation_invalid' USING ERRCODE = '22023';
  END IF;
  IF p_shotlist IS NOT NULL AND jsonb_typeof(p_shotlist) <> 'object' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  -- One confirm_token creates one content plan.
  BEGIN
    INSERT INTO public.mcp_tool_confirmations (id, organization_id, user_id, tool)
    VALUES (p_confirm_id, p_organization_id, p_user_id, 'content.briefs.create');
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'confirmation_used' USING ERRCODE = 'P0001';
  END;

  SELECT * INTO v_plan
  FROM public.mcp_create_content_brief(
    p_user_id, p_organization_id, p_title, p_post_date, p_content_type_id,
    p_service_id, p_sub_service_id, p_feature_id, p_brief, p_concept, p_caption, p_post_aspect
  );

  IF p_shotlist IS NOT NULL THEN
    -- The ContentID convention is the first 8 characters; the full id when that prefix is not unique.
    v_external_id := left(v_plan.id::text, 8);
    IF public.catalog_shot_job_plan_for(p_organization_id, v_external_id) IS DISTINCT FROM v_plan.id
       OR EXISTS (
         SELECT 1 FROM public.catalog_shot_jobs j
         WHERE j.organization_id = p_organization_id AND j.external_id = v_external_id
       ) THEN
      v_external_id := v_plan.id::text;
    END IF;

    v_job := public.mcp_catalog_normalize_shot_job(jsonb_build_object(
      'external_id', v_external_id,
      'document', p_shotlist - 'job_id'
    ));

    -- The link trigger sets social_media_plan_id from external_id.
    INSERT INTO public.catalog_shot_jobs (organization_id, external_id, document)
    VALUES (p_organization_id, v_external_id, v_job->'document');

    v_shotlist := jsonb_build_object(
      'external_id', v_external_id,
      'judul', v_job->'document'->>'judul',
      'shots', public.mcp_catalog_list_len(v_job->'document'->'shots')
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_plan.id,
    'title', v_plan.title,
    'content_type_name', v_plan.content_type_name,
    'service_name', v_plan.service_name,
    'sub_service_name', v_plan.sub_service_name,
    'feature_name', v_plan.feature_name,
    'shot_count', v_plan.shot_count,
    'shotlist', v_shotlist
  );
END;
$create_confirmed$;

REVOKE ALL ON FUNCTION public.mcp_create_content_brief_confirmed(
  uuid, uuid, uuid, text, text, uuid, uuid, uuid, uuid, text, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_content_brief_confirmed(
  uuid, uuid, uuid, text, text, uuid, uuid, uuid, uuid, text, text, text, text, jsonb
) TO service_role;
