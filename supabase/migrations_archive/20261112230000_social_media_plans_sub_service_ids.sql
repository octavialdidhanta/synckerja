-- Menus (sub categories) an AI content plan shows, up to 3, picked by the run from the
-- catalog's sub categories that have a real product photo. canva-carousel-run sends
-- only these photos when the list is set; sub_service_id keeps the first one.

ALTER TABLE public.social_media_plans
  ADD COLUMN IF NOT EXISTS sub_service_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'social_media_plans_sub_service_ids_max'
  ) THEN
    ALTER TABLE public.social_media_plans
      ADD CONSTRAINT social_media_plans_sub_service_ids_max
      CHECK (cardinality(sub_service_ids) <= 3);
  END IF;
END;
$check$;

COMMENT ON COLUMN public.social_media_plans.sub_service_ids IS
  'Up to 3 sub categories (menus) the plan shows; their library photos go to Canva.';
