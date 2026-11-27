-- New footage → which shot of an open shot list it is for.
-- Sources, strongest first: manual (a person, never overwritten), nama_file (<ContentID>_<ShotID> in the file name),
-- ai (the Agent's tagger, with the clip's subfolder narrowing it to one shot list).
-- An open shot list: not archived and its content not Prod Approved yet.

CREATE TABLE IF NOT EXISTS public.footage_shot_matches (
  asset_id uuid PRIMARY KEY REFERENCES public.footage_assets(id) ON DELETE CASCADE,
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shot_job_id uuid NOT NULL REFERENCES public.catalog_shot_jobs(id) ON DELETE CASCADE,
  shot_id text NOT NULL CHECK (char_length(shot_id) BETWEEN 1 AND 80),
  source text NOT NULL CHECK (source IN ('manual', 'nama_file', 'ai')),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS footage_shot_matches_job_idx ON public.footage_shot_matches (shot_job_id, shot_id);

ALTER TABLE public.footage_shot_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS footage_shot_matches_org_read ON public.footage_shot_matches;
CREATE POLICY footage_shot_matches_org_read ON public.footage_shot_matches
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()));
GRANT SELECT ON public.footage_shot_matches TO authenticated;

-- Open shot lists of an organization: what new footage can be for.
CREATE OR REPLACE FUNCTION public.footage_open_shot_jobs(p_org uuid)
RETURNS SETOF public.catalog_shot_jobs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $open_jobs$
  SELECT j.*
  FROM public.catalog_shot_jobs j
  LEFT JOIN public.social_media_plans p ON p.id = j.social_media_plan_id
  WHERE j.organization_id = p_org
    AND COALESCE((j.document->>'arsip')::boolean, false) = false
    AND COALESCE(p.production_approved, false) = false
  ORDER BY j.created_at DESC;
$open_jobs$;

REVOKE ALL ON FUNCTION public.footage_open_shot_jobs(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.footage_open_shot_jobs(uuid) TO service_role;

-- For the Agent's tagger: the newest open shot lists with a short line per shot.
CREATE OR REPLACE FUNCTION public.agent_open_shotlists(p_token_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $agent_shotlists$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'external_id', j.external_id,
      'judul', left(COALESCE(j.document->>'judul', ''), 200),
      'lokasi', left(COALESCE(j.document->>'lokasi', ''), 120),
      'shots', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s->>'id',
          'judul', left(COALESCE(s->>'judul', s->>'title', ''), 160),
          'action', left(COALESCE(s->>'action', s->>'prompt', ''), 260),
          'menu', left(COALESCE(s->>'menu', ''), 80)
        ) ORDER BY ord)
        FROM jsonb_array_elements(j.document->'shots') WITH ORDINALITY AS x(s, ord)
        WHERE COALESCE((s->>'done')::boolean, false) = false
      ), '[]'::jsonb)
    ))
    FROM (SELECT * FROM public.footage_open_shot_jobs(v_org) LIMIT 8) j
  ), '[]'::jsonb);
END;
$agent_shotlists$;

