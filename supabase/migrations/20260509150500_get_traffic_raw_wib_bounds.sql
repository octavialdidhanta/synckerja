-- Dipakai edge `traffic-refresh-rollups` untuk mode Maximum (from/to null): min/max hari kalender WIB dari raw events.

CREATE OR REPLACE FUNCTION public.get_traffic_raw_wib_bounds(p_web_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min date;
  v_max date;
BEGIN
  IF p_web_id IS NULL OR btrim(p_web_id) = '' THEN
    RETURN NULL;
  END IF;

  SELECT
    LEAST(
      (SELECT MIN((timezone('Asia/Jakarta', s.started_at))::date) FROM public.analytics_sessions s WHERE s.web_id = p_web_id),
      (SELECT MIN((timezone('Asia/Jakarta', pv.started_at))::date) FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id),
      (SELECT MIN((timezone('Asia/Jakarta', ce.created_at))::date) FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id)
    ),
    GREATEST(
      (SELECT MAX((timezone('Asia/Jakarta', s.started_at))::date) FROM public.analytics_sessions s WHERE s.web_id = p_web_id),
      (SELECT MAX((timezone('Asia/Jakarta', pv.started_at))::date) FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id),
      (SELECT MAX((timezone('Asia/Jakarta', ce.created_at))::date) FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id)
    )
  INTO v_min, v_max;

  IF v_min IS NULL OR v_max IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'day_min', to_char(v_min, 'YYYY-MM-DD'),
    'day_max', to_char(v_max, 'YYYY-MM-DD')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_traffic_raw_wib_bounds(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_traffic_raw_wib_bounds(text) TO service_role;
