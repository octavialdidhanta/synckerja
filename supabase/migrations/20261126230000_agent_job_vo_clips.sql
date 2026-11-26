-- The Agent fetches the VO clips of a render job's content plan itself (newest clip per storyboard row), so nobody
-- has to download them into Produksi/<id>/vo by hand. Same claim check as the other agent_job_* functions.

CREATE OR REPLACE FUNCTION public.agent_job_vo_clips(p_token_id uuid, p_job_id uuid, p_claim_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $vo_clips$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'render');
  v_job public.agent_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.agent_jobs
  WHERE id = p_job_id AND organization_id = v_org AND claim_token = p_claim_token AND status = 'running';
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_job.social_media_plan_id IS NULL THEN
    RETURN jsonb_build_object('clips', '[]'::jsonb, 'reason', 'no_plan');
  END IF;
  RETURN jsonb_build_object('clips', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'clip_id', c.id, 'row_index', c.row_index, 'file_name', c.file_name, 'storage_path', c.storage_path
    ) ORDER BY c.row_index)
    FROM (
      SELECT DISTINCT ON (clip.row_index) clip.id, clip.row_index, clip.file_name, clip.storage_path
      FROM public.brief_voice_clips clip
      WHERE clip.organization_id = v_org
        AND clip.social_media_plan_id = v_job.social_media_plan_id
        AND clip.kind = 'vo'
        AND clip.storage_path IS NOT NULL
      ORDER BY clip.row_index, clip.created_at DESC
    ) c
  ), '[]'::jsonb));
END;
$vo_clips$;

REVOKE ALL ON FUNCTION public.agent_job_vo_clips(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_job_vo_clips(uuid, uuid, uuid) TO service_role;
