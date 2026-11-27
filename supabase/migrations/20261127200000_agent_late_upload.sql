-- Upload a finished render later instead of rendering it again.
-- A render whose brief was not approved yet is kept on the laptop (result.upload_skipped = 'not_approved').
-- Once the brief is approved in Office, the laptop that rendered it uploads that same file to the plan.
-- Only the newest such render per plan, and only when no render of that plan was uploaded after it.
-- State lives in result.late_upload: {status: claimed|done|failed, claim, at, attempts, version_no?, error?}.

CREATE OR REPLACE FUNCTION public.agent_late_upload_eligible(p_job public.agent_jobs)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $eligible$
  SELECT p_job.kind = 'render'
    AND p_job.status = 'done'
    AND p_job.social_media_plan_id IS NOT NULL
    -- Older renders (before this feature) stay on the laptop: uploading them now would surprise the user.
    -- 7f2c78aa (27 Nov 18:41 WIB) is the render that showed the gap and is the first one to go up.
    AND p_job.created_at >= timestamptz '2026-11-27 11:00:00+00'
    AND p_job.result->>'upload_skipped' = 'not_approved'
    AND COALESCE(p_job.result->>'output_file', '') <> ''
    AND COALESCE(p_job.result->'late_upload'->>'status', '') NOT IN ('done', 'abandoned')
    AND COALESCE((p_job.result->'late_upload'->>'attempts')::int, 0) < 3
    AND (
      p_job.result->'late_upload' IS NULL
      OR p_job.result->'late_upload'->>'status' = 'failed'
      OR (p_job.result->'late_upload'->>'status' = 'claimed'
          AND (p_job.result->'late_upload'->>'at')::timestamptz < now() - interval '30 minutes')
    )
    AND EXISTS (
      SELECT 1 FROM public.social_media_plans p
      WHERE p.id = p_job.social_media_plan_id
        AND p.organization_id = p_job.organization_id
        AND p.approved IS TRUE
        AND COALESCE(p.production_approved, false) = false
    )
    -- Never upload an older render over a newer one of the same plan.
    AND NOT EXISTS (
      SELECT 1 FROM public.agent_jobs n
      WHERE n.organization_id = p_job.organization_id
        AND n.social_media_plan_id = p_job.social_media_plan_id
        AND n.kind = 'render'
        AND n.id <> p_job.id
        AND n.created_at > p_job.created_at
        AND n.status IN ('queued', 'running', 'done')
        AND jsonb_typeof(n.spec->'stills') IS DISTINCT FROM 'array'
    );
$eligible$;

REVOKE ALL ON FUNCTION public.agent_late_upload_eligible(public.agent_jobs) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_late_upload_eligible(public.agent_jobs) TO service_role;

-- Renders this laptop can upload now (the file is in its own production folder).
CREATE OR REPLACE FUNCTION public.agent_late_uploads(p_token_id uuid, p_device_key uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $late_list$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'render');
  v_device uuid;
BEGIN
  SELECT id INTO v_device FROM public.agent_devices WHERE device_key = p_device_key;
  IF v_device IS NULL THEN
    RETURN jsonb_build_object('jobs', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object('jobs', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'job_id', j.id,
      'title', j.title,
      'plan_id', j.social_media_plan_id,
      'output_file', j.result->>'output_file'
    ) ORDER BY j.created_at)
    FROM public.agent_jobs j
    WHERE j.organization_id = v_org
      AND j.claimed_by_device = v_device
      AND public.agent_late_upload_eligible(j)
  ), '[]'::jsonb));
END;
$late_list$;

REVOKE ALL ON FUNCTION public.agent_late_uploads(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_late_uploads(uuid, uuid) TO service_role;

-- Claim one late upload: returns the plan and the person who confirmed the render (the upload is in their name).
CREATE OR REPLACE FUNCTION public.agent_late_upload_claim(p_token_id uuid, p_device_key uuid, p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $late_claim$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'render');
  v_device uuid;
  v_job public.agent_jobs%ROWTYPE;
  v_claim uuid := gen_random_uuid();
  v_attempts int;
BEGIN
  SELECT id INTO v_device FROM public.agent_devices WHERE device_key = p_device_key;
  SELECT * INTO v_job FROM public.agent_jobs
  WHERE id = p_job_id AND organization_id = v_org AND claimed_by_device = v_device
  FOR UPDATE;
  IF v_job.id IS NULL OR v_device IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.agent_late_upload_eligible(v_job) THEN
    RETURN jsonb_build_object('claim', NULL, 'reason', 'not_eligible');
  END IF;
  v_attempts := COALESCE((v_job.result->'late_upload'->>'attempts')::int, 0) + 1;
  UPDATE public.agent_jobs SET
    result = result || jsonb_build_object('late_upload', jsonb_build_object(
      'status', 'claimed', 'claim', v_claim, 'at', now(), 'attempts', v_attempts
    )),
    updated_at = now()
  WHERE id = v_job.id;
  RETURN jsonb_build_object(
    'claim', v_claim,
    'plan_id', v_job.social_media_plan_id,
    'user_id', v_job.created_by
  );
END;
$late_claim$;

REVOKE ALL ON FUNCTION public.agent_late_upload_claim(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_late_upload_claim(uuid, uuid, uuid) TO service_role;

-- Record the outcome. A missing file is final (abandoned); other failures are tried again, at most 3 times.
CREATE OR REPLACE FUNCTION public.agent_late_upload_finish(
  p_token_id uuid, p_job_id uuid, p_claim uuid, p_ok boolean, p_version_no integer, p_error text, p_final boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $late_finish$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'render');
  v_job public.agent_jobs%ROWTYPE;
  v_late jsonb;
BEGIN
  SELECT * INTO v_job FROM public.agent_jobs
  WHERE id = p_job_id AND organization_id = v_org
  FOR UPDATE;
  IF v_job.id IS NULL OR v_job.result->'late_upload'->>'claim' IS DISTINCT FROM p_claim::text THEN
    RETURN jsonb_build_object('accepted', false);
  END IF;
  v_late := (v_job.result->'late_upload') - 'claim' || jsonb_build_object(
    'status', CASE WHEN COALESCE(p_ok, false) THEN 'done' WHEN COALESCE(p_final, false) THEN 'abandoned' ELSE 'failed' END,
    'at', now()
  );
  IF COALESCE(p_ok, false) THEN
    v_late := v_late || jsonb_build_object('version_no', p_version_no);
  ELSE
    v_late := v_late || jsonb_build_object('error', left(COALESCE(p_error, 'gagal'), 500));
  END IF;
  UPDATE public.agent_jobs SET
    result = result || jsonb_build_object('late_upload', v_late),
    updated_at = now()
  WHERE id = v_job.id;
  RETURN jsonb_build_object('accepted', true, 'status', v_late->>'status');
END;
$late_finish$;

REVOKE ALL ON FUNCTION public.agent_late_upload_finish(uuid, uuid, uuid, boolean, integer, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_late_upload_finish(uuid, uuid, uuid, boolean, integer, text, boolean) TO service_role;
