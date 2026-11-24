-- A render job whose failure will happen again on every attempt (bad spec, missing file, a shot past the end of its
-- clip) no longer burns its retries: the Agent sends final = true and the job goes straight to failed.
-- Older Agents do not send it, so they keep the old behaviour (retry until max_attempts).
-- The 7-argument function stays as a wrapper, so the edge function and this migration can deploy in either order.

CREATE OR REPLACE FUNCTION public.agent_job_finish(
  p_token_id uuid, p_job_id uuid, p_claim_token uuid, p_ok boolean, p_result jsonb, p_error text, p_log text,
  p_final boolean
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

  v_retry := NOT COALESCE(p_ok, false) AND NOT COALESCE(p_final, false) AND v_job.attempts < v_job.max_attempts;
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

REVOKE ALL ON FUNCTION public.agent_job_finish(uuid, uuid, uuid, boolean, jsonb, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_job_finish(uuid, uuid, uuid, boolean, jsonb, text, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.agent_job_finish(
  p_token_id uuid, p_job_id uuid, p_claim_token uuid, p_ok boolean, p_result jsonb, p_error text, p_log text
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $wrap$
  SELECT public.agent_job_finish(p_token_id, p_job_id, p_claim_token, p_ok, p_result, p_error, p_log, false);
$wrap$;

REVOKE ALL ON FUNCTION public.agent_job_finish(uuid, uuid, uuid, boolean, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_job_finish(uuid, uuid, uuid, boolean, jsonb, text, text) TO service_role;
