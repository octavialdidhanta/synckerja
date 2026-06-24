-- Milestone A: generic social-media-scheduler cron (1 min), monitoring views, legacy shim.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_social_media_scheduler_edge()
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
    WHERE name = 'social_media_scheduler_project_url'
    LIMIT 1;
  END IF;

  IF v_url IS NULL THEN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'tiktok_scheduler_project_url'
    LIMIT 1;
  END IF;

  IF v_key IS NULL THEN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'social_media_scheduler_cron_secret'
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
    RAISE LOG 'invoke_social_media_scheduler_edge: missing Vault secrets (social_media_scheduler_* or tiktok_scheduler_*)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/social-media-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_social_media_scheduler_edge() IS
  'POST social-media-scheduler every 1 min via pg_cron. Vault: social_media_scheduler_project_url + social_media_scheduler_cron_secret (fallback: tiktok_scheduler_*). Bearer = SCHEDULED_POSTS_INTERNAL_SECRET.';

CREATE OR REPLACE FUNCTION public.invoke_tiktok_content_scheduler_edge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.invoke_social_media_scheduler_edge();
END;
$$;

COMMENT ON FUNCTION public.invoke_tiktok_content_scheduler_edge() IS
  'Deprecated wrapper — calls invoke_social_media_scheduler_edge().';

-- Monitoring indexes
CREATE INDEX IF NOT EXISTS idx_social_media_scheduled_posts_publishing_stale
  ON public.social_media_scheduled_posts (updated_at)
  WHERE status = 'publishing';

CREATE INDEX IF NOT EXISTS idx_social_media_scheduled_posts_failed_recent
  ON public.social_media_scheduled_posts (updated_at DESC)
  WHERE status = 'failed';

-- Monitoring views (thresholds mirror _shared/scheduledPosts/monitoring/thresholds.ts)
CREATE OR REPLACE VIEW public.v_social_media_schedules_pending_late AS
SELECT
  id,
  organization_id,
  social_media_plan_id,
  platform,
  scheduled_at,
  updated_at,
  retry_count,
  error_message
FROM public.social_media_scheduled_posts
WHERE status = 'pending'
  AND scheduled_at < now() - interval '3 minutes';

CREATE OR REPLACE VIEW public.v_social_media_schedules_stuck_publishing AS
SELECT
  id,
  organization_id,
  social_media_plan_id,
  platform,
  scheduled_at,
  updated_at,
  retry_count,
  error_message
FROM public.social_media_scheduled_posts
WHERE status = 'publishing'
  AND updated_at < now() - interval '20 minutes';

CREATE OR REPLACE VIEW public.v_social_media_schedules_failed_24h AS
SELECT
  id,
  organization_id,
  social_media_plan_id,
  platform,
  scheduled_at,
  updated_at,
  retry_count,
  error_message
FROM public.social_media_scheduled_posts
WHERE status = 'failed'
  AND updated_at >= now() - interval '24 hours';

COMMENT ON VIEW public.v_social_media_schedules_pending_late IS
  'Pending schedules past scheduled_at + 3 min grace (cron lag buffer).';
COMMENT ON VIEW public.v_social_media_schedules_stuck_publishing IS
  'Publishing rows with no progress for 20+ minutes.';
COMMENT ON VIEW public.v_social_media_schedules_failed_24h IS
  'Failed schedules in the last 24 hours.';

CREATE OR REPLACE FUNCTION public.get_social_media_schedule_monitoring_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pending_late_count', (SELECT count(*)::int FROM public.v_social_media_schedules_pending_late),
    'stuck_publishing_count', (SELECT count(*)::int FROM public.v_social_media_schedules_stuck_publishing),
    'failed_24h_count', (SELECT count(*)::int FROM public.v_social_media_schedules_failed_24h),
    'pending_late_sample', (
      SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      FROM (SELECT * FROM public.v_social_media_schedules_pending_late ORDER BY scheduled_at LIMIT 10) t
    ),
    'stuck_publishing_sample', (
      SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      FROM (SELECT * FROM public.v_social_media_schedules_stuck_publishing ORDER BY updated_at LIMIT 10) t
    ),
    'failed_24h_sample', (
      SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      FROM (SELECT * FROM public.v_social_media_schedules_failed_24h ORDER BY updated_at DESC LIMIT 10) t
    )
  );
$$;

COMMENT ON FUNCTION public.get_social_media_schedule_monitoring_summary() IS
  'Ops summary: counts + up to 10 sample rows per monitoring category. Service role / SQL editor.';

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tiktok-content-scheduler') THEN
      PERFORM cron.unschedule('tiktok-content-scheduler');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'social-media-scheduler') THEN
      PERFORM cron.unschedule('social-media-scheduler');
    END IF;

    PERFORM cron.schedule(
      'social-media-scheduler',
      '*/1 * * * *',
      $cmd$SELECT public.invoke_social_media_scheduler_edge();$cmd$
    );
  END IF;
END
$cron$;
