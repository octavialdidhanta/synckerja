-- Canva carousel plans never recorded Prod Completion on their first export: the table
-- shows Need Review from the images while production_status stays empty. Backfill the
-- date from when the current images were saved, never later than the production approval.
-- Plans under Request Revision stay empty.

UPDATE public.social_media_plans plan
SET production_completion_date = LEAST(
  images.saved_at,
  COALESCE(plan.production_approved_date, images.saved_at)
)
FROM (
  SELECT social_media_plan_id, min(created_at) AS saved_at
  FROM public.social_media_plan_carousel_images
  GROUP BY social_media_plan_id
) images
JOIN public.canva_carousel_runs run
  ON run.social_media_plan_id = images.social_media_plan_id
 AND run.images_ready IS TRUE
WHERE plan.id = images.social_media_plan_id
  AND plan.production_completion_date IS NULL
  AND (plan.production_status IS NULL OR plan.production_status IN ('Need Review', 'Approved'));
