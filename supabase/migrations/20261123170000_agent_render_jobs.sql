-- Synckerja Agent — step 6: the render queue.
--
-- Claude (MCP render.jobs.create, confirmed by a person) queues a render job with a spec: shots from the
-- footage catalog, VO/music files in the production folder, texts and styles. The laptop Agent claims it,
-- renders with the full Windows CPU, checks it, and uploads the result to the content plan as a new
-- version (Need Review). Every job belongs to one organization; only that organization's Agent sees it.

CREATE TABLE public.agent_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'render' CONSTRAINT agent_jobs_kind_check CHECK (kind IN ('render')),
  social_media_plan_id uuid REFERENCES public.social_media_plans(id) ON DELETE SET NULL,
  title text NOT NULL CONSTRAINT agent_jobs_title_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  spec jsonb NOT NULL CONSTRAINT agent_jobs_spec_check CHECK (jsonb_typeof(spec) = 'object' AND octet_length(spec::text) <= 200000),
  status text NOT NULL DEFAULT 'queued'
    CONSTRAINT agent_jobs_status_check CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  progress integer NOT NULL DEFAULT 0 CONSTRAINT agent_jobs_progress_check CHECK (progress BETWEEN 0 AND 100),
  stage text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claim_token uuid,
  claimed_by_device uuid REFERENCES public.agent_devices(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz,
  log text,
  error text,
  result jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_jobs_queue_idx ON public.agent_jobs (organization_id, status, next_attempt_at, created_at);
CREATE INDEX agent_jobs_recent_idx ON public.agent_jobs (organization_id, created_at DESC);

ALTER TABLE public.agent_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_jobs FROM anon, authenticated;
GRANT SELECT ON public.agent_jobs TO authenticated;
GRANT ALL ON public.agent_jobs TO service_role;

CREATE POLICY agent_jobs_select_member ON public.agent_jobs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = (SELECT auth.uid())
      AND uo.organization_id = agent_jobs.organization_id
      AND COALESCE(uo.is_active, true)
  ));

-- A running job without a progress report for this long is taken over by the next claim.
CREATE OR REPLACE FUNCTION public.agent_job_stale_after()
RETURNS interval LANGUAGE sql IMMUTABLE AS $$ SELECT interval '15 minutes' $$;

-- ── Agent (service role, through agent-api).

CREATE OR REPLACE FUNCTION public.agent_job_claim(p_token_id uuid, p_device_key uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $claim$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'render');
  v_device uuid;
  v_job public.agent_jobs%ROWTYPE;
BEGIN
  SELECT id INTO v_device FROM public.agent_devices WHERE device_key = p_device_key;

  SELECT * INTO v_job
  FROM public.agent_jobs j
  WHERE j.organization_id = v_org
    AND (
      (j.status = 'queued' AND j.next_attempt_at <= now())
      OR (j.status = 'running' AND COALESCE(j.heartbeat_at, j.claimed_at) < now() - public.agent_job_stale_after())
    )
  ORDER BY j.created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job.id IS NULL THEN
    RETURN jsonb_build_object('job', NULL);
  END IF;

  UPDATE public.agent_jobs SET
    status = 'running',
    attempts = attempts + 1,
    claim_token = gen_random_uuid(),
    claimed_by_device = v_device,
    claimed_at = now(),
    heartbeat_at = now(),
    progress = 0,
    stage = 'mulai',
    error = NULL,
    updated_at = now()
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  RETURN jsonb_build_object('job', jsonb_build_object(
    'id', v_job.id,
    'claim_token', v_job.claim_token,
    'title', v_job.title,
    'plan_id', v_job.social_media_plan_id,
    'spec', v_job.spec,
    'attempt', v_job.attempts,
    'max_attempts', v_job.max_attempts
  ));
END;
$claim$;

CREATE OR REPLACE FUNCTION public.agent_job_progress(
  p_token_id uuid, p_job_id uuid, p_claim_token uuid, p_progress integer, p_stage text, p_log text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $progress$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'render');
  v_status text;
BEGIN
  UPDATE public.agent_jobs SET
    progress = LEAST(GREATEST(COALESCE(p_progress, progress), 0), 100),
    stage = COALESCE(left(p_stage, 80), stage),
    log = CASE WHEN p_log IS NULL THEN log ELSE right(p_log, 20000) END,
    heartbeat_at = now(),
    updated_at = now()
  WHERE id = p_job_id AND organization_id = v_org AND claim_token = p_claim_token AND status = 'running'
  RETURNING status INTO v_status;
  IF v_status IS NULL THEN
    -- Cancelled in Office, or taken over: the Agent must stop working on it.
    RETURN jsonb_build_object('continue', false);
  END IF;
  RETURN jsonb_build_object('continue', true);
END;
$progress$;

