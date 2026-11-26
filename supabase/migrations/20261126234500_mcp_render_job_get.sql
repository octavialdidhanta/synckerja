-- MCP render.jobs.get: read back the spec of one earlier render job (the Agent already keeps it in agent_jobs.spec),
-- so a revision starts from the last version and patches only what changed instead of picking every shot again.
-- Either p_job_id, or p_plan_id for the newest finished full render (not a still preview) of that content plan.

CREATE OR REPLACE FUNCTION public.mcp_get_render_job(
  p_user_id uuid,
  p_organization_id uuid,
  p_job_id uuid,
  p_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $get_render_job$
DECLARE
  v_job public.agent_jobs%ROWTYPE;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  IF (p_job_id IS NULL) = (p_plan_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_input: pass job_id or plan_id';
  END IF;

  IF p_job_id IS NOT NULL THEN
    SELECT * INTO v_job FROM public.agent_jobs
    WHERE id = p_job_id AND organization_id = p_organization_id AND kind = 'render';
  ELSE
    SELECT * INTO v_job FROM public.agent_jobs
    WHERE organization_id = p_organization_id
      AND kind = 'render'
      AND social_media_plan_id = p_plan_id
      AND status = 'done'
      AND NOT (spec ? 'stills')
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  RETURN jsonb_build_object(
    'job_id', v_job.id,
    'title', v_job.title,
    'plan_id', v_job.social_media_plan_id,
    'status', v_job.status,
    'stage', v_job.stage,
    'error', v_job.error,
    'result', v_job.result,
    'spec', v_job.spec,
    'created_at', v_job.created_at,
    'finished_at', v_job.finished_at
  );
END;
$get_render_job$;

REVOKE ALL ON FUNCTION public.mcp_get_render_job(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_render_job(uuid, uuid, uuid, uuid) TO service_role;
