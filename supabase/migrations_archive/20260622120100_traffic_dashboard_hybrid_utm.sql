-- UTM Tracking hybrid model: session summary row + journey row per page_view.

ALTER FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int)
  RENAME TO get_traffic_dashboard_base_before_hybrid_utm;

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
  utm_table jsonb;
  v_from date;
  v_to date;
BEGIN
  base_payload := public.get_traffic_dashboard_base_before_hybrid_utm(
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
    active_sessions AS (
      SELECT DISTINCT pv.session_id
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      UNION
      SELECT DISTINCT ce.session_id
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    session_attribution AS (
      SELECT
        s.id AS session_id,
        COALESCE(NULLIF(btrim(s.visitor_id), ''), s.id::text) AS visit_key,
        NULLIF(btrim(s.visitor_id), '') AS visitor_id,
        public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url) AS first_landing_url,
        public.traffic_effective_utm_source(
          s.first_utm_source, s.utm_source, s.last_utm_source,
          public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url)
        ) AS utm_source_eff,
        public.traffic_effective_utm_medium(
          s.first_utm_medium, s.utm_medium, s.last_utm_medium,
          public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url)
        ) AS utm_medium_eff,
        public.traffic_effective_utm_campaign(
          s.first_utm_campaign, s.utm_campaign, s.last_utm_campaign,
          public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url)
        ) AS utm_campaign_eff,
        public.traffic_effective_utm_content(
          s.first_utm_content, s.utm_content, s.last_utm_content,
          public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url)
        ) AS utm_content_eff,
        public.traffic_effective_utm_term(
          s.first_utm_term, s.utm_term, s.last_utm_term,
          public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url)
        ) AS utm_term_eff,
        public.traffic_classify_session_source_key(
          s.first_utm_source, s.utm_source, s.last_utm_source,
          s.first_utm_medium, s.utm_medium, s.last_utm_medium,
          s.first_utm_campaign, s.utm_campaign, s.last_utm_campaign,
          s.first_utm_content, s.utm_content, s.last_utm_content,
          s.first_utm_term, s.utm_term, s.last_utm_term,
          s.first_landing_url, s.landing_url, s.last_landing_url,
          s.has_gclid, s.first_has_gclid, s.last_has_gclid,
          s.has_fbclid, s.first_has_fbclid, s.last_has_fbclid,
          s.has_msclkid, s.has_gbraid, s.has_wbraid,
          s.first_referrer, s.referrer, s.last_referrer
        ) AS source_key
      FROM public.analytics_sessions s
      INNER JOIN active_sessions act ON act.session_id = s.id
      WHERE s.web_id = p_web_id
    ),
    page_events AS (
      SELECT pv.session_id, pv.started_at AS occurred_at, pv.started_at AS page_view_at, NULL::timestamptz AS click_at
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    click_events AS (
      SELECT ce.session_id, ce.created_at AS occurred_at, NULL::timestamptz AS page_view_at, ce.created_at AS click_at
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    all_events AS (
      SELECT * FROM page_events
      UNION ALL
      SELECT * FROM click_events
    ),
    session_metrics AS (
      SELECT
        e.session_id,
        MIN(e.occurred_at) AS occurred_at,
        COUNT(*) FILTER (WHERE e.page_view_at IS NOT NULL)::bigint AS page_views,
        COUNT(*) FILTER (WHERE e.click_at IS NOT NULL)::bigint AS clicks
      FROM all_events e
      GROUP BY e.session_id
    ),
    scroll_metrics AS (
      SELECT pv.session_id, MAX(pv.scroll_max_pct)::double precision AS max_deep_scroll_pct
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND pv.scroll_max_pct IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY pv.session_id
    ),
    ranked_sessions AS (
      SELECT
        sa.visit_key,
        sa.visitor_id,
        sa.session_id,
        sm.occurred_at,
        coalesce(
          left(
            CASE
              WHEN lp.route_path = '' AND lp.had_landing_ref THEN '/'
              WHEN lp.route_path = '' THEN ''
              WHEN left(lp.route_path, 1) = '/' THEN lp.route_path
              ELSE '/' || lp.route_path
            END,
            512
          ),
          ''
        ) AS route,
        sa.utm_campaign_eff AS utm_campaign,
        sa.utm_source_eff AS utm_source,
        sa.utm_medium_eff AS utm_medium,
        sa.utm_content_eff AS utm_content,
        sa.utm_term_eff AS utm_term,
        COALESCE(sm.page_views, 0)::bigint AS page_views,
        COALESCE(sm.clicks, 0)::bigint AS clicks,
        sc.max_deep_scroll_pct
      FROM session_attribution sa
      INNER JOIN session_metrics sm ON sm.session_id = sa.session_id
      LEFT JOIN scroll_metrics sc ON sc.session_id = sa.session_id
      CROSS JOIN LATERAL (
        SELECT
          coalesce(
            trim(both '/' FROM regexp_replace(
              regexp_replace(coalesce(sa.first_landing_url, ''), '^https?://[^/]+', '', 'i'),
              '[?#].*$',
              ''
            )),
            ''
          ) AS route_path,
          nullif(btrim(sa.first_landing_url), '') IS NOT NULL AS had_landing_ref
      ) lp
      WHERE sa.source_key IN ('utm', 'paid_click_ids')
      ORDER BY sm.occurred_at DESC, sa.session_id
      LIMIT GREATEST(1, LEAST(p_utm_limit, 2000))
    ),
    session_rows AS (
      SELECT
        'session'::text AS row_kind,
        rs.visit_key,
        rs.visitor_id,
        rs.session_id,
        rs.session_id AS parent_session_id,
        NULL::uuid AS page_view_id,
        rs.occurred_at,
        rs.route,
        rs.utm_campaign,
        rs.utm_source,
        rs.utm_medium,
        rs.utm_content,
        rs.utm_term,
        rs.page_views,
        rs.clicks,
        rs.max_deep_scroll_pct,
        rs.occurred_at AS session_sort_at
      FROM ranked_sessions rs
    ),
    journey_rows AS (
      SELECT
        'journey'::text AS row_kind,
        rs.visit_key,
        rs.visitor_id,
        rs.session_id,
        rs.session_id AS parent_session_id,
        pv.id AS page_view_id,
        pv.started_at AS occurred_at,
        public.traffic_path_key(pv.path) AS route,
        rs.utm_campaign,
        rs.utm_source,
        rs.utm_medium,
        rs.utm_content,
        rs.utm_term,
        1::bigint AS page_views,
        (
          SELECT COUNT(*)::bigint
          FROM public.analytics_click_events ce
          WHERE ce.web_id = p_web_id
            AND ce.session_id = rs.session_id
            AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
            AND public.traffic_path_key(ce.path) = public.traffic_path_key(pv.path)
        ) AS clicks,
        pv.scroll_max_pct AS max_deep_scroll_pct,
        rs.occurred_at AS session_sort_at
      FROM ranked_sessions rs
      INNER JOIN public.analytics_page_views pv
        ON pv.session_id = rs.session_id
        AND pv.web_id = p_web_id
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    combined AS (
      SELECT * FROM session_rows
      UNION ALL
      SELECT * FROM journey_rows
    )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'row_kind', row_kind,
    'visit_key', visit_key,
    'visitor_id', visitor_id,
    'session_id', session_id,
    'parent_session_id', parent_session_id,
    'page_view_id', page_view_id,
    'occurred_at', occurred_at,
    'time_label', to_char(occurred_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI'),
    'day', (occurred_at AT TIME ZONE 'Asia/Jakarta')::date,
    'route', NULLIF(route, ''),
    'utm_campaign', utm_campaign,
    'utm_source', utm_source,
    'utm_medium', utm_medium,
    'utm_content', utm_content,
    'utm_term', utm_term,
    'sessions', CASE WHEN row_kind = 'session' THEN 1 ELSE 0 END,
    'page_views', page_views,
    'clicks', clicks,
    'max_deep_scroll_pct', max_deep_scroll_pct,
    'avg_max_deep_scroll_pct', max_deep_scroll_pct,
    'scroll_sessions', CASE WHEN max_deep_scroll_pct IS NULL THEN 0 ELSE 1 END
  ) ORDER BY session_sort_at DESC, session_id, CASE row_kind WHEN 'session' THEN 0 ELSE 1 END, occurred_at ASC), '[]'::jsonb)
  INTO utm_table
  FROM combined;

  RETURN jsonb_set(base_payload, '{utm_table}', utm_table, true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) TO authenticated;

COMMENT ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) IS
  'Dashboard RPC; UTM table hybrid: one session summary row plus journey row per page_view (first-touch UTM).';
