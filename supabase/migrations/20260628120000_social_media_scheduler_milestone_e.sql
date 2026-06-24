-- Milestone E: platform executors — scheduler config caps, OAuth scopes, resume claim/recovery.

ALTER TABLE public.organization_youtube_content_connection_tokens
  ADD COLUMN IF NOT EXISTS oauth_scopes text NULL;

COMMENT ON COLUMN public.organization_youtube_content_connection_tokens.oauth_scopes IS
  'Space-separated Google OAuth scopes granted for this channel connection.';

ALTER TABLE public.social_media_scheduler_config
  ADD COLUMN IF NOT EXISTS youtube_global_in_flight integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS instagram_global_in_flight integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS linkedin_global_in_flight integer NOT NULL DEFAULT 4;

ALTER TABLE public.social_media_scheduler_config
  DROP CONSTRAINT IF EXISTS social_media_scheduler_config_in_flight;

ALTER TABLE public.social_media_scheduler_config
  ADD CONSTRAINT social_media_scheduler_config_tiktok_in_flight
    CHECK (tiktok_global_in_flight BETWEEN 1 AND 50),
  ADD CONSTRAINT social_media_scheduler_config_youtube_in_flight
    CHECK (youtube_global_in_flight BETWEEN 1 AND 50),
  ADD CONSTRAINT social_media_scheduler_config_instagram_in_flight
    CHECK (instagram_global_in_flight BETWEEN 1 AND 50),
  ADD CONSTRAINT social_media_scheduler_config_linkedin_in_flight
    CHECK (linkedin_global_in_flight BETWEEN 1 AND 50);

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
      AND COALESCE(s.locked_at, s.updated_at) < now() - interval '20 minutes'
      AND (
        (
          s.platform = 'TikTok'
          AND s.provider_config->>'tiktok_publish_id' IS NOT NULL
          AND COALESCE(s.provider_config->>'tiktok_upload_completed', 'false') = 'true'
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
  'Re-claim stale publishing rows with platform resume state (TikTok/YouTube/Instagram/LinkedIn).';

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
      AND NOT (
        (
          s.platform = 'TikTok'
          AND s.provider_config->>'tiktok_publish_id' IS NOT NULL
          AND COALESCE(s.provider_config->>'tiktok_upload_completed', 'false') = 'true'
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
  'Reset stale publishing rows without valid resume state to pending (backoff) or failed.';
