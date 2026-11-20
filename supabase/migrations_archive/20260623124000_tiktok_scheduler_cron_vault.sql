-- TikTok scheduled posts: pg_cron → Edge Function via Vault (see Supabase schedule-functions docs).

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
    WHERE name = 'tiktok_scheduler_cron_secret'
    LIMIT 1;
  END IF;

  IF v_key IS NULL THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'tiktok_scheduler_service_role_key'
    LIMIT 1;
  END IF;

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE LOG 'invoke_tiktok_content_scheduler_edge: missing Vault secrets (tiktok_scheduler_project_url / tiktok_scheduler_cron_secret)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/tiktok-content-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_tiktok_content_scheduler_edge() IS
  'POST tiktok-content-scheduler every 2 min via pg_cron. Vault: tiktok_scheduler_project_url + tiktok_scheduler_cron_secret (Bearer = SCHEDULED_POSTS_INTERNAL_SECRET).';
