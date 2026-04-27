-- Improve Top Pages median accuracy:
-- - Ignore NULL active_ms (don't treat as 0s bucket)
-- - Use bucket midpoint for percentile estimate to reduce downward bias

CREATE OR REPLACE FUNCTION public.active_ms_hist_bucket_idx(p_active_ms bigint)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN p_active_ms IS NULL THEN NULL
      WHEN p_active_ms <= 0 THEN 1
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
  lower_ms bigint;
  width_ms bigint;
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
      IF i <= 61 THEN
        lower_ms := ((i - 1)::bigint) * 1000;
        width_ms := 1000;
        RETURN lower_ms + (width_ms / 2);
      ELSIF i <= 109 THEN
        lower_ms := (60::bigint + (i - 61)::bigint * 5) * 1000;
        width_ms := 5000;
        RETURN lower_ms + (width_ms / 2);
      ELSE
        -- Open-ended bucket: return its lower bound (300s) as "300s+"
        RETURN 300000;
      END IF;
    END IF;
  END LOOP;

  RETURN 300000;
END;
$$;

