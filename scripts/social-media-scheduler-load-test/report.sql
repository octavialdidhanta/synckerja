-- Load test report (run after run.mjs or manual scheduler invokes).

SELECT public.get_social_media_schedule_monitoring_summary();

SELECT *
FROM public.v_social_media_scheduler_tick_stats_1h
ORDER BY minute_bucket DESC
LIMIT 30;

SELECT
  count(*) FILTER (WHERE status = 'published') AS published_count,
  count(*) FILTER (WHERE status = 'pending') AS pending_count,
  count(*) FILTER (WHERE status = 'publishing') AS publishing_count,
  count(*) FILTER (WHERE status = 'failed') AS failed_count
FROM public.social_media_scheduled_posts
WHERE (provider_config->>'load_test') = 'true';

SELECT
  percentile_cont(0.95) WITHIN GROUP (
    ORDER BY extract(epoch FROM (published_at - scheduled_at))
  )::int AS p95_publish_latency_seconds
FROM public.social_media_scheduled_posts
WHERE (provider_config->>'load_test') = 'true'
  AND status = 'published'
  AND published_at IS NOT NULL;

SELECT
  started_at,
  duration_ms,
  claimed,
  published_ok,
  deferred_rate_limited,
  pending_due_now,
  pending_late
FROM public.social_media_scheduler_tick_logs
ORDER BY started_at DESC
LIMIT 25;
