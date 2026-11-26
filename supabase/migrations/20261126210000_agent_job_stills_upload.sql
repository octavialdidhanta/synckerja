-- Still-preview contact sheet uploaded by the Agent, so Claude (render.stills.create wait / render.stills.get) and
-- Office can see it without the laptop. One JPEG per job at <org>/render-stills/<job_id>.jpg in catalog-media.

CREATE OR REPLACE FUNCTION public.agent_job_stills_target(p_token_id uuid, p_job_id uuid, p_claim_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $stills_target$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'render');
  v_job public.agent_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.agent_jobs
  WHERE id = p_job_id AND organization_id = v_org AND claim_token = p_claim_token AND status = 'running';
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_job.spec ? 'stills') THEN
    RETURN jsonb_build_object('path', NULL, 'reason', 'not_stills');
  END IF;
  RETURN jsonb_build_object('path', v_org::text || '/render-stills/' || v_job.id::text || '.jpg');
END;
$stills_target$;

REVOKE ALL ON FUNCTION public.agent_job_stills_target(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_job_stills_target(uuid, uuid, uuid) TO service_role;
