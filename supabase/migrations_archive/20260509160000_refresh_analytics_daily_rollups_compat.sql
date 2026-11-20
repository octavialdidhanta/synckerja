-- Edge `traffic-refresh-rollups` memanggil RPC ini setelah clear slice.
-- Banyak project hanya punya fungsi custom di DB (tidak ada di repo); error umum:
-- duplicate key pada `analytics_daily_utm_pkey1` (UNIQUE legacy) atau isi fungsi yang bentrok.
--
-- 1) Buang UNIQUE bernama pkey1 jika itu benar-benar constraint UNIQUE (bukan PRIMARY KEY).
-- 2) Pasang implementasi aman: delegasi ke `refresh_analytics_rollups` (sudah ada di migrasi repo).

DO $$
BEGIN
  IF to_regclass('public.analytics_daily_utm') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.analytics_daily_utm'::regclass
      AND c.conname = 'analytics_daily_utm_pkey1'
      AND c.contype = 'u'
  ) THEN
    ALTER TABLE public.analytics_daily_utm DROP CONSTRAINT analytics_daily_utm_pkey1;
  END IF;
END $$;

-- Hapus overload lama agar tidak ambiguous di PostgREST.
DROP FUNCTION IF EXISTS public.refresh_analytics_daily_rollups(text, date, date);
DROP FUNCTION IF EXISTS public.refresh_analytics_daily_rollups(date, date, text);

CREATE OR REPLACE FUNCTION public.refresh_analytics_daily_rollups(
  p_from date,
  p_to date,
  p_web_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_web_id IS NULL OR btrim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'from/to are required';
  END IF;
  IF p_to < p_from THEN
    RAISE EXCEPTION 'invalid range';
  END IF;

  -- Slice UTM + source_breakdown sudah dihapus edge; isi ulang sejalan dengan rollup canonical.
  PERFORM public.refresh_analytics_rollups(p_web_id, p_from, p_to);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_analytics_daily_rollups(date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_daily_rollups(date, date, text) TO service_role;
