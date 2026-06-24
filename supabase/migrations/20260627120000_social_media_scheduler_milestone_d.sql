-- Milestone D: tunable scheduler config, tick logs, load-test cleanup, cron timeout bump.

CREATE TABLE IF NOT EXISTS public.social_media_scheduler_config (
  id smallint PRIMARY KEY DEFAULT 1,
  CONSTRAINT social_media_scheduler_config_singleton CHECK (id = 1),
  batch_size integer NOT NULL DEFAULT 20,
  per_org_per_tick integer NOT NULL DEFAULT 3,
  resume_batch_size integer NOT NULL DEFAULT 10,
  tick_concurrency integer NOT NULL DEFAULT 4,
  tick_time_budget_ms integer NOT NULL DEFAULT 25000,
  tiktok_global_in_flight integer NOT NULL DEFAULT 12,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_media_scheduler_config_batch_size CHECK (batch_size BETWEEN 1 AND 100),
  CONSTRAINT social_media_scheduler_config_per_org CHECK (per_org_per_tick BETWEEN 1 AND 20),
  CONSTRAINT social_media_scheduler_config_resume CHECK (resume_batch_size BETWEEN 1 AND 50),
  CONSTRAINT social_media_scheduler_config_concurrency CHECK (tick_concurrency BETWEEN 1 AND 20),
  CONSTRAINT social_media_scheduler_config_budget CHECK (tick_time_budget_ms BETWEEN 5000 AND 120000),
  CONSTRAINT social_media_scheduler_config_in_flight CHECK (tiktok_global_in_flight BETWEEN 1 AND 50)
);

COMMENT ON TABLE public.social_media_scheduler_config IS
  'Singleton runtime tuning for social-media-scheduler (ops / load-test).';

INSERT INTO public.social_media_scheduler_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.social_media_scheduler_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_social_media_scheduler_config()
RETURNS public.social_media_scheduler_config
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.social_media_scheduler_config WHERE id = 1;
$$;

COMMENT ON FUNCTION public.get_social_media_scheduler_config() IS
  'Return singleton scheduler tuning row (service role / edge worker).';

CREATE TABLE IF NOT EXISTS public.social_media_scheduler_tick_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL,
  duration_ms integer NOT NULL,
  dry_run boolean NOT NULL DEFAULT false,
  claimed integer NOT NULL DEFAULT 0,
  resumed integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  published_ok integer NOT NULL DEFAULT 0,
  deferred_rate_limited integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  recovered_stale integer NOT NULL DEFAULT 0,
  pending_due_now integer,
  pending_late integer,
  rate_deferred integer,
  config_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_social_media_scheduler_tick_logs_started
  ON public.social_media_scheduler_tick_logs (started_at DESC);

COMMENT ON TABLE public.social_media_scheduler_tick_logs IS
  'Per-invoke scheduler metrics for load test and ops (service role only).';

ALTER TABLE public.social_media_scheduler_tick_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_social_media_scheduled_posts_load_test_pending
  ON public.social_media_scheduled_posts (status, scheduled_at)
  WHERE (provider_config->>'load_test') = 'true';

CREATE OR REPLACE VIEW public.v_social_media_scheduler_tick_stats_1h AS
SELECT
  date_trunc('minute', started_at) AS minute_bucket,
  count(*)::int AS tick_count,
  round(avg(duration_ms))::int AS avg_duration_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95_duration_ms,
  sum(published_ok)::int AS published_ok_sum,
  sum(claimed)::int AS claimed_sum,
  sum(deferred_rate_limited)::int AS deferred_sum
FROM public.social_media_scheduler_tick_logs
WHERE started_at >= now() - interval '1 hour'
GROUP BY 1
ORDER BY 1 DESC;

COMMENT ON VIEW public.v_social_media_scheduler_tick_stats_1h IS
  'Hourly rollup of scheduler tick throughput and latency.';

CREATE OR REPLACE FUNCTION public.cleanup_social_media_load_test_rows()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedules integer := 0;
  v_plans integer := 0;
BEGIN
  DELETE FROM public.social_media_scheduled_posts
  WHERE (provider_config->>'load_test') = 'true';
  GET DIAGNOSTICS v_schedules = ROW_COUNT;

  DELETE FROM public.social_media_plans
  WHERE title LIKE '[LOAD_TEST]%';
  GET DIAGNOSTICS v_plans = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_schedules', v_schedules,
    'deleted_plans', v_plans
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_social_media_load_test_rows() IS
  'Remove load-test seed schedules and plans (service role / SQL editor only).';

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
    'rate_deferred_count', (SELECT count(*)::int FROM public.v_social_media_schedules_rate_deferred),
    'pending_due_now_count', (
      SELECT count(*)::int
      FROM public.social_media_scheduled_posts s
      WHERE s.status = 'pending'
        AND s.scheduled_at <= now()
        AND (s.next_retry_at IS NULL OR s.next_retry_at <= now())
    ),
    'last_tick', (
      SELECT to_jsonb(t)
      FROM (
        SELECT
          id,
          started_at,
          finished_at,
          duration_ms,
          dry_run,
          claimed,
          resumed,
          processed,
          published_ok,
          deferred_rate_limited,
          failed,
          recovered_stale,
          pending_due_now,
          pending_late,
          rate_deferred
        FROM public.social_media_scheduler_tick_logs
        ORDER BY started_at DESC
        LIMIT 1
      ) t
    ),
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
    ),
    'rate_deferred_sample', (
      SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      FROM (SELECT * FROM public.v_social_media_schedules_rate_deferred ORDER BY next_retry_at LIMIT 10) t
    )
  );
$$;

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
    timeout_milliseconds := 45000
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_social_media_scheduler_edge() IS
  'POST social-media-scheduler every 1 min via pg_cron (45s HTTP timeout; edge uses internal time budget).';
