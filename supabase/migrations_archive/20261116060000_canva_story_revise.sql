-- Story Request Revision → Canva edits the existing design from review comments.

ALTER TABLE public.canva_story_runs
  ADD COLUMN IF NOT EXISTS revision_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revision_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_after_export boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.canva_story_status_for_plans(uuid[]);

CREATE FUNCTION public.canva_story_status_for_plans(p_plan_ids uuid[])
RETURNS TABLE (
  social_media_plan_id uuid,
  status text,
  design_url text,
  error text,
  images_ready boolean,
  refresh_requested boolean,
  revision_requested boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.social_media_plan_id,
         r.status,
         r.design_url,
         left(COALESCE(r.error, ''), 160),
         r.images_ready,
         r.refresh_requested,
         r.revision_requested
  FROM public.canva_story_runs r
  INNER JOIN public.social_media_plans p ON p.id = r.social_media_plan_id
  WHERE r.social_media_plan_id = ANY(COALESCE(p_plan_ids, ARRAY[]::uuid[]))
    AND p.organization_id IN (SELECT public.user_organization_ids());
$$;

REVOKE ALL ON FUNCTION public.canva_story_status_for_plans(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_story_status_for_plans(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.canva_story_revise(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_plan_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.social_media_plans p
    WHERE p.id = p_plan_id
      AND p.organization_id IN (SELECT public.user_organization_ids())
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.link_comments c
    WHERE c.social_media_plan_id = p_plan_id
      AND c.canva_revision_applied_at IS NULL
      AND btrim(coalesce(c.comment_text, '')) <> ''
  ) THEN
    RAISE EXCEPTION 'story_comments_missing' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.canva_story_runs
  SET revision_requested = true,
      revision_attempts = 0,
      error = NULL,
      updated_at = now()
  WHERE social_media_plan_id = p_plan_id
    AND status = 'succeeded'
    AND design_id IS NOT NULL
    AND btrim(design_id) <> '';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'canva_design_missing' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.canva_story_post(p_plan_id, 'resume');
END;
$$;

REVOKE ALL ON FUNCTION public.canva_story_revise(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_story_revise(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.canva_story_resume()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan uuid;
  v_count integer := 0;
BEGIN
  FOR v_plan IN
    SELECT r.social_media_plan_id
    FROM public.canva_story_runs r
    WHERE (
      r.status IN ('queued', 'running')
      AND r.updated_at < now() - interval '40 seconds'
    ) OR (
      r.status = 'succeeded'
      AND r.revision_requested = true
      AND r.design_id IS NOT NULL
      AND r.revision_attempts < 3
      AND r.updated_at < now() - interval '50 seconds'
    ) OR (
      r.status = 'succeeded'
      AND r.revision_requested = false
      AND r.images_ready = false
      AND r.refresh_requested = true
      AND r.updated_at < now() - interval '40 seconds'
    )
    ORDER BY r.updated_at
    LIMIT 3
  LOOP
    PERFORM public.canva_story_post(v_plan, 'resume');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.canva_story_resume() FROM PUBLIC, anon, authenticated;

-- Reset revision flags when a Story Canva run is restarted.
CREATE OR REPLACE FUNCTION public.canva_story_start(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_id uuid;
BEGIN
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.organization_id
  INTO v_org
  FROM public.social_media_plans p
  JOIN public.content_types ct ON ct.id = p.content_type_id
  JOIN public.employees e
    ON e.id = p.pic_id
   AND e.organization_id = p.organization_id
   AND e.is_ai IS TRUE
  WHERE p.id = p_plan_id
    AND p.approved IS TRUE
    AND lower(btrim(ct.name)) = 'story'
    AND p.organization_id IN (SELECT public.user_organization_ids());

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles role
    WHERE role.user_id = auth.uid()
      AND role.organization_id = v_org
      AND lower(btrim(role.role)) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_canva_connections c
    INNER JOIN public.organization_canva_connection_tokens t
      ON t.organization_id = c.organization_id
    WHERE c.organization_id = v_org
      AND c.is_active
      AND c.oauth_connected_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'canva_not_connected' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.canva_story_runs (
    social_media_plan_id, organization_id, status, attempts, updated_at
  )
  VALUES (p_plan_id, v_org, 'queued', 0, now())
  ON CONFLICT (social_media_plan_id) DO UPDATE
  SET status = 'queued',
      error = NULL,
      canva_job_id = NULL,
      continuation_token = NULL,
      finished_at = NULL,
      images_ready = false,
      refresh_requested = false,
      revision_requested = false,
      revision_attempts = 0,
      review_after_export = false,
      export_attempts = 0,
      attempts = 0,
      updated_at = now()
  WHERE public.canva_story_runs.status IS DISTINCT FROM 'running'
     OR public.canva_story_runs.updated_at <= now() - interval '3 minutes'
  RETURNING social_media_plan_id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'too_soon' USING ERRCODE = '22023';
  END IF;

  PERFORM public.canva_story_post(p_plan_id, 'start');
END;
$$;

REVOKE ALL ON FUNCTION public.canva_story_start(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_story_start(uuid) TO authenticated;
