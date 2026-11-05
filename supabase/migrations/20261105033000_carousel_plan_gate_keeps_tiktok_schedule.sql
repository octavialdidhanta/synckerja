-- Carousel and Post plans have no Google Drive link. The previous gate treated
-- every update of those plans as a Reel failure and cancelled the in-flight
-- TikTok photo publish (plan_gate_failed). Photo plans keep their schedule
-- while approval, post date, and 1–10 carousel images are still valid.

CREATE OR REPLACE FUNCTION public.trg_cancel_scheduled_posts_on_plan_gate_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_type text;
  v_photo boolean;
  v_image_count integer;
BEGIN
  SELECT name INTO v_new_type
  FROM public.content_types
  WHERE id = NEW.content_type_id;

  v_photo := lower(trim(coalesce(v_new_type, ''))) IN ('post', 'carousel');

  IF v_photo THEN
    SELECT count(*) INTO v_image_count
    FROM public.social_media_plan_carousel_images
    WHERE social_media_plan_id = NEW.id;

    IF NEW.approved IS DISTINCT FROM TRUE
      OR NEW.production_approved IS DISTINCT FROM TRUE
      OR NEW.post_date IS NULL
      OR v_image_count < 1
      OR v_image_count > 10
    THEN
      PERFORM public.cancel_social_media_scheduled_posts_for_plan(NEW.id, 'plan_gate_failed');
    END IF;
  ELSIF NEW.approved IS DISTINCT FROM TRUE
    OR NEW.production_approved IS DISTINCT FROM TRUE
    OR NEW.google_drive_link IS NULL
    OR trim(COALESCE(NEW.google_drive_link, '')) = ''
    OR NEW.post_date IS NULL
    OR v_new_type IS DISTINCT FROM 'Reel'
  THEN
    PERFORM public.cancel_social_media_scheduled_posts_for_plan(NEW.id, 'plan_gate_failed');
  END IF;

  RETURN NEW;
END;
$$;
