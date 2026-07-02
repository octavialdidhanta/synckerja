-- Facebook Reels auto-publish: scheduler cap + resume claim for Facebook uploads.

ALTER TABLE public.social_media_scheduler_config
  ADD COLUMN IF NOT EXISTS facebook_global_in_flight integer NOT NULL DEFAULT 4;

ALTER TABLE public.social_media_scheduler_config
  DROP CONSTRAINT IF EXISTS social_media_scheduler_config_facebook_in_flight;

ALTER TABLE public.social_media_scheduler_config
  ADD CONSTRAINT social_media_scheduler_config_facebook_in_flight
    CHECK (facebook_global_in_flight BETWEEN 1 AND 50);

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
          s.platform = 'Facebook'
          AND s.provider_config->>'fb_video_id' IS NOT NULL
          AND COALESCE(s.provider_config->>'fb_upload_phase', '') IN ('uploaded', 'published')
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
  'Re-claim stale publishing rows with platform resume state (TikTok/YouTube/Instagram/Facebook/LinkedIn).';
