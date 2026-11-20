-- Align Top pages "Sesi unik" with the visitor_id session basis used by KPI,
-- Sumber Traffic, and UTM Tracking.

ALTER FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int)
  RENAME TO get_traffic_dashboard_base_before_top_pages_visitor_id_basis;

CREATE OR REPLACE FUNCTION public.get_traffic_dashboard(
  p_web_id text,
  p_from date,
  p_to date,
  p_top_pages_limit int DEFAULT 15,
  p_top_clicks_limit int DEFAULT 15,
  p_utm_limit int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_payload jsonb;
  top_pages jsonb;
  v_from date;
  v_to date;
BEGIN
  base_payload := public.get_traffic_dashboard_base_before_top_pages_visitor_id_basis(
    p_web_id,
    p_from,
    p_to,
    p_top_pages_limit,
    p_top_clicks_limit,
    p_utm_limit
  );

  v_from := NULLIF(base_payload->>'from', '')::date;
  v_to := NULLIF(base_payload->>'to', '')::date;

  IF v_from IS NULL OR v_to IS NULL THEN
    RETURN base_payload;
  END IF;

  WITH
    page_events AS (
      SELECT
        public.traffic_path_key(pv.path) AS path,
        COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), pv.session_id::text) AS visit_key,
        COALESCE(pv.active_ms, 0)::bigint AS active_ms,
        pv.scroll_max_pct
      FROM public.analytics_page_views pv
      LEFT JOIN public.analytics_sessions s
        ON s.id = pv.session_id AND s.web_id = pv.web_id
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    base AS (
      SELECT
        path,
        COUNT(*)::bigint AS impr,
        COUNT(DISTINCT visit_key)::bigint AS unique_sessions,
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY active_ms), 0)::bigint AS median_active_ms,
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE (SUM(active_ms) / NULLIF(COUNT(*), 0))::bigint
        END AS avg_active_ms
      FROM page_events
      WHERE path IS NOT NULL
      GROUP BY path
      ORDER BY COUNT(*) DESC
      LIMIT GREATEST(1, LEAST(p_top_pages_limit, 100))
    ),
    clicks_by_path AS (
      SELECT
        public.traffic_path_key(ce.path) AS path,
        COUNT(*)::bigint AS clicks
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY public.traffic_path_key(ce.path)
    ),
    click_targets_agg AS (
      SELECT
        t.path,
        t.track_key,
        t.element_type,
        t.element_label,
        t.target_url,
        t.is_internal
      FROM (
        SELECT
          public.traffic_path_key(ce.path) AS path,
          ce.track_key,
          ce.element_type,
          ce.element_label,
          ce.target_url,
          ce.is_internal,
          COUNT(*)::bigint AS clicks,
          ROW_NUMBER() OVER (
            PARTITION BY public.traffic_path_key(ce.path)
            ORDER BY COUNT(*) DESC, COALESCE(ce.is_internal, false) DESC, ce.target_url ASC
          ) AS rn
        FROM public.analytics_click_events ce
        WHERE ce.web_id = p_web_id
          AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
        GROUP BY
          public.traffic_path_key(ce.path),
          ce.track_key,
          ce.element_type,
          ce.element_label,
          ce.target_url,
          ce.is_internal
      ) t
      WHERE t.rn = 1
    ),
    per_visit_path_scroll AS (
      SELECT
        path,
        visit_key,
        MAX(scroll_max_pct)::double precision AS max_scroll_pct
      FROM page_events
      WHERE scroll_max_pct IS NOT NULL
        AND path IS NOT NULL
      GROUP BY path, visit_key
    ),
    scroll_by_path AS (
      SELECT
        path,
        MAX(max_scroll_pct)::double precision AS max_deep_scroll_pct,
        AVG(max_scroll_pct)::double precision AS avg_max_deep_scroll_pct
      FROM per_visit_path_scroll
      GROUP BY path
    )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'path', b.path,
    'impr', b.impr,
    'unique_sessions', b.unique_sessions,
    'clicks', COALESCE(c.clicks, 0),
    'median_active_ms', b.median_active_ms,
    'avg_active_ms', b.avg_active_ms,
    'n', b.unique_sessions,
    'max_deep_scroll_pct', sc.max_deep_scroll_pct,
    'avg_max_deep_scroll_pct', sc.avg_max_deep_scroll_pct,
    'click_event_name', 'click',
    'click_track_key', NULLIF(ct.track_key, ''),
    'click_element_type', ct.element_type,
    'click_element_label', ct.element_label,
    'click_target_url', NULLIF(ct.target_url, ''),
    'click_is_internal', ct.is_internal
  ) ORDER BY b.impr DESC), '[]'::jsonb)
  INTO top_pages
  FROM base b
  LEFT JOIN clicks_by_path c ON c.path = b.path
  LEFT JOIN click_targets_agg ct ON ct.path = b.path
  LEFT JOIN scroll_by_path sc ON sc.path = b.path;

  RETURN jsonb_set(base_payload, '{top_pages}', top_pages, true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) TO authenticated;

COMMENT ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) IS
  'Dashboard RPC wrapper; Top pages unique sessions use visitor_id with session_id fallback.';
