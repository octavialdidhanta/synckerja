-- Shot list tied to its content, archived on production approval; footage counted only for approved content.
--
-- Owner rules (27 Nov 2026):
-- 1. A shot list belongs to one content plan (catalog_shot_jobs.social_media_plan_id). A new shot list must name
--    an existing plan through its ContentID (external_id = the plan id or its first 8 characters).
-- 2. Prod Approved on (social_media_plans.production_approved) archives the plan's shot list; switching it off
--    takes the shot list out of the archive again.
-- 3. "Used" / "used N times" counts approved contents only, from the approved version of the video. Every render
--    is still recorded, as history, in footage_render_usages; footage_usages (what every usage count, the "unused"
--    filter and the inbox→bank move read) only holds usages of approved content, plus manual logs.
--    Switching Prod Approved off removes that content's counted usages again.
-- 4. Content approved before this migration gets the same treatment (backfill at the end).
-- A scene used twice in one video is refused by the MCP render checks (scene_repeated), so one content counts a
-- scene once (usage counts are already per content: count(DISTINCT external_ref)).

-- ---------------------------------------------------------------------------
-- 1. Shot list ↔ content plan
-- ---------------------------------------------------------------------------
ALTER TABLE public.catalog_shot_jobs
  ADD COLUMN IF NOT EXISTS social_media_plan_id uuid REFERENCES public.social_media_plans (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.catalog_shot_jobs.social_media_plan_id IS
  'The content plan this shot list belongs to (one shot list per content). Resolved from external_id (ContentID).';

CREATE UNIQUE INDEX IF NOT EXISTS catalog_shot_jobs_org_plan_uidx
  ON public.catalog_shot_jobs (organization_id, social_media_plan_id)
  WHERE social_media_plan_id IS NOT NULL;

-- The plan a ContentID names inside one organization: the full plan id, or its first 8 characters when exactly
-- one plan starts with them. NULL when nothing (or more than one plan) matches.
CREATE OR REPLACE FUNCTION public.catalog_shot_job_plan_for(p_organization_id uuid, p_external_id text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $plan_for$
DECLARE
  v_ids uuid[];
BEGIN
  IF p_external_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_external_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT array_agg(p.id) INTO v_ids FROM public.social_media_plans p
    WHERE p.organization_id = p_organization_id AND p.id = p_external_id::uuid;
  ELSIF p_external_id ~ '^[0-9a-f]{8}$' THEN
    SELECT array_agg(p.id) INTO v_ids FROM public.social_media_plans p
    WHERE p.organization_id = p_organization_id AND left(p.id::text, 8) = p_external_id;
  END IF;
  RETURN CASE WHEN cardinality(v_ids) = 1 THEN v_ids[1] ELSE NULL END;
END;
$plan_for$;

REVOKE ALL ON FUNCTION public.catalog_shot_job_plan_for(uuid, text) FROM PUBLIC, anon, authenticated;

-- Every writer (MCP catalog.shotlist.upsert, Office shot list edits) goes through this trigger:
-- link the plan, refuse a new shot list without one, and keep an approved content's shot list archived.
CREATE OR REPLACE FUNCTION public.catalog_shot_jobs_link_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $link_plan$
DECLARE
  v_approved boolean;
BEGIN
  IF NEW.social_media_plan_id IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.external_id IS DISTINCT FROM OLD.external_id) THEN
    NEW.social_media_plan_id := public.catalog_shot_job_plan_for(NEW.organization_id, NEW.external_id);
  END IF;
  IF TG_OP = 'INSERT' AND NEW.social_media_plan_id IS NULL THEN
    RAISE EXCEPTION 'shotlist_plan_not_found'
      USING ERRCODE = 'P0002',
            DETAIL = 'external_id must be the ContentID of an existing content plan (its id or first 8 characters).';
  END IF;
  IF NEW.social_media_plan_id IS NOT NULL THEN
    SELECT p.production_approved INTO v_approved
    FROM public.social_media_plans p
    WHERE p.id = NEW.social_media_plan_id AND p.organization_id = NEW.organization_id;
    IF v_approved IS TRUE AND (NEW.document->'arsip') IS DISTINCT FROM 'true'::jsonb THEN
      NEW.document := jsonb_set(NEW.document, '{arsip}', 'true'::jsonb, true);
    END IF;
  END IF;
  RETURN NEW;
END;
$link_plan$;

DROP TRIGGER IF EXISTS catalog_shot_jobs_link_plan ON public.catalog_shot_jobs;
CREATE TRIGGER catalog_shot_jobs_link_plan
  BEFORE INSERT OR UPDATE ON public.catalog_shot_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_shot_jobs_link_plan();

-- ---------------------------------------------------------------------------
-- 2. Render history (every render), separate from counted usage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.footage_render_usages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  agent_job_id uuid REFERENCES public.agent_jobs (id) ON DELETE SET NULL,
  asset_id uuid NOT NULL,
  scene_id uuid,
  in_seconds numeric,
  out_seconds numeric,
  external_ref text,
  social_media_plan_id uuid REFERENCES public.social_media_plans (id) ON DELETE SET NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT footage_render_usages_asset_org_fkey
    FOREIGN KEY (asset_id, organization_id) REFERENCES public.footage_assets (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT footage_render_usages_scene_asset_fkey
    FOREIGN KEY (scene_id, asset_id) REFERENCES public.footage_scenes (id, asset_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.footage_render_usages IS
  'Every cut a render used (history, including drafts and unapproved content). Not counted as footage usage: '
  'footage_usages gets the cuts of the approved version when Prod Approved is switched on.';

CREATE INDEX IF NOT EXISTS footage_render_usages_org_asset_idx ON public.footage_render_usages (organization_id, asset_id);
CREATE INDEX IF NOT EXISTS footage_render_usages_job_idx ON public.footage_render_usages (agent_job_id);
CREATE INDEX IF NOT EXISTS footage_render_usages_plan_idx ON public.footage_render_usages (social_media_plan_id);

ALTER TABLE public.footage_render_usages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS footage_render_usages_org_read ON public.footage_render_usages;
CREATE POLICY footage_render_usages_org_read ON public.footage_render_usages
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));
REVOKE ALL ON TABLE public.footage_render_usages FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.footage_render_usages TO authenticated;
GRANT ALL ON TABLE public.footage_render_usages TO service_role;

-- Counted usage rows written by the approval (removed again when approval is switched off).
ALTER TABLE public.footage_usages ADD COLUMN IF NOT EXISTS approved_from_job uuid;
COMMENT ON COLUMN public.footage_usages.approved_from_job IS
  'Render job whose cuts were counted when the content got Prod Approved. NULL for manual / legacy logs.';

-- The Agent's usage log now records history only (same input, same result shape).
CREATE OR REPLACE FUNCTION public.agent_job_log_usage(p_token_id uuid, p_job_id uuid, p_claim_token uuid, p_shots jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $log_usage$
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
      SELECT 1 FROM public.footage_render_usages u
      WHERE u.agent_job_id = v_job.id AND u.asset_id = v_asset AND u.in_seconds = v_in AND u.out_seconds = v_out
    ) THEN
      INSERT INTO public.footage_render_usages
        (organization_id, agent_job_id, asset_id, scene_id, in_seconds, out_seconds, external_ref, social_media_plan_id, title)
      VALUES (v_org, v_job.id, v_asset, v_scene, v_in, v_out, v_ref, v_job.social_media_plan_id, left(v_job.title, 200));
      v_logged := v_logged + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('logged', v_logged, 'missing', v_missing);
END;
$log_usage$;

REVOKE ALL ON FUNCTION public.agent_job_log_usage(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_job_log_usage(uuid, uuid, uuid, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Prod Approved → archive the shot list, count the approved version's footage
-- ---------------------------------------------------------------------------
-- The clip a render spec names: its file_key, or (after the inbox→bank move) the one live clip with that file name.
CREATE OR REPLACE FUNCTION public.footage_asset_for_key(p_organization_id uuid, p_file_key text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $asset_for_key$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(a.id) INTO v_ids FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id AND a.file_key = p_file_key AND a.deleted_at IS NULL;
  IF cardinality(v_ids) = 1 THEN
    RETURN v_ids[1];
  END IF;
  SELECT array_agg(a.id) INTO v_ids FROM public.footage_assets a
  WHERE a.organization_id = p_organization_id AND a.deleted_at IS NULL
    AND regexp_replace(a.file_key, '^.*/', '') = regexp_replace(p_file_key, '^.*/', '');
  RETURN CASE WHEN cardinality(v_ids) = 1 THEN v_ids[1] ELSE NULL END;
END;
$asset_for_key$;

REVOKE ALL ON FUNCTION public.footage_asset_for_key(uuid, text) FROM PUBLIC, anon, authenticated;

-- The approved version: the newest finished full render of the plan that reached the plan (version_no),
-- else the newest finished full render. Returns the counted cuts.
CREATE OR REPLACE FUNCTION public.footage_sync_plan_usage(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $sync_usage$
DECLARE
  v_plan record;
  v_job public.agent_jobs%ROWTYPE;
  v_shot jsonb;
  v_asset uuid;
  v_scene uuid;
  v_in numeric;
  v_out numeric;
  v_removed integer := 0;
  v_counted integer := 0;
  v_n integer;
  v_archived integer := 0;
BEGIN
  SELECT id, organization_id, production_approved INTO v_plan
  FROM public.social_media_plans WHERE id = p_plan_id;
  IF v_plan.id IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.footage_usages
  WHERE organization_id = v_plan.organization_id
    AND social_media_plan_id = v_plan.id
    AND approved_from_job IS NOT NULL;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  IF v_plan.production_approved IS TRUE THEN
    SELECT * INTO v_job FROM public.agent_jobs j
    WHERE j.organization_id = v_plan.organization_id
      AND j.social_media_plan_id = v_plan.id
      AND j.kind = 'render'
      AND j.status = 'done'
      AND NOT (j.spec ? 'stills')
    ORDER BY (j.result ? 'version_no' AND j.result->>'version_no' IS NOT NULL) DESC, j.finished_at DESC NULLS LAST
    LIMIT 1;

    IF v_job.id IS NOT NULL AND jsonb_typeof(v_job.spec->'shots') = 'array' THEN
      FOR v_shot IN SELECT s FROM jsonb_array_elements(v_job.spec->'shots') s LOOP
        CONTINUE WHEN COALESCE(jsonb_typeof(v_shot->'file_key'), '') <> 'string'
          OR COALESCE(jsonb_typeof(v_shot->'in'), '') <> 'number'
          OR COALESCE(jsonb_typeof(v_shot->'out'), '') <> 'number';
        v_in := (v_shot->>'in')::numeric;
        v_out := (v_shot->>'out')::numeric;
        -- Used inbox footage is moved into the bank after the render, so the spec may still name INBOX/<file>:
        -- fall back to the one clip with the same file name.
        v_asset := public.footage_asset_for_key(v_plan.organization_id, v_shot->>'file_key');
        CONTINUE WHEN v_asset IS NULL;
        v_scene := NULL;
        SELECT id INTO v_scene FROM public.footage_scenes
        WHERE asset_id = v_asset AND start_seconds <= v_in AND (end_seconds IS NULL OR end_seconds > v_in)
        ORDER BY start_seconds DESC LIMIT 1;
        INSERT INTO public.footage_usages
          (organization_id, asset_id, scene_id, in_seconds, out_seconds, external_ref, social_media_plan_id, title, approved_from_job)
        VALUES (v_plan.organization_id, v_asset, v_scene, v_in, v_out, left(v_plan.id::text, 8), v_plan.id,
                left(v_job.title, 200), v_job.id)
        ON CONFLICT (organization_id, asset_id, external_ref, in_seconds, out_seconds) DO NOTHING;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_counted := v_counted + v_n;
      END LOOP;
    END IF;
  END IF;

  UPDATE public.catalog_shot_jobs j
  SET document = jsonb_set(j.document, '{arsip}', to_jsonb(v_plan.production_approved IS TRUE), true)
  WHERE j.organization_id = v_plan.organization_id
    AND j.social_media_plan_id = v_plan.id
    AND (j.document->'arsip') IS DISTINCT FROM to_jsonb(v_plan.production_approved IS TRUE);
  GET DIAGNOSTICS v_archived = ROW_COUNT;

  RETURN jsonb_build_object(
    'plan_id', v_plan.id,
    'approved', v_plan.production_approved IS TRUE,
    'job_id', v_job.id,
    'removed', v_removed,
    'counted', v_counted,
    'shotlists_changed', v_archived
  );
END;
$sync_usage$;

REVOKE ALL ON FUNCTION public.footage_sync_plan_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.footage_sync_plan_usage(uuid) TO service_role;

-- Never blocks the approval toggle itself: a failure is a warning in the database log.
CREATE OR REPLACE FUNCTION public.social_media_plans_production_approved_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $approved_sync$
BEGIN
  BEGIN
    PERFORM public.footage_sync_plan_usage(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'footage_sync_plan_usage(%) failed: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$approved_sync$;

DROP TRIGGER IF EXISTS social_media_plans_production_approved_sync ON public.social_media_plans;
CREATE TRIGGER social_media_plans_production_approved_sync
  AFTER UPDATE OF production_approved ON public.social_media_plans
  FOR EACH ROW
  WHEN (OLD.production_approved IS DISTINCT FROM NEW.production_approved)
  EXECUTE FUNCTION public.social_media_plans_production_approved_sync();

-- ---------------------------------------------------------------------------
-- 4. Backfill
-- ---------------------------------------------------------------------------
-- 4a. Link existing shot lists (the trigger resolves the plan on update; NULL stays NULL for a shot list
--     whose ContentID names no plan).
UPDATE public.catalog_shot_jobs j
SET social_media_plan_id = public.catalog_shot_job_plan_for(j.organization_id, j.external_id)
WHERE j.social_media_plan_id IS NULL;

-- 4b. Move render / test usages into history: Agent renders (plan or job-xxxx ref), smoke tests, and legacy logs
--     whose ContentID names content that is not Prod Approved. Manual logs of approved or unknown content stay.
CREATE TEMP TABLE _usage_to_history ON COMMIT DROP AS
SELECT u.*
FROM public.footage_usages u
LEFT JOIN LATERAL (
  SELECT p.id, p.production_approved
  FROM public.social_media_plans p
  WHERE p.organization_id = u.organization_id
    AND p.id = COALESCE(u.social_media_plan_id, public.catalog_shot_job_plan_for(u.organization_id, u.external_ref))
) plan ON true
WHERE u.approved_from_job IS NULL
  AND (
    u.social_media_plan_id IS NOT NULL
    OR u.external_ref LIKE 'job-%'
    OR u.external_ref ILIKE 'smoke%'
    OR u.title ILIKE 'smoke%'
    OR (plan.id IS NOT NULL AND plan.production_approved IS NOT TRUE)
  );

INSERT INTO public.footage_render_usages
  (organization_id, agent_job_id, asset_id, scene_id, in_seconds, out_seconds, external_ref, social_media_plan_id, title, created_at)
SELECT h.organization_id,
       (SELECT j.id FROM public.agent_jobs j
        WHERE j.organization_id = h.organization_id
          AND left(j.title, 200) = h.title
          AND (j.social_media_plan_id IS NOT DISTINCT FROM h.social_media_plan_id
               OR h.external_ref = 'job-' || left(j.id::text, 8))
        ORDER BY j.created_at LIMIT 1),
       h.asset_id, h.scene_id, h.in_seconds, h.out_seconds, h.external_ref, h.social_media_plan_id, h.title, h.created_at
FROM _usage_to_history h;

DELETE FROM public.footage_usages u USING _usage_to_history h WHERE u.id = h.id;

-- 4c. Content already Prod Approved: count its approved version and archive its shot list.
DO $backfill$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT p.id FROM public.social_media_plans p
    WHERE p.production_approved IS TRUE
      AND (
        EXISTS (SELECT 1 FROM public.agent_jobs j WHERE j.social_media_plan_id = p.id AND j.status = 'done')
        OR EXISTS (SELECT 1 FROM public.catalog_shot_jobs s WHERE s.social_media_plan_id = p.id)
      )
  LOOP
    PERFORM public.footage_sync_plan_usage(v_id);
  END LOOP;
END;
$backfill$;

-- ---------------------------------------------------------------------------
-- 5. catalog.shotlist.upsert.preview refuses a new shot list without its content plan (before the yes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mcp_preview_catalog_shotlist_upsert(
  p_user_id uuid,
  p_organization_id uuid,
  p_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $preview_job$
DECLARE
  v_payload jsonb;
  v_existing jsonb;
  v_after jsonb;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  v_payload := public.mcp_catalog_normalize_shot_job(p_input);
  v_after := v_payload->'document';

  DELETE FROM public.mcp_footage_previews
  WHERE organization_id = p_organization_id
    AND expires_at <= now();

  SELECT j.document INTO v_existing
  FROM public.catalog_shot_jobs j
  WHERE j.organization_id = p_organization_id
    AND j.external_id = v_payload->>'external_id';

  -- A new shot list belongs to one content plan: its external_id is that plan's ContentID.
  IF v_existing IS NULL
     AND public.catalog_shot_job_plan_for(p_organization_id, v_payload->>'external_id') IS NULL THEN
    RAISE EXCEPTION 'shotlist_plan_not_found'
      USING ERRCODE = 'P0002',
            DETAIL = 'external_id must be the ContentID of an existing content plan (its id or first 8 characters).';
  END IF;

  INSERT INTO public.mcp_footage_previews (organization_id, user_id, tool, payload, expires_at)
  VALUES (
    p_organization_id,
    p_user_id,
    'catalog.shotlist.upsert',
    v_payload || jsonb_build_object('before_md5', md5(COALESCE(v_existing::text, ''))),
    now() + interval '15 minutes'
  )
  RETURNING id, expires_at INTO v_id, v_expires;

  RETURN jsonb_build_object(
    'external_id', v_payload->>'external_id',
    'is_new', v_existing IS NULL,
    'before', CASE WHEN v_existing IS NULL THEN NULL ELSE jsonb_build_object(
      'judul', v_existing->>'judul',
      'arsip', CASE WHEN jsonb_typeof(v_existing->'arsip') = 'boolean' THEN (v_existing->'arsip')::boolean ELSE false END,
      'shots', public.mcp_catalog_list_len(v_existing->'shots')
    ) END,
    'after', jsonb_build_object(
      'judul', v_after->>'judul',
      'arsip', CASE WHEN jsonb_typeof(v_after->'arsip') = 'boolean' THEN (v_after->'arsip')::boolean ELSE false END,
      'shots', public.mcp_catalog_list_len(v_after->'shots')
    ),
    'shots_diff', public.mcp_catalog_shot_diff(v_existing, v_after),
    'preview_id', v_id,
    'expires_at', v_expires
  );
END;
$preview_job$;
