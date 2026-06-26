-- Clear stale actual_post_date / on_time_status when plan is not fully done.
UPDATE public.social_media_plans
SET
  actual_post_date = NULL,
  on_time_status = 'In Progress',
  updated_at = now()
WHERE done = false
  AND actual_post_date IS NOT NULL;

-- Ontime/Late without actual completion date (partial publish metadata).
UPDATE public.social_media_plans
SET
  actual_post_date = NULL,
  on_time_status = 'In Progress',
  updated_at = now()
WHERE actual_post_date IS NULL
  AND (
    on_time_status = 'Ontime'
    OR on_time_status ~ '^Late [0-9]+ Day'
  );

-- done=true but still in progress / scheduled (inconsistent publish state).
UPDATE public.social_media_plans
SET
  done = false,
  actual_post_date = NULL,
  on_time_status = 'In Progress',
  updated_at = now()
WHERE done = true
  AND (
    on_time_status = 'In Progress'
    OR on_time_status = 'Scheduled'
    OR actual_post_date IS NULL
  );