CREATE OR REPLACE FUNCTION public.agent_job_finish(
  p_token_id uuid, p_job_id uuid, p_claim_token uuid, p_ok boolean, p_result jsonb, p_error text, p_log text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $finish$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'render');
  v_job public.agent_jobs%ROWTYPE;
  v_retry boolean;
BEGIN
  SELECT * INTO v_job FROM public.agent_jobs
  WHERE id = p_job_id AND organization_id = v_org AND claim_token = p_claim_token AND status = 'running'
  FOR UPDATE;
  IF v_job.id IS NULL THEN
    RETURN jsonb_build_object('accepted', false);
  END IF;
  IF p_result IS NOT NULL AND (jsonb_typeof(p_result) <> 'object' OR octet_length(p_result::text) > 20000) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_retry := NOT COALESCE(p_ok, false) AND v_job.attempts < v_job.max_attempts;
  UPDATE public.agent_jobs SET
    status = CASE WHEN COALESCE(p_ok, false) THEN 'done' WHEN v_retry THEN 'queued' ELSE 'failed' END,
    progress = CASE WHEN COALESCE(p_ok, false) THEN 100 ELSE progress END,
    stage = CASE WHEN COALESCE(p_ok, false) THEN 'selesai' WHEN v_retry THEN 'menunggu coba lagi' ELSE 'gagal' END,
    -- 1, 5, then 15 minutes between attempts.
    next_attempt_at = now() + (CASE v_job.attempts WHEN 1 THEN interval '1 minute' WHEN 2 THEN interval '5 minutes' ELSE interval '15 minutes' END),
    claim_token = NULL,
    finished_at = CASE WHEN COALESCE(p_ok, false) OR NOT v_retry THEN now() ELSE NULL END,
    result = COALESCE(p_result, result),
    error = CASE WHEN COALESCE(p_ok, false) THEN NULL ELSE left(COALESCE(p_error, 'gagal'), 2000) END,
    log = CASE WHEN p_log IS NULL THEN log ELSE right(p_log, 20000) END,
    updated_at = now()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  RETURN jsonb_build_object('accepted', true, 'status', v_job.status);
END;
$finish$;

-- The plan a job may upload to: same organization, and production not approved yet (never replace an approved video).
CREATE OR REPLACE FUNCTION public.agent_job_upload_target(p_token_id uuid, p_job_id uuid, p_claim_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $target$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'render');
  v_job public.agent_jobs%ROWTYPE;
  v_approved boolean;
BEGIN
  SELECT * INTO v_job FROM public.agent_jobs
  WHERE id = p_job_id AND organization_id = v_org AND claim_token = p_claim_token AND status = 'running';
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_job.social_media_plan_id IS NULL THEN
    RETURN jsonb_build_object('plan_id', NULL, 'reason', 'no_plan');
  END IF;
  SELECT production_approved INTO v_approved FROM public.social_media_plans
  WHERE id = v_job.social_media_plan_id AND organization_id = v_org;
  IF COALESCE(v_approved, false) THEN
    RETURN jsonb_build_object('plan_id', NULL, 'reason', 'production_locked');
  END IF;
  -- created_by is the person who confirmed the job; the upload is done in their name.
  RETURN jsonb_build_object('plan_id', v_job.social_media_plan_id, 'user_id', v_job.created_by);
END;
$target$;

-- ── Office: cancel or retry (any member of the organization).

