-- A publishing row with no heartbeat is stalled. Resume platform work that already has an id.
-- Rows with no platform progress go back to pending immediately so the same cron tick can retry.

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
      AND COALESCE(s.locked_at, s.updated_at) < now() - interval '10 minutes'
      AND (
        (
          s.platform = 'TikTok'
          AND s.provider_config->>'tiktok_publish_id' IS NOT NULL
        )
        OR (
          s.platform = 'YouTube'
          AND (
            (
              s.provider_config->>'youtube_upload_url' IS NOT NULL
              AND COALESCE(s.provider_config->>'youtube_upload_completed', 'false') = 'true'
            )
            OR s.provider_config->>'youtube_video_id' IS NOT NULL
          )
        )
        OR (
          s.platform = 'Instagram'
          AND s.provider_config->>'ig_container_id' IS NOT NULL
          AND COALESCE(s.provider_config->>'ig_upload_phase', '') IN ('uploaded', 'published')
        )
        OR (
          s.platform = 'Facebook'
          AND s.provider_config->>'fb_video_id' IS NOT NULL
        )
        OR (
          s.platform = 'LinkedIn'
          AND (
            s.provider_config->>'linkedin_upload_urn' IS NOT NULL
            OR s.provider_config->>'linkedin_post_urn' IS NOT NULL
          )
        )
      )
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
  'Re-claim publishing rows with no heartbeat for 10 minutes when TikTok/Facebook/YouTube/Instagram/LinkedIn already has resume state.';

CREATE OR REPLACE FUNCTION public.recover_stale_publishing_rows(p_stale_minutes integer DEFAULT 10)
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
      AND NOT (
        (
          s.platform = 'TikTok'
          AND s.provider_config->>'tiktok_publish_id' IS NOT NULL
        )
        OR (
          s.platform = 'YouTube'
          AND s.provider_config->>'youtube_video_id' IS NOT NULL
        )
        OR (
          s.platform = 'Instagram'
          AND s.provider_config->>'ig_container_id' IS NOT NULL
          AND COALESCE(s.provider_config->>'ig_upload_phase', '') IN ('uploaded', 'published')
        )
        OR (
          s.platform = 'Facebook'
          AND s.provider_config->>'fb_video_id' IS NOT NULL
        )
        OR (
          s.platform = 'LinkedIn'
          AND s.provider_config->>'linkedin_post_urn' IS NOT NULL
        )
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_row.retry_count >= v_max_retries THEN
      UPDATE public.social_media_scheduled_posts
      SET
        status = 'failed',
        error_message = 'publish_stalled_max_retries',
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
        next_retry_at = now(),
        last_error_at = now(),
        error_message = 'publish_stalled: no progress while publishing',
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
  'Move publishing rows with no heartbeat and no platform resume state back to pending for the same tick.';

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
  AND COALESCE(locked_at, updated_at) < now() - interval '10 minutes';

ALTER VIEW public.v_social_media_schedules_stuck_publishing SET (security_invoker = true);

COMMENT ON VIEW public.v_social_media_schedules_stuck_publishing IS
  'Publishing rows with no heartbeat for 10+ minutes.';
