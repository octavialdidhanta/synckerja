-- Milestone C: fair claim per org, publish rate windows, rate-limit defer monitoring.

ALTER TABLE public.organization_social_media_scheduling_settings
  ADD COLUMN IF NOT EXISTS max_publishes_per_5min integer NOT NULL DEFAULT 3;

ALTER TABLE public.organization_social_media_scheduling_settings
  DROP CONSTRAINT IF EXISTS organization_social_media_scheduling_settings_max_publishes_check;

ALTER TABLE public.organization_social_media_scheduling_settings
  ADD CONSTRAINT organization_social_media_scheduling_settings_max_publishes_check
  CHECK (max_publishes_per_5min BETWEEN 1 AND 20);

COMMENT ON COLUMN public.organization_social_media_scheduling_settings.max_publishes_per_5min IS
  'Max publish starts per org+platform per 5-minute window (scheduler throttle).';

CREATE TABLE IF NOT EXISTS public.social_media_publish_rate_windows (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  platform text NOT NULL,
  window_start timestamptz NOT NULL,
  publish_count integer NOT NULL DEFAULT 0,
  CONSTRAINT social_media_publish_rate_windows_pkey
    PRIMARY KEY (organization_id, platform, window_start),
  CONSTRAINT social_media_publish_rate_windows_count_nonneg CHECK (publish_count >= 0)
);

COMMENT ON TABLE public.social_media_publish_rate_windows IS
  'Rolling 5-minute publish counters per org+platform (service role / SECURITY DEFINER RPC only).';

ALTER TABLE public.social_media_publish_rate_windows ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.try_acquire_social_media_publish_slot(
  p_organization_id uuid,
  p_platform text,
  p_max_per_window integer DEFAULT 3
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_new_count integer;
  v_max integer;
BEGIN
  v_max := GREATEST(1, LEAST(COALESCE(p_max_per_window, 3), 20));
  v_window_start := date_trunc('minute', now())
    - ((extract(minute from now())::integer % 5) * interval '1 minute');

  INSERT INTO public.social_media_publish_rate_windows AS w (
    organization_id,
    platform,
    window_start,
    publish_count
  )
  VALUES (p_organization_id, p_platform, v_window_start, 1)
  ON CONFLICT (organization_id, platform, window_start)
  DO UPDATE SET publish_count = w.publish_count + 1
  WHERE w.publish_count < v_max
  RETURNING w.publish_count INTO v_new_count;

  DELETE FROM public.social_media_publish_rate_windows
  WHERE window_start < now() - interval '2 hours';

  RETURN v_new_count IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.try_acquire_social_media_publish_slot(uuid, text, integer) IS
  'Atomically increment org+platform publish counter for current 5-min window; false when at cap.';

DROP FUNCTION IF EXISTS public.claim_due_scheduled_posts(integer);

CREATE OR REPLACE FUNCTION public.claim_due_scheduled_posts(
  p_limit integer DEFAULT 25,
  p_per_org_limit integer DEFAULT 3
)
RETURNS SETOF public.social_media_scheduled_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT
      s.id,
      s.organization_id,
      s.scheduled_at,
      ROW_NUMBER() OVER (
        PARTITION BY s.organization_id ORDER BY s.scheduled_at ASC
      ) AS org_rn
    FROM public.social_media_scheduled_posts s
    WHERE s.status = 'pending'
      AND s.scheduled_at <= now()
      AND (s.next_retry_at IS NULL OR s.next_retry_at <= now())
  ),
  ranked_candidates AS (
    SELECT d.id, d.scheduled_at
    FROM due d
    WHERE d.org_rn <= GREATEST(1, LEAST(COALESCE(p_per_org_limit, 3), 20))
    ORDER BY d.scheduled_at ASC
    LIMIT GREATEST(1, LEAST(p_limit, 100))
  ),
  candidates AS (
    SELECT s.id
    FROM public.social_media_scheduled_posts s
    INNER JOIN ranked_candidates rc ON rc.id = s.id
    FOR UPDATE OF s SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.social_media_scheduled_posts s
    SET
      status = 'publishing',
      locked_at = now(),
      updated_at = now()
    FROM candidates c
    WHERE s.id = c.id
      AND s.status = 'pending'
    RETURNING s.*
  )
  SELECT * FROM claimed;
END;
$$;

COMMENT ON FUNCTION public.claim_due_scheduled_posts(integer, integer) IS
  'Atomically claim due pending schedules with fair per-org cap (SKIP LOCKED) → publishing.';

CREATE INDEX IF NOT EXISTS idx_social_media_scheduled_posts_pending_due_org
  ON public.social_media_scheduled_posts (status, scheduled_at, organization_id)
  WHERE status = 'pending';

CREATE OR REPLACE VIEW public.v_social_media_schedules_rate_deferred AS
SELECT
  id,
  organization_id,
  social_media_plan_id,
  platform,
  scheduled_at,
  next_retry_at,
  updated_at,
  retry_count,
  error_message
FROM public.social_media_scheduled_posts
WHERE status = 'pending'
  AND error_message LIKE 'rate_limited:%'
  AND next_retry_at IS NOT NULL
  AND next_retry_at > now();

COMMENT ON VIEW public.v_social_media_schedules_rate_deferred IS
  'Pending rows deferred by internal rate limit (waiting for next_retry_at).';

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

COMMENT ON FUNCTION public.get_social_media_schedule_monitoring_summary() IS
  'Ops summary: counts + samples including rate-limit deferred and pending due queue.';
