-- A finished Canva design can still need its JPG pages. The resume cron
-- continues that export. Download URLs are not stored.

ALTER TABLE public.canva_carousel_runs
  ADD COLUMN IF NOT EXISTS images_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS export_attempts smallint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS canva_carousel_runs_export_idx
  ON public.canva_carousel_runs (updated_at)
  WHERE status = 'succeeded' AND images_ready = false;

DROP FUNCTION IF EXISTS public.canva_carousel_status_for_plans(uuid[]);

CREATE FUNCTION public.canva_carousel_status_for_plans(p_plan_ids uuid[])
RETURNS TABLE (
  social_media_plan_id uuid,
  status text,
  design_url text,
  error text,
  images_ready boolean
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
         r.images_ready
  FROM public.canva_carousel_runs r
  INNER JOIN public.social_media_plans p ON p.id = r.social_media_plan_id
  WHERE r.social_media_plan_id = ANY(COALESCE(p_plan_ids, ARRAY[]::uuid[]))
    AND p.organization_id IN (SELECT public.user_organization_ids());
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_status_for_plans(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_carousel_status_for_plans(uuid[]) TO authenticated;

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
