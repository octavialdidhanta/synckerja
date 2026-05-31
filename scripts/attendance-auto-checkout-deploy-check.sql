SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS pg_cron_available;

SELECT jobname, schedule, command
FROM cron.job
WHERE jobname LIKE 'attendance-auto-checkout%';

SELECT public.apply_attendance_auto_checkout(NULL) AS dry_run_result;
