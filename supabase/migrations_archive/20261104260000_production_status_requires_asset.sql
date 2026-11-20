-- Production status "Need Review" means a deliverable is waiting for review.
-- A plan with no Google Drive link and no carousel images is not in production review.
-- New AI plans stay in content review (status) until a deliverable exists.

UPDATE public.social_media_plans AS plan
SET production_status = NULL
WHERE lower(btrim(coalesce(plan.production_status, ''))) = 'need review'
  AND coalesce(btrim(plan.google_drive_link), '') = ''
  AND coalesce(plan.production_approved, false) = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.social_media_plan_carousel_images AS image
    WHERE image.social_media_plan_id = plan.id
  );

DO $patch$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_perform(uuid, uuid, text, jsonb)'::regprocedure),
    E'\r\n',
    E'\n'
  );
  old_insert text := $old$'Need Review', false, false, 'draft'$old$;
  new_insert text := $new$NULL, false, false, 'Need Review'$new$;
  old_status text := $old$          production_status = 'Need Review',
$old$;
  insert_count integer;
  status_count integer;
BEGIN
  insert_count := (length(def) - length(replace(def, old_insert, ''))) / length(old_insert);
  status_count := (length(def) - length(replace(def, old_status, ''))) / length(old_status);
  IF NOT (insert_count = 0 AND status_count = 0 AND position(new_insert IN def) > 0) THEN
    IF insert_count <> 1 OR status_count <> 2 THEN
      RAISE EXCEPTION 'production_status_patch_insert_%_status_%', insert_count, status_count;
    END IF;
    def := replace(def, old_insert, new_insert);
    def := replace(def, old_status, '');
    EXECUTE def;
  END IF;
END;
$patch$;
