-- Milestone B: atomic claim (SKIP LOCKED), next_retry_at backoff, stale publishing recovery.

ALTER TABLE public.social_media_scheduled_posts
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz NULL;

COMMENT ON COLUMN public.social_media_scheduled_posts.next_retry_at IS
  'Do not claim before this time (retry backoff).';
COMMENT ON COLUMN public.social_media_scheduled_posts.locked_at IS
  'When the row entered publishing (worker claim).';
COMMENT ON COLUMN public.social_media_scheduled_posts.last_error_at IS
  'Timestamp of the most recent publish error.';

CREATE INDEX IF NOT EXISTS idx_social_media_scheduled_posts_due_retry
  ON public.social_media_scheduled_posts (scheduled_at, next_retry_at)
  WHERE status = 'pending';

-- Backoff minutes by retry_count (1-based): 2, 5, 15, 30, 60 (cap).
CREATE OR REPLACE FUNCTION public.scheduled_post_retry_backoff_interval(p_retry_count integer)
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT make_interval(mins => (
    CASE GREATEST(1, LEAST(p_retry_count, 5))
      WHEN 1 THEN 2
      WHEN 2 THEN 5
      WHEN 3 THEN 15
      WHEN 4 THEN 30
      ELSE 60
    END
  ));
$$;

CREATE OR REPLACE FUNCTION public.claim_due_scheduled_posts(p_limit integer DEFAULT 25)
RETURNS SETOF public.social_media_scheduled_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT s.id
    FROM public.social_media_scheduled_posts s
    WHERE s.status = 'pending'
      AND s.scheduled_at <= now()
      AND (s.next_retry_at IS NULL OR s.next_retry_at <= now())
    ORDER BY s.scheduled_at ASC
    LIMIT GREATEST(1, LEAST(p_limit, 100))
    FOR UPDATE SKIP LOCKED
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

COMMENT ON FUNCTION public.claim_due_scheduled_posts(integer) IS
  'Atomically claim due pending schedules (SKIP LOCKED) → publishing. Service role / edge scheduler only.';

CREATE OR REPLACE FUNCTION public.claim_resume_publishing_posts(p_limit integer DEFAULT 10)
RETURNS SETOF public.social_media_scheduled_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT s.id
    FROM public.social_media_scheduled_posts s
    WHERE s.status = 'publishing'
      AND s.provider_config->>'tiktok_publish_id' IS NOT NULL
      AND COALESCE(s.provider_config->>'tiktok_upload_completed', 'false') = 'true'
      AND COALESCE(s.locked_at, s.updated_at) < now() - interval '20 minutes'
    ORDER BY COALESCE(s.locked_at, s.updated_at) ASC
    LIMIT GREATEST(1, LEAST(p_limit, 50))
    FOR UPDATE SKIP LOCKED
  ),
  touched AS (
    UPDATE public.social_media_scheduled_posts s
    SET
      locked_at = now(),
      updated_at = now()
    FROM candidates c
    WHERE s.id = c.id
      AND s.status = 'publishing'
    RETURNING s.*
  )
  SELECT * FROM touched;
END;
$$;

COMMENT ON FUNCTION public.claim_resume_publishing_posts(integer) IS
  'Re-claim stale publishing rows with TikTok publish_id for poll-only resume (SKIP LOCKED).';

CREATE OR REPLACE FUNCTION public.recover_stale_publishing_rows(p_stale_minutes integer DEFAULT 20)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_row record;
  v_max_retries integer := 8;
BEGIN
  FOR v_row IN
    SELECT s.*
    FROM public.social_media_scheduled_posts s
    WHERE s.status = 'publishing'
      AND COALESCE(s.locked_at, s.updated_at) < now() - make_interval(mins => GREATEST(1, p_stale_minutes))
      AND (
        s.provider_config->>'tiktok_publish_id' IS NULL
        OR COALESCE(s.provider_config->>'tiktok_upload_completed', 'false') <> 'true'
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_row.retry_count >= v_max_retries THEN
      UPDATE public.social_media_scheduled_posts
      SET
        status = 'failed',
        error_message = COALESCE(error_message, 'stale_publishing_max_retries'),
        last_error_at = now(),
        next_retry_at = NULL,
        locked_at = NULL,
        updated_at = now()
      WHERE id = v_row.id;
    ELSE
      UPDATE public.social_media_scheduled_posts
      SET
        status = 'pending',
        retry_count = v_row.retry_count + 1,
        next_retry_at = now() + public.scheduled_post_retry_backoff_interval(v_row.retry_count + 1),
        last_error_at = now(),
        error_message = COALESCE(error_message, 'stale_publishing_recovered'),
        locked_at = NULL,
        updated_at = now()
      WHERE id = v_row.id;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    RAISE LOG 'recover_stale_publishing_rows: recovered % row(s)', v_count;
  END IF;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.recover_stale_publishing_rows(integer) IS
  'Reset stale publishing rows without completed TikTok upload to pending (backoff) or failed.';
