-- get_traffic_dashboard: top_pages returns columns like the UI table (path, impr, unique_sessions, clicks, median, avg, n).

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
  kpis jsonb;
  series jsonb;
  top_pages jsonb;
  top_clicks jsonb;
  utm_table jsonb;
  source_breakdown jsonb;
  funnel jsonb;
  v_from date;
  v_to date;
  v_min date;
  v_max date;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF NOT public.can_access_web_id(p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT MIN(day), MAX(day)
  INTO v_min, v_max
  FROM public.analytics_daily_sessions
  WHERE web_id = p_web_id;

  IF v_min IS NULL OR v_max IS NULL THEN
    RETURN jsonb_build_object(
      'web_id', p_web_id,
      'from', p_from,
      'to', p_to,
      'kpis', jsonb_build_object(
        'sessions', 0,
        'page_views', 0,
        'clicks', 0,
        'avg_active_ms_per_view', 0,
        'sessions_with_utm', 0,
        'sessions_with_gclid', 0
      ),
      'series', '[]'::jsonb,
      'top_pages', '[]'::jsonb,
      'top_clicks', '[]'::jsonb,
      'utm_table', '[]'::jsonb,
      'source_breakdown', '[]'::jsonb,
      'funnel', jsonb_build_object('sessions', 0, 'page_views', 0, 'clicks', 0)
    );
  END IF;

  v_from := COALESCE(p_from, v_min);
  v_to := COALESCE(p_to, v_max);

  IF v_to < v_from THEN
    RAISE EXCEPTION 'invalid range';
  END IF;

  SELECT jsonb_build_object(
    'sessions', COALESCE(SUM(s.sessions_count), 0),
    'page_views', COALESCE(SUM(pv.page_views_count), 0),
    'clicks', COALESCE(SUM(c.clicks_count), 0),
    'avg_active_ms_per_view',
      CASE
        WHEN COALESCE(SUM(pv.page_views_count), 0) = 0 THEN 0
        ELSE (COALESCE(SUM(pv.active_ms_sum), 0) / NULLIF(SUM(pv.page_views_count), 0))::bigint
      END,
    'sessions_with_utm', COALESCE(SUM(s.sessions_with_utm_count), 0),
    'sessions_with_gclid', COALESCE(SUM(s.sessions_with_gclid_count), 0)
  )
  INTO kpis
  FROM public.analytics_daily_sessions s
  LEFT JOIN public.analytics_daily_page_views pv
    ON pv.web_id = s.web_id AND pv.day = s.day
  LEFT JOIN public.analytics_daily_clicks c
    ON c.web_id = s.web_id AND c.day = s.day
  WHERE s.web_id = p_web_id
    AND s.day BETWEEN v_from AND v_to;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day', d.day,
    'sessions', d.sessions_count,
    'page_views', d.page_views_count,
    'clicks', d.clicks_count
  ) ORDER BY d.day), '[]'::jsonb)
  INTO series
  FROM (
    SELECT
      s.day,
      s.sessions_count,
      COALESCE(pv.page_views_count, 0) AS page_views_count,
      COALESCE(c.clicks_count, 0) AS clicks_count
    FROM public.analytics_daily_sessions s
    LEFT JOIN public.analytics_daily_page_views pv
      ON pv.web_id = s.web_id AND pv.day = s.day
    LEFT JOIN public.analytics_daily_clicks c
      ON c.web_id = s.web_id AND c.day = s.day
    WHERE s.web_id = p_web_id
      AND s.day BETWEEN v_from AND v_to
    ORDER BY s.day
  ) d;

  -- Top pages with derived metrics
  WITH
    base AS (
      SELECT
        tp.path,
        SUM(tp.page_views_count)::bigint AS impr,
        SUM(tp.unique_sessions_count)::bigint AS unique_sessions,
        COALESCE(SUM(tp.active_ms_sum), 0)::bigint AS active_ms_sum,
        CASE
          WHEN SUM(tp.page_views_count) = 0 THEN 0
          ELSE (SUM(tp.active_ms_sum) / NULLIF(SUM(tp.page_views_count), 0))::bigint
        END AS avg_active_ms
      FROM public.analytics_daily_top_pages tp
      WHERE tp.web_id = p_web_id
        AND tp.day BETWEEN v_from AND v_to
      GROUP BY tp.path
      ORDER BY SUM(tp.page_views_count) DESC
      LIMIT GREATEST(1, LEAST(p_top_pages_limit, 100))
    ),
    clicks_by_path AS (
      SELECT
        tc.path,
        SUM(tc.clicks_count)::bigint AS clicks
      FROM public.analytics_daily_top_clicks tc
      WHERE tc.web_id = p_web_id
        AND tc.day BETWEEN v_from AND v_to
      GROUP BY tc.path
    ),
    hist_idx AS (
      SELECT
        tp.path,
        u.idx,
        SUM(u.cnt)::bigint AS sum_cnt
      FROM public.analytics_daily_top_pages tp
      JOIN base b ON b.path = tp.path
      JOIN LATERAL unnest(tp.active_ms_hist) WITH ORDINALITY AS u(cnt, idx) ON TRUE
      WHERE tp.web_id = p_web_id
        AND tp.day BETWEEN v_from AND v_to
      GROUP BY tp.path, u.idx
    ),
    hist_arr AS (
      SELECT
        path,
        array_agg(sum_cnt ORDER BY idx)::bigint[] AS hist
      FROM hist_idx
      GROUP BY path
    )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'path', b.path,
    'impr', b.impr,
    'unique_sessions', b.unique_sessions,
    'clicks', COALESCE(c.clicks, 0),
    'median_active_ms', public.active_ms_percentile_from_hist(h.hist, 0.5),
    'avg_active_ms', b.avg_active_ms,
    'n', b.unique_sessions
  ) ORDER BY b.impr DESC), '[]'::jsonb)
  INTO top_pages
  FROM base b
  LEFT JOIN clicks_by_path c ON c.path = b.path
  LEFT JOIN hist_arr h ON h.path = b.path;

  -- Existing top_clicks list (element breakdown) unchanged
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'path', path,
    'track_key', NULLIF(track_key, ''),
    'element_type', element_type,
    'element_label', element_label,
    'clicks', clicks
  ) ORDER BY clicks DESC), '[]'::jsonb)
  INTO top_clicks
  FROM (
    SELECT
      tc.path,
      tc.track_key,
      tc.element_type,
      tc.element_label,
      SUM(tc.clicks_count)::bigint AS clicks
    FROM public.analytics_daily_top_clicks tc
    WHERE tc.web_id = p_web_id
      AND tc.day BETWEEN v_from AND v_to
    GROUP BY tc.path, tc.track_key, tc.element_type, tc.element_label
    ORDER BY SUM(tc.clicks_count) DESC
    LIMIT GREATEST(1, LEAST(p_top_clicks_limit, 100))
  ) t;

  -- UTM table unchanged
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'route', NULLIF(route, ''),
    'utm_campaign', utm_campaign,
    'utm_source', utm_source,
    'utm_medium', utm_medium,
    'utm_content', utm_content,
    'utm_term', utm_term,
    'sessions', sessions,
    'page_views', page_views,
    'clicks', clicks
  ) ORDER BY sessions DESC), '[]'::jsonb)
  INTO utm_table
  FROM (
    SELECT
      u.route,
      NULLIF(u.utm_campaign, '') AS utm_campaign,
      NULLIF(u.utm_source, '') AS utm_source,
      NULLIF(u.utm_medium, '') AS utm_medium,
      NULLIF(u.utm_content, '') AS utm_content,
      NULLIF(u.utm_term, '') AS utm_term,
      SUM(u.sessions_count)::bigint AS sessions,
      SUM(u.page_views_count)::bigint AS page_views,
      SUM(u.clicks_count)::bigint AS clicks
    FROM public.analytics_daily_utm u
    WHERE u.web_id = p_web_id
      AND u.day BETWEEN v_from AND v_to
    GROUP BY u.route, u.utm_campaign, u.utm_source, u.utm_medium, u.utm_content, u.utm_term
    HAVING COALESCE(
      NULLIF(trim(u.utm_source), ''),
      NULLIF(trim(u.utm_medium), ''),
      NULLIF(trim(u.utm_campaign), ''),
      NULLIF(trim(u.utm_content), ''),
      NULLIF(trim(u.utm_term), '')
    ) IS NOT NULL
    ORDER BY SUM(u.sessions_count) DESC
    LIMIT GREATEST(1, LEAST(p_utm_limit, 2000))
  ) t;

  -- source_breakdown unchanged (rollup)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', agg.source_key,
        'label', agg.lbl,
        'sessions', agg.sessions,
        'page_views', agg.page_views,
        'clicks', agg.clicks
      )
      ORDER BY agg.ord
    ),
    '[]'::jsonb
  )
  INTO source_breakdown
  FROM (
    SELECT
      q.source_key,
      CASE q.source_key
        WHEN 'utm' THEN 'UTM / kampanye (minimal satu parameter utm_* terisi)'
        WHEN 'paid_click_ids' THEN 'Iklan berbayar (gclid / fbclid / msclkid / gbraid / wbraid) tanpa UTM lengkap'
        WHEN 'referral' THEN 'Rujukan (referrer terisi)'
        WHEN 'direct' THEN 'Langsung (tanpa referrer & tanpa UTM / click id)'
        ELSE q.source_key
      END AS lbl,
      q.sessions,
      q.page_views,
      q.clicks,
      CASE q.source_key
        WHEN 'utm' THEN 1
        WHEN 'paid_click_ids' THEN 2
        WHEN 'referral' THEN 3
        WHEN 'direct' THEN 4
        ELSE 9
      END AS ord
    FROM (
      SELECT
        b.source_key,
        SUM(b.sessions_count)::bigint AS sessions,
        SUM(b.page_views_count)::bigint AS page_views,
        SUM(b.clicks_count)::bigint AS clicks
      FROM public.analytics_daily_source_breakdown b
      WHERE b.web_id = p_web_id
        AND b.day BETWEEN v_from AND v_to
      GROUP BY b.source_key
    ) q
  ) agg;

  funnel := jsonb_build_object(
    'sessions', (kpis->>'sessions')::bigint,
    'page_views', (kpis->>'page_views')::bigint,
    'clicks', (kpis->>'clicks')::bigint
  );

  RETURN jsonb_build_object(
    'web_id', p_web_id,
    'from', v_from,
    'to', v_to,
    'kpis', kpis,
    'series', series,
    'top_pages', top_pages,
    'top_clicks', top_clicks,
    'utm_table', utm_table,
    'source_breakdown', source_breakdown,
    'funnel', funnel
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) TO authenticated;

