-- A review comment can point at a carousel slide number.
-- Request Revision then edits that slide on the existing Canva design.

ALTER TABLE public.link_comments
  ADD COLUMN IF NOT EXISTS carousel_slide_number smallint,
  ADD COLUMN IF NOT EXISTS canva_revision_applied_at timestamptz;

ALTER TABLE public.link_comments
  DROP CONSTRAINT IF EXISTS link_comments_carousel_slide_number_check;

ALTER TABLE public.link_comments
  ADD CONSTRAINT link_comments_carousel_slide_number_check
  CHECK (carousel_slide_number IS NULL OR carousel_slide_number BETWEEN 1 AND 10);

CREATE INDEX IF NOT EXISTS link_comments_canva_revision_idx
  ON public.link_comments (social_media_plan_id)
  WHERE carousel_slide_number IS NOT NULL AND canva_revision_applied_at IS NULL;

ALTER TABLE public.canva_carousel_runs
  ADD COLUMN IF NOT EXISTS revision_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revision_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_after_export boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.canva_carousel_status_for_plans(uuid[]);

CREATE FUNCTION public.canva_carousel_status_for_plans(p_plan_ids uuid[])
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
  FROM public.canva_carousel_runs r
  INNER JOIN public.social_media_plans p ON p.id = r.social_media_plan_id
  WHERE r.social_media_plan_id = ANY(COALESCE(p_plan_ids, ARRAY[]::uuid[]))
    AND p.organization_id IN (SELECT public.user_organization_ids());
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_status_for_plans(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_carousel_status_for_plans(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.canva_carousel_revise(p_plan_id uuid)
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
      AND c.carousel_slide_number BETWEEN 1 AND 10
      AND c.canva_revision_applied_at IS NULL
      AND btrim(coalesce(c.comment_text, '')) <> ''
  ) THEN
    RAISE EXCEPTION 'slide_comments_missing' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.canva_carousel_runs
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

  PERFORM public.canva_carousel_post(p_plan_id, 'resume');
END;
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_revise(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_carousel_revise(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.canva_carousel_resume()
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
    FROM public.canva_carousel_runs r
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
      AND r.design_id IS NOT NULL
      AND r.export_attempts < 3
      AND r.updated_at < now() - interval '50 seconds'
    )
    ORDER BY r.updated_at
    LIMIT 3
  LOOP
    PERFORM public.canva_carousel_post(v_plan, 'resume');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_resume() FROM PUBLIC, anon, authenticated;
