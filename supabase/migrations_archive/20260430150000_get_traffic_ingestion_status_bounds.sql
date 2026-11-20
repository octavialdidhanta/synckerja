-- get_traffic_ingestion_status: add aggregate (daily) min/max day so the UI can warn on empty date filters.

CREATE OR REPLACE FUNCTION public.get_traffic_ingestion_status(p_web_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_exists boolean;
  daily_exists boolean;
  agg_min date;
  agg_max date;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF NOT public.can_access_web_id(p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  raw_exists :=
    EXISTS (SELECT 1 FROM public.analytics_sessions s WHERE s.web_id = p_web_id LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id LIMIT 1);

  daily_exists := EXISTS (
    SELECT 1 FROM public.analytics_daily_sessions d WHERE d.web_id = p_web_id LIMIT 1
  );

  SELECT MIN(day), MAX(day)
  INTO agg_min, agg_max
  FROM public.analytics_daily_sessions
  WHERE web_id = p_web_id;

  RETURN jsonb_build_object(
    'raw_events_exist', raw_exists,
    'daily_rollups_exist', daily_exists,
    'aggregate_day_min', agg_min,
    'aggregate_day_max', agg_max,
    'data_status', CASE
      WHEN NOT raw_exists THEN 'no_ingested_data'
      WHEN NOT daily_exists THEN 'rollups_not_built'
      ELSE 'ok'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_traffic_ingestion_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_traffic_ingestion_status(text) TO authenticated;
