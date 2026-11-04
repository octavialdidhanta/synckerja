-- A member can ask for the saved Canva design to be exported again.
-- The old carousel JPGs stay until the new files are stored.

ALTER TABLE public.canva_carousel_runs
  ADD COLUMN IF NOT EXISTS refresh_requested boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.canva_carousel_status_for_plans(uuid[]);

CREATE FUNCTION public.canva_carousel_status_for_plans(p_plan_ids uuid[])
RETURNS TABLE (
  social_media_plan_id uuid,
  status text,
  design_url text,
  error text,
  images_ready boolean,
  refresh_requested boolean
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
         r.refresh_requested
  FROM public.canva_carousel_runs r
  INNER JOIN public.social_media_plans p ON p.id = r.social_media_plan_id
  WHERE r.social_media_plan_id = ANY(COALESCE(p_plan_ids, ARRAY[]::uuid[]))
    AND p.organization_id IN (SELECT public.user_organization_ids());
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_status_for_plans(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_carousel_status_for_plans(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.canva_carousel_refresh(p_plan_id uuid)
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

  UPDATE public.canva_carousel_runs
  SET refresh_requested = true,
      images_ready = false,
      export_attempts = 0,
      error = NULL,
      updated_at = now()
  WHERE social_media_plan_id = p_plan_id
    AND status = 'succeeded'
    AND design_id IS NOT NULL
    AND btrim(design_id) <> '';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'canva_design_missing' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.canva_carousel_post(p_plan_id, 'refresh');
END;
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_refresh(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canva_carousel_refresh(uuid) TO authenticated;
