-- Helper for Web Traffic UI: distinguish "no events yet" vs "raw exists but daily rollups not built" (use Sync data).

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

  RETURN jsonb_build_object(
    'raw_events_exist', raw_exists,
    'daily_rollups_exist', daily_exists,
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
