-- Resume a succeeded carousel when the company logo still has to be placed,
-- and keep the existing revision and export retries.

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
    INNER JOIN public.social_media_plans p ON p.id = r.social_media_plan_id
    WHERE p.approved IS TRUE
      AND (
        (
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
        ) OR (
          r.status = 'succeeded'
          AND r.logo_placed IS FALSE
          AND r.design_id IS NOT NULL
          AND r.error IS NULL
          AND r.updated_at < now() - interval '40 seconds'
        )
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
