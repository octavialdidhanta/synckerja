-- pg_cron → google-ads-upload-pending-conversions: send apikey header (secret-key projects).

CREATE OR REPLACE FUNCTION public.invoke_google_ads_pending_conversions_edge()
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
    WHERE name = 'google_ads_scheduler_project_url'
    LIMIT 1;
  END IF;

  IF v_key IS NULL THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'google_ads_scheduler_service_role_key'
    LIMIT 1;
  END IF;

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE LOG 'invoke_google_ads_pending_conversions_edge: missing Vault secrets (google_ads_scheduler_project_url, google_ads_scheduler_service_role_key)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/google-ads-upload-pending-conversions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_google_ads_pending_conversions_edge() IS
  'POST google-ads-upload-pending-conversions every hour via pg_cron. Vault: google_ads_scheduler_project_url + google_ads_scheduler_service_role_key (sb_secret or legacy service_role JWT). Sends Authorization + apikey.';
