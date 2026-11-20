-- Daily inventory alerts email cron (00:15 WIB = 17:15 UTC).
CREATE OR REPLACE FUNCTION public.invoke_operational_inventory_alerts_edge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  v_url := nullif(current_setting('app.settings.supabase_url', true), '');
  v_key := nullif(current_setting('app.settings.service_role_key', true), '');

  IF v_url IS NULL THEN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name IN (
      'operational_daily_sales_project_url',
      'google_ads_scheduler_project_url',
      'tiktok_scheduler_project_url'
    )
    ORDER BY CASE name
      WHEN 'operational_daily_sales_project_url' THEN 0
      WHEN 'google_ads_scheduler_project_url' THEN 1
      ELSE 2
    END
    LIMIT 1;
  END IF;

  IF v_key IS NULL THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name IN (
      'operational_daily_sales_service_role_key',
      'google_ads_scheduler_service_role_key',
      'tiktok_scheduler_service_role_key'
    )
    ORDER BY CASE name
      WHEN 'operational_daily_sales_service_role_key' THEN 0
      WHEN 'google_ads_scheduler_service_role_key' THEN 1
      ELSE 2
    END
    LIMIT 1;
  END IF;

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE LOG 'invoke_operational_inventory_alerts_edge: missing Vault secrets (project url / service role key)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-operational-inventory-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_operational_inventory_alerts_edge() IS
  'POST send-operational-inventory-alerts at 00:15 WIB via pg_cron. Reuses daily-sales Vault secrets.';

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'operational-inventory-alerts') THEN
      PERFORM cron.unschedule('operational-inventory-alerts');
    END IF;

    -- 00:15 Asia/Jakarta = 17:15 UTC (same window as daily sales)
    PERFORM cron.schedule(
      'operational-inventory-alerts',
      '15 17 * * *',
      $cmd$SELECT public.invoke_operational_inventory_alerts_edge();$cmd$
    );
  END IF;
END;
$cron$;
