-- Keep TikTok Shop seller access tokens fresh via scheduled refresh (every 12 hours).
-- Vault: reuse tiktok_scheduler_project_url + tiktok_scheduler_service_role_key
--   (or optional tiktok_shop_token_refresh_secret as Bearer).

CREATE OR REPLACE FUNCTION public.invoke_tiktok_shop_token_refresh_edge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_url text;
  v_key text;
BEGIN
  v_url := nullif(current_setting('app.settings.supabase_url', true), '');
  v_key := nullif(current_setting('app.settings.service_role_key', true), '');

  IF v_url IS NULL THEN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'tiktok_scheduler_project_url'
    LIMIT 1;
  END IF;

  IF v_key IS NULL THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'tiktok_shop_token_refresh_secret'
    LIMIT 1;
  END IF;

  IF v_key IS NULL THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'tiktok_scheduler_service_role_key'
    LIMIT 1;
  END IF;

  IF v_key IS NULL THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'tiktok_scheduler_cron_secret'
    LIMIT 1;
  END IF;

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE LOG 'invoke_tiktok_shop_token_refresh_edge: missing Vault secrets (tiktok_scheduler_project_url / token refresh bearer)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/tiktok-shop-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$fn$;

COMMENT ON FUNCTION public.invoke_tiktok_shop_token_refresh_edge() IS
  'POST tiktok-shop-token-refresh every 12h via pg_cron. Vault: tiktok_scheduler_project_url + tiktok_shop_token_refresh_secret (or tiktok_scheduler_service_role_key).';

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('tiktok-shop-token-refresh');
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'tiktok-shop-token-refresh',
      '0 */12 * * *',
      'SELECT public.invoke_tiktok_shop_token_refresh_edge()'
    );
  END IF;
END;
$do$;
