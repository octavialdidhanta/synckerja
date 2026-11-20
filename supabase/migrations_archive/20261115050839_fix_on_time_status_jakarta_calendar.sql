-- Recalculate stored on_time_status using Asia/Jakarta calendar days.
-- post_date is timestamptz often stored as midnight WIB (= 17:00 UTC previous day);
-- comparing UTC dates made same-day posts look "Late 1 Day".

UPDATE public.social_media_plans AS plan
SET
  on_time_status = CASE
    WHEN plan.actual_post_date::date <= (plan.post_date AT TIME ZONE 'Asia/Jakarta')::date
      THEN 'Ontime'
    ELSE
      'Late '
      || (plan.actual_post_date::date - (plan.post_date AT TIME ZONE 'Asia/Jakarta')::date)::text
      || CASE
           WHEN (plan.actual_post_date::date - (plan.post_date AT TIME ZONE 'Asia/Jakarta')::date) = 1
             THEN ' Day'
           ELSE ' Days'
         END
  END,
  updated_at = now()
WHERE plan.actual_post_date IS NOT NULL
  AND plan.post_date IS NOT NULL
  AND (
    plan.on_time_status = 'Ontime'
    OR plan.on_time_status ~ '^Late [0-9]+ Day'
  )
  AND plan.on_time_status IS DISTINCT FROM (
    CASE
      WHEN plan.actual_post_date::date <= (plan.post_date AT TIME ZONE 'Asia/Jakarta')::date
        THEN 'Ontime'
      ELSE
        'Late '
        || (plan.actual_post_date::date - (plan.post_date AT TIME ZONE 'Asia/Jakarta')::date)::text
        || CASE
             WHEN (plan.actual_post_date::date - (plan.post_date AT TIME ZONE 'Asia/Jakarta')::date) = 1
               THEN ' Day'
             ELSE ' Days'
           END
    END
  );