REVOKE ALL ON FUNCTION public.agent_open_shotlists(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_open_shotlists(uuid) TO service_role;

-- Link one tagged clip to a shot. The file name wins over the AI; a person's link is never replaced.
-- p_match: {external_id, shot_id, confidence, reason} from the tagger, or null.
CREATE OR REPLACE FUNCTION public.agent_footage_shot_match(p_token_id uuid, p_asset_id uuid, p_match jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $shot_match$
DECLARE
  v_org uuid := public.agent_token_org(p_token_id, 'catalog');
  v_key text;
  v_base text;
  v_folder text;
  v_m text[];
  v_job public.catalog_shot_jobs%ROWTYPE;
  v_shot text;
  v_source text;
  v_conf numeric;
  v_reason text;
BEGIN
  SELECT file_key INTO v_key FROM public.footage_assets
  WHERE id = p_asset_id AND organization_id = v_org AND deleted_at IS NULL;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.footage_shot_matches WHERE asset_id = p_asset_id AND source = 'manual') THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'manual');
  END IF;

  v_base := regexp_replace(v_key, '^.*/', '');
  -- INBOX/<folder>/<file>: a folder named after a ContentID keeps the AI inside that shot list.
  v_folder := CASE WHEN v_key ~* '^INBOX/[^/]+/[^/]+$' THEN lower(split_part(v_key, '/', 2)) END;

  -- 1. File name: <ContentID>_<ShotID>..., e.g. 7f2c78aa_S05.mp4 or 7f2c78aa-s05 ambil 2.mov
  v_m := regexp_match(v_base, '^([0-9a-f]{8})[ _-]+([a-z]{1,3}[0-9]{1,3})(?![0-9])', 'i');
  IF v_m IS NOT NULL THEN
    SELECT * INTO v_job FROM public.footage_open_shot_jobs(v_org) j WHERE j.external_id = lower(v_m[1]);
    IF v_job.id IS NOT NULL THEN
      SELECT s->>'id' INTO v_shot FROM jsonb_array_elements(v_job.document->'shots') s
      WHERE upper(s->>'id') = upper(v_m[2]) LIMIT 1;
      IF v_shot IS NOT NULL THEN
        v_source := 'nama_file';
        v_conf := 1;
        v_reason := 'nama file';
      END IF;
    END IF;
  END IF;

  -- 2. The tagger's choice.
  IF v_source IS NULL AND p_match IS NOT NULL AND jsonb_typeof(p_match) = 'object'
     AND jsonb_typeof(p_match->'external_id') = 'string' AND jsonb_typeof(p_match->'shot_id') = 'string' THEN
    v_conf := CASE WHEN jsonb_typeof(p_match->'confidence') = 'number'
                   THEN least(greatest((p_match->>'confidence')::numeric, 0), 1) END;
    IF COALESCE(v_conf, 0) >= 0.6 THEN
      SELECT * INTO v_job FROM public.footage_open_shot_jobs(v_org) j WHERE j.external_id = lower(p_match->>'external_id');
      IF v_job.id IS NOT NULL AND (v_folder IS NULL OR v_folder = v_job.external_id
          OR NOT EXISTS (SELECT 1 FROM public.footage_open_shot_jobs(v_org) f WHERE f.external_id = v_folder)) THEN
        SELECT s->>'id' INTO v_shot FROM jsonb_array_elements(v_job.document->'shots') s
        WHERE upper(s->>'id') = upper(p_match->>'shot_id') LIMIT 1;
        IF v_shot IS NOT NULL THEN
          v_source := 'ai';
          v_reason := left(NULLIF(btrim(COALESCE(p_match->>'reason', '')), ''), 300);
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_source IS NULL THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  INSERT INTO public.footage_shot_matches (asset_id, organization_id, shot_job_id, shot_id, source, confidence, reason)
  VALUES (p_asset_id, v_org, v_job.id, v_shot, v_source, v_conf, v_reason)
  ON CONFLICT (asset_id) DO UPDATE SET
    shot_job_id = EXCLUDED.shot_job_id, shot_id = EXCLUDED.shot_id, source = EXCLUDED.source,
    confidence = EXCLUDED.confidence, reason = EXCLUDED.reason, updated_at = now()
  WHERE footage_shot_matches.source <> 'manual';

  RETURN jsonb_build_object('matched', true, 'external_id', v_job.external_id, 'shot_id', v_shot, 'source', v_source);
END;
$shot_match$;

REVOKE ALL ON FUNCTION public.agent_footage_shot_match(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_footage_shot_match(uuid, uuid, jsonb) TO service_role;

-- catalog.shotlist.get also says, per shot, which footage is in for it (footage_status).
CREATE OR REPLACE FUNCTION public.mcp_get_catalog_shot_job(p_user_id uuid, p_organization_id uuid, p_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $get_shot_job$
DECLARE
  v_id text := NULLIF(lower(btrim(COALESCE(p_id, ''))), '');
  v_job public.catalog_shot_jobs%ROWTYPE;
  v_shots jsonb;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_job
  FROM public.catalog_shot_jobs j
  WHERE j.organization_id = p_organization_id
    AND j.external_id = v_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s->>'id',
    'footage', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'asset_id', a.id, 'file_key', a.file_key, 'storage_status', a.storage_status,
        'tag_status', a.tag_status, 'source', m.source
      ) ORDER BY a.created_at)
      FROM public.footage_shot_matches m
      JOIN public.footage_assets a ON a.id = m.asset_id AND a.deleted_at IS NULL
      WHERE m.shot_job_id = v_job.id AND upper(m.shot_id) = upper(s->>'id')
    ), '[]'::jsonb)
  ) ORDER BY ord), '[]'::jsonb)
  INTO v_shots
  FROM jsonb_array_elements(v_job.document->'shots') WITH ORDINALITY AS x(s, ord);

  RETURN v_job.document || jsonb_build_object('footage_status', jsonb_build_object(
    'total', jsonb_array_length(v_shots),
    'filled', (SELECT count(*) FROM jsonb_array_elements(v_shots) e WHERE jsonb_array_length(e->'footage') > 0),
    'shots', v_shots
  ));
END;
$get_shot_job$;
