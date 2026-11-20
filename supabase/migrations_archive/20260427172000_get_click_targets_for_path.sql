-- RPC: get click targets breakdown for a specific path (fast via daily rollup table).

CREATE OR REPLACE FUNCTION public.get_click_targets_for_path(
  p_web_id text,
  p_from date,
  p_to date,
  p_path text,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date;
  v_to date;
  v_min date;
  v_max date;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF p_path IS NULL OR trim(p_path) = '' THEN
    RAISE EXCEPTION 'path is required';
  END IF;

  IF NOT public.can_access_web_id(p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT MIN(day), MAX(day)
  INTO v_min, v_max
  FROM public.analytics_daily_sessions
  WHERE web_id = p_web_id;

  IF v_min IS NULL OR v_max IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_from := COALESCE(p_from, v_min);
  v_to := COALESCE(p_to, v_max);

  IF v_to < v_from THEN
    RAISE EXCEPTION 'invalid range';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'clicks', clicks,
      'unique_sessions', unique_sessions,
      'track_key', NULLIF(track_key, ''),
      'element_type', element_type,
      'element_label', element_label,
      'target_url', NULLIF(target_url, ''),
      'is_internal', is_internal
    ) ORDER BY clicks DESC), '[]'::jsonb)
    FROM (
      SELECT
        SUM(t.clicks_count)::bigint AS clicks,
        SUM(t.unique_sessions_count)::bigint AS unique_sessions,
        t.track_key,
        t.element_type,
        t.element_label,
        t.target_url,
        t.is_internal
      FROM public.analytics_daily_top_click_targets t
      WHERE t.web_id = p_web_id
        AND t.day BETWEEN v_from AND v_to
        AND t.path = p_path
      GROUP BY t.track_key, t.element_type, t.element_label, t.target_url, t.is_internal
      ORDER BY SUM(t.clicks_count) DESC
      LIMIT GREATEST(1, LEAST(p_limit, 200))
    ) s
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_click_targets_for_path(text, date, date, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_click_targets_for_path(text, date, date, text, int) TO authenticated;

