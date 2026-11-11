-- An unapproved plan should not keep a queued Canva run, and resume should not call it.

CREATE OR REPLACE FUNCTION public.canva_carousel_stop_unapproved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approved IS TRUE OR OLD.approved IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;
  UPDATE public.canva_carousel_runs
  SET status = 'failed',
      error = 'not_approved',
      finished_at = COALESCE(finished_at, now()),
      updated_at = now()
  WHERE social_media_plan_id = NEW.id
    AND status IN ('queued', 'running')
    AND canva_job_id IS NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.canva_carousel_stop_unapproved() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS canva_carousel_on_unapprove ON public.social_media_plans;
CREATE TRIGGER canva_carousel_on_unapprove
  AFTER UPDATE OF approved ON public.social_media_plans
  FOR EACH ROW
  WHEN (NEW.approved IS DISTINCT FROM TRUE AND OLD.approved IS TRUE)
  EXECUTE FUNCTION public.canva_carousel_stop_unapproved();

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
    WHERE r.status IN ('queued', 'running')
      AND r.updated_at < now() - interval '40 seconds'
      AND p.approved IS TRUE
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

UPDATE public.canva_carousel_runs AS run
SET status = 'failed',
    error = 'not_approved',
    finished_at = COALESCE(run.finished_at, now()),
    updated_at = now()
FROM public.social_media_plans AS plan
WHERE plan.id = run.social_media_plan_id
  AND plan.approved IS NOT TRUE
  AND run.status IN ('queued', 'running')
  AND run.canva_job_id IS NULL;
