-- render.jobs.draft / render.stills.create / render.jobs.create.preview: say before the render whether the
-- finished video will reach the plan. The Agent uploads through content-plan-media-upload, which refuses
-- (uploadBlockReason in supabase/functions/_shared/orgDrive/uploadRules.ts, then getOrgDriveAccessToken):
--   not_approved       brief not approved            (approved IS NOT TRUE)
--   production_locked  production already approved  (raised here as before: never queue such a render)
--   not_video_content  Post / Carousel plan
--   not_connected      organization Drive not connected (no active connection or no refresh token)
-- Same order and the same conditions, so upload_block is exactly the refusal the Agent would get at the end.
-- reconnect_required (an expired Google token) only shows when the token is refreshed and is not predicted.

CREATE OR REPLACE FUNCTION public.mcp_render_job_plan_check(p_organization_id uuid, p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $plan_check$
DECLARE
  v_plan record;
  v_type text;
  v_drive boolean;
  v_block text;
BEGIN
  IF p_plan_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id, title, production_status, production_approved, approved, content_type_id INTO v_plan
  FROM public.social_media_plans WHERE id = p_plan_id AND organization_id = p_organization_id;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  -- Never queue a render that would replace an approved video.
  IF COALESCE(v_plan.production_approved, false) THEN
    RAISE EXCEPTION 'production_locked' USING ERRCODE = '42501';
  END IF;

  SELECT lower(btrim(COALESCE(ct.name, ''))) INTO v_type FROM public.content_types ct WHERE ct.id = v_plan.content_type_id;
  SELECT COALESCE(c.is_active, false) AND t.refresh_token_enc IS NOT NULL INTO v_drive
  FROM public.organization_google_drive_connections c
  LEFT JOIN public.organization_google_drive_connection_tokens t ON t.organization_id = c.organization_id
  WHERE c.organization_id = p_organization_id;

  v_block := CASE
    WHEN v_plan.approved IS NOT TRUE THEN 'not_approved'
    WHEN COALESCE(v_type, '') IN ('post', 'carousel') THEN 'not_video_content'
    WHEN NOT COALESCE(v_drive, false) THEN 'not_connected'
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'plan_id', v_plan.id,
    'title', v_plan.title,
    'production_status', v_plan.production_status,
    'approved', v_plan.approved IS TRUE,
    'upload_block', v_block
  );
END;
$plan_check$;

REVOKE ALL ON FUNCTION public.mcp_render_job_plan_check(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Read-only status for render.jobs.draft and render.stills.create (they never queue a plan upload themselves):
-- the same plan_check, with production_locked reported as upload_block instead of raised.
CREATE OR REPLACE FUNCTION public.mcp_render_plan_status(p_user_id uuid, p_organization_id uuid, p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $plan_status$
DECLARE
  v_title text;
  v_approved boolean;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  IF p_plan_id IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN public.mcp_render_job_plan_check(p_organization_id, p_plan_id);
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'production_locked' THEN
      RAISE;
    END IF;
    SELECT title, approved INTO v_title, v_approved
    FROM public.social_media_plans WHERE id = p_plan_id AND organization_id = p_organization_id;
    RETURN jsonb_build_object('plan_id', p_plan_id, 'title', v_title, 'approved', v_approved IS TRUE,
      'upload_block', 'production_locked');
  END;
END;
$plan_status$;

REVOKE ALL ON FUNCTION public.mcp_render_plan_status(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_render_plan_status(uuid, uuid, uuid) TO service_role;
