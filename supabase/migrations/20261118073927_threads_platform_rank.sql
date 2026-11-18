-- Threads is claimed after YouTube. The first five platforms stay in the same order.

CREATE OR REPLACE FUNCTION public.scheduled_post_platform_rank(p_platform text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    array_position(
      ARRAY['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Threads']::text[],
      p_platform
    ),
    100
  );
$$;

REVOKE ALL ON FUNCTION public.scheduled_post_platform_rank(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.scheduled_post_platform_rank(text) FROM anon, authenticated;
