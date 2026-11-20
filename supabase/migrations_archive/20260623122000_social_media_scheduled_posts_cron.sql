-- Optional pg_cron hook: invoke tiktok-content-scheduler edge function every 2 minutes.
-- Requires pg_cron + pg_net on hosted Supabase. Safe no-op when extensions missing.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_tiktok_content_scheduler_edge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  v_url := current_setting('app.settings.supabase_url', true);
  v_key := current_setting('app.settings.service_role_key', true);

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/tiktok-content-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_tiktok_content_scheduler_edge() IS
  'POST tiktok-content-scheduler edge function. Configure app.settings.supabase_url and service_role_key for pg_cron, or invoke the function via external cron.';

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'tiktok-content-scheduler'
    ) THEN
      PERFORM cron.schedule(
        'tiktok-content-scheduler',
        '*/2 * * * *',
        $cmd$SELECT public.invoke_tiktok_content_scheduler_edge();$cmd$
      );
    END IF;
  END IF;
END
$cron$;
