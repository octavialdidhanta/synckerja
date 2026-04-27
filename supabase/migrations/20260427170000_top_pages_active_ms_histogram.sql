-- Top pages: store per-day active_ms histogram per path for scalable median/pXX.

ALTER TABLE public.analytics_daily_top_pages
  ADD COLUMN IF NOT EXISTS active_ms_hist bigint[] NOT NULL
  DEFAULT array_fill(0::bigint, ARRAY[110]);

-- Helper: bucket index for active_ms (ms) into 110 buckets (1-based).
-- Buckets:
-- 1..61   => 0..60 seconds (1-second buckets)
-- 62..109 => 65..300 seconds (5-second buckets)
-- 110     => >300 seconds
CREATE OR REPLACE FUNCTION public.active_ms_hist_bucket_idx(p_active_ms bigint)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN p_active_ms IS NULL OR p_active_ms <= 0 THEN 1
      ELSE
        CASE
          WHEN floor(p_active_ms / 1000.0) <= 60
            THEN floor(p_active_ms / 1000.0)::int + 1
          WHEN floor(p_active_ms / 1000.0) <= 300
            THEN 61 + ((floor(p_active_ms / 1000.0)::int - 60 + 4) / 5)
          ELSE 110
        END
    END;
$$;

-- Helper: approximate percentile from histogram.
CREATE OR REPLACE FUNCTION public.active_ms_percentile_from_hist(p_hist bigint[], p_percentile double precision)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  total bigint := 0;
  target bigint := 0;
  cum bigint := 0;
  i int;
  sec int;
BEGIN
  IF p_hist IS NULL OR array_length(p_hist, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOR i IN 1..array_length(p_hist, 1) LOOP
    total := total + COALESCE(p_hist[i], 0);
  END LOOP;

  IF total <= 0 THEN
    RETURN 0;
  END IF;

  -- Clamp percentile.
  IF p_percentile IS NULL THEN
    target := (total + 1) / 2;
  ELSE
    IF p_percentile < 0 THEN p_percentile := 0; END IF;
    IF p_percentile > 1 THEN p_percentile := 1; END IF;
    target := greatest(1, ceil(p_percentile * total)::bigint);
  END IF;

  FOR i IN 1..array_length(p_hist, 1) LOOP
    cum := cum + COALESCE(p_hist[i], 0);
    IF cum >= target THEN
      -- Return lower bound of bucket in ms (good enough for UI median).
      IF i <= 61 THEN
        sec := i - 1;
        RETURN (sec::bigint) * 1000;
      ELSIF i <= 109 THEN
        sec := 60 + (i - 61) * 5;
        RETURN (sec::bigint) * 1000;
      ELSE
        RETURN 300000; -- 300s
      END IF;
    END IF;
  END LOOP;

  RETURN 300000;
END;
$$;

