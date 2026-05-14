-- Dipanggil edge traffic-refresh-rollups (service_role) sebelum refresh_analytics_daily_rollups.
-- Menghindari kegagalan .delete() lewat PostgREST / RLS / eksposur API pada tabel rollup.

CREATE OR REPLACE FUNCTION public.clear_analytics_rollups_slice_for_traffic_sync(
  p_web_id text,
  p_from date,
  p_to date
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

  DELETE FROM public.analytics_daily_utm u
  WHERE u.web_id = p_web_id
    AND u.day BETWEEN p_from AND p_to;

  DELETE FROM public.analytics_daily_source_breakdown d
  WHERE d.web_id = p_web_id
    AND d.day BETWEEN p_from AND p_to;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_analytics_rollups_slice_for_traffic_sync(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_analytics_rollups_slice_for_traffic_sync(text, date, date) TO service_role;
