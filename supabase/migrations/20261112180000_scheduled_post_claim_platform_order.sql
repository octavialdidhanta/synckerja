-- Claim only the earliest unpublished platform of each plan.
-- Order: Facebook, Instagram, LinkedIn, TikTok, YouTube, then platform_account_id.

CREATE OR REPLACE FUNCTION public.scheduled_post_platform_rank(p_platform text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    array_position(
      ARRAY['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube']::text[],
      p_platform
    ),
    100
  );
$$;

REVOKE ALL ON FUNCTION public.scheduled_post_platform_rank(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.scheduled_post_platform_rank(text) FROM anon, authenticated;

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
      AND NOT EXISTS (
        SELECT 1
        FROM public.social_media_scheduled_posts earlier
        WHERE earlier.social_media_plan_id = s.social_media_plan_id
          AND earlier.id <> s.id
          AND earlier.status NOT IN ('published', 'cancelled')
          AND (
            public.scheduled_post_platform_rank(earlier.platform)
              < public.scheduled_post_platform_rank(s.platform)
            OR (
              public.scheduled_post_platform_rank(earlier.platform)
                = public.scheduled_post_platform_rank(s.platform)
              AND COALESCE(earlier.platform_account_id, '')
                < COALESCE(s.platform_account_id, '')
            )
          )
      )
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
  'Claim due pending rows. A later platform waits until every earlier platform on the same plan is published.';
