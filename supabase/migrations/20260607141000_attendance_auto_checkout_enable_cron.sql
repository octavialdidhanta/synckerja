-- Enable Supabase Cron extensions (hosted) and schedule auto checkout.
-- Safe to re-run: uses IF NOT EXISTS / job name guard.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-auto-checkout-sql') THEN
      PERFORM cron.schedule(
        'attendance-auto-checkout-sql',
        '*/15 * * * *',
        $cmd$SELECT public.apply_attendance_auto_checkout(NULL);$cmd$
      );
    END IF;
  END IF;
END
$cron$;