CREATE OR REPLACE FUNCTION public.agent_job_cancel(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $cancel$
DECLARE
  v_status text;
BEGIN
  UPDATE public.agent_jobs j SET status = 'cancelled', claim_token = NULL, finished_at = now(), stage = 'dibatalkan', updated_at = now()
  WHERE j.id = p_job_id AND j.status IN ('queued', 'running')
    AND EXISTS (SELECT 1 FROM public.user_organizations uo
                WHERE uo.user_id = auth.uid() AND uo.organization_id = j.organization_id AND COALESCE(uo.is_active, true))
  RETURNING status INTO v_status;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('id', p_job_id, 'status', v_status);
END;
$cancel$;

CREATE OR REPLACE FUNCTION public.agent_job_retry(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $retry$
DECLARE
  v_status text;
BEGIN
  UPDATE public.agent_jobs j SET
    status = 'queued', attempts = 0, next_attempt_at = now(), error = NULL, finished_at = NULL,
    progress = 0, stage = 'antri', updated_at = now()
  WHERE j.id = p_job_id AND j.status IN ('failed', 'cancelled')
    AND EXISTS (SELECT 1 FROM public.user_organizations uo
                WHERE uo.user_id = auth.uid() AND uo.organization_id = j.organization_id AND COALESCE(uo.is_active, true))
  RETURNING status INTO v_status;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('id', p_job_id, 'status', v_status);
END;
$retry$;

-- ── MCP render.jobs.create (preview → confirm, like every MCP write). The spec is validated by the MCP server.

ALTER TABLE public.mcp_footage_previews DROP CONSTRAINT mcp_footage_previews_tool_check;
ALTER TABLE public.mcp_footage_previews ADD CONSTRAINT mcp_footage_previews_tool_check CHECK (
  tool IN (
    'footage.scenes.upsert_batch',
    'footage.usage.log',
    'footage.move',
    'footage.ban.add',
    'footage.clips.upsert',
    'footage.clips.create',
    'footage.delete',
    'footage.restore',
    'catalog.media.delete',
    'catalog.media.restore',
    'catalog.style.update',
    'catalog.reference.upsert',
    'catalog.shotlist.upsert',
    'render.jobs.create'
  )
);

CREATE OR REPLACE FUNCTION public.mcp_render_job_plan_check(p_organization_id uuid, p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $plan_check$
DECLARE
  v_plan record;
BEGIN
  IF p_plan_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id, title, production_status, production_approved INTO v_plan
  FROM public.social_media_plans WHERE id = p_plan_id AND organization_id = p_organization_id;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  -- Never queue a render that would replace an approved video.
  IF COALESCE(v_plan.production_approved, false) THEN
    RAISE EXCEPTION 'production_locked' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('plan_id', v_plan.id, 'title', v_plan.title, 'production_status', v_plan.production_status);
END;
$plan_check$;

CREATE OR REPLACE FUNCTION public.mcp_preview_render_job(p_user_id uuid, p_organization_id uuid, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_render$
DECLARE
  v_plan jsonb;
  v_id uuid;
  v_expires timestamptz;
  v_plan_id uuid;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' OR jsonb_typeof(p_input->'spec') <> 'object'
     OR char_length(btrim(COALESCE(p_input->>'title', ''))) NOT BETWEEN 1 AND 200
     OR octet_length((p_input->'spec')::text) > 200000 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  v_plan_id := NULLIF(p_input->>'plan_id', '')::uuid;
  v_plan := public.mcp_render_job_plan_check(p_organization_id, v_plan_id);

  DELETE FROM public.mcp_footage_previews WHERE organization_id = p_organization_id AND expires_at <= now();
  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id, p_user_id, 'render.jobs.create',
    jsonb_build_object('plan_id', v_plan_id, 'title', btrim(p_input->>'title'), 'spec', p_input->'spec'),
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object('plan', v_plan, 'preview_id', v_id, 'expires_at', v_expires);
END;
$preview_render$;

CREATE OR REPLACE FUNCTION public.mcp_apply_render_job(p_user_id uuid, p_organization_id uuid, p_preview_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $apply_render$
DECLARE
  v_payload jsonb;
  v_plan_id uuid;
  v_id uuid;
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_footage_take_preview(p_user_id, p_organization_id, p_preview_id, 'render.jobs.create');
  v_plan_id := NULLIF(v_payload->>'plan_id', '')::uuid;
  PERFORM public.mcp_render_job_plan_check(p_organization_id, v_plan_id);
  INSERT INTO public.agent_jobs (organization_id, kind, social_media_plan_id, title, spec, created_by, stage)
  VALUES (p_organization_id, 'render', v_plan_id, v_payload->>'title', v_payload->'spec', p_user_id, 'antri')
  RETURNING id INTO v_id;
  DELETE FROM public.mcp_footage_previews WHERE id = p_preview_id;
  RETURN jsonb_build_object('saved', true, 'job_id', v_id, 'status', 'queued');
END;
$apply_render$;

-- Recent jobs for Claude (MCP render.jobs.list).
CREATE OR REPLACE FUNCTION public.mcp_list_render_jobs(p_user_id uuid, p_organization_id uuid, p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $list_render$
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  RETURN jsonb_build_object('jobs', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'job_id', j.id, 'title', j.title, 'plan_id', j.social_media_plan_id, 'status', j.status,
      'stage', j.stage, 'progress', j.progress, 'attempts', j.attempts, 'error', j.error,
      'result', j.result, 'created_at', j.created_at, 'finished_at', j.finished_at
    ) ORDER BY j.created_at DESC)
    FROM (SELECT * FROM public.agent_jobs WHERE organization_id = p_organization_id
          ORDER BY created_at DESC LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)) j
  ), '[]'::jsonb));
END;
$list_render$;

REVOKE ALL ON FUNCTION public.agent_job_claim(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_job_claim(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.agent_job_progress(uuid, uuid, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_job_progress(uuid, uuid, uuid, integer, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.agent_job_finish(uuid, uuid, uuid, boolean, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_job_finish(uuid, uuid, uuid, boolean, jsonb, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.agent_job_upload_target(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_job_upload_target(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.agent_job_cancel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_job_cancel(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.agent_job_retry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_job_retry(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.mcp_render_job_plan_check(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_preview_render_job(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_render_job(uuid, uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_apply_render_job(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_apply_render_job(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_list_render_jobs(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_render_jobs(uuid, uuid, integer) TO service_role;
