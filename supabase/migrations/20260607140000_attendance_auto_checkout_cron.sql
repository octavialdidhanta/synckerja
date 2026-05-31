-- Schedule apply_attendance_auto_checkout via pg_cron (every 15 minutes when extension available).

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'attendance-auto-checkout'
    ) THEN
      PERFORM cron.schedule(
        'attendance-auto-checkout',
        '*/15 * * * *',
        $cmd$SELECT public.apply_attendance_auto_checkout(NULL);$cmd$
      );
    END IF;
  END IF;
END
$cron$;

COMMENT ON FUNCTION public.apply_attendance_auto_checkout(uuid) IS
  'Auto check-out open attendance rows when org auto_checkout_enabled and local time >= auto_checkout_time. Scheduled via pg_cron job attendance-auto-checkout every 15 min; optional edge function attendance-auto-checkout for manual/external trigger.';
