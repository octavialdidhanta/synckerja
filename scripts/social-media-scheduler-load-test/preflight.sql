-- Preflight before load test run.

SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'social-media-scheduler';

SELECT *
FROM public.social_media_scheduler_config
WHERE id = 1;

SELECT public.get_social_media_schedule_monitoring_summary();

SELECT count(*) AS load_test_pending_due
FROM public.social_media_scheduled_posts
WHERE (provider_config->>'load_test') = 'true'
  AND status = 'pending'
  AND scheduled_at <= now()
  AND (next_retry_at IS NULL OR next_retry_at <= now());
