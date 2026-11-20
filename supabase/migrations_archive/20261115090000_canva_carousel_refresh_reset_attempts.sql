-- User "Perbarui dari Canva" should be able to redesign once after a page-order
-- mismatch. Reset attempts so canva-carousel-run can requeue create-design.

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
      attempts = 0,
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
