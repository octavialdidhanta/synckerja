-- Synckerja Agent — step 6.7: a finished render logs which footage it used (what footage.usage.log
-- does by hand today), so "belum dipakai" filters, inbox → bank moves and reuse warnings stay right.
-- Only the job's own organization, only while the Agent still holds the job.

CREATE OR REPLACE FUNCTION public.agent_job_log_usage(p_token_id uuid, p_job_id uuid, p_claim_token uuid, p_shots jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $usage$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'render');
  v_job public.agent_jobs%ROWTYPE;
  v_shot jsonb;
  v_asset uuid;
  v_scene uuid;
  v_in numeric;
  v_out numeric;
  v_ref text;
  v_logged integer := 0;
  v_missing jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_job FROM public.agent_jobs
  WHERE id = p_job_id AND organization_id = v_org AND claim_token = p_claim_token AND status = 'running';
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF p_shots IS NULL OR jsonb_typeof(p_shots) <> 'array' OR jsonb_array_length(p_shots) > 80 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  -- The 8-character ContentID the video editor uses as external_ref.
  v_ref := CASE WHEN v_job.social_media_plan_id IS NULL THEN 'job-' || left(v_job.id::text, 8)
                ELSE left(v_job.social_media_plan_id::text, 8) END;

  FOR v_shot IN SELECT s FROM jsonb_array_elements(p_shots) s LOOP
    IF jsonb_typeof(v_shot->'file_key') <> 'string' OR jsonb_typeof(v_shot->'in') <> 'number' OR jsonb_typeof(v_shot->'out') <> 'number' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_in := (v_shot->>'in')::numeric;
    v_out := (v_shot->>'out')::numeric;
    SELECT id INTO v_asset FROM public.footage_assets
    WHERE organization_id = v_org AND file_key = v_shot->>'file_key' AND deleted_at IS NULL;
    IF v_asset IS NULL THEN
      v_missing := v_missing || to_jsonb(v_shot->>'file_key');
      CONTINUE;
    END IF;
    SELECT id INTO v_scene FROM public.footage_scenes
    WHERE asset_id = v_asset AND start_seconds <= v_in AND (end_seconds IS NULL OR end_seconds > v_in)
    ORDER BY start_seconds DESC LIMIT 1;
    -- A retried job does not log the same cut twice.
    IF NOT EXISTS (
      SELECT 1 FROM public.footage_usages u
      WHERE u.asset_id = v_asset AND u.external_ref = v_ref AND u.in_seconds = v_in AND u.out_seconds = v_out
    ) THEN
      INSERT INTO public.footage_usages (organization_id, asset_id, scene_id, in_seconds, out_seconds, external_ref, social_media_plan_id, title)
      VALUES (v_org, v_asset, v_scene, v_in, v_out, v_ref, v_job.social_media_plan_id, left(v_job.title, 200));
      v_logged := v_logged + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('logged', v_logged, 'missing', v_missing);
END;
$usage$;

REVOKE ALL ON FUNCTION public.agent_job_log_usage(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_job_log_usage(uuid, uuid, uuid, jsonb) TO service_role;
