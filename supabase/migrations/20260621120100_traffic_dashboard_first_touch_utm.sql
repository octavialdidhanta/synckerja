-- UTM Tracking + Sumber Traffic use first-touch session attribution (SPA-safe).
-- UTM table: one row per session_id. Source breakdown classifies each session independently.

ALTER FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int)
  RENAME TO get_traffic_dashboard_base_before_first_touch_utm;

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
  source_breakdown jsonb;
  utm_table jsonb;
  unified_sessions bigint;
  unified_page_views bigint;
  unified_clicks bigint;
  v_from date;
  v_to date;
BEGIN
  base_payload := public.get_traffic_dashboard_base_before_first_touch_utm(
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
        s.web_id,
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
      SELECT
        pv.session_id,
        pv.started_at AS occurred_at,
        pv.started_at AS page_view_at,
        NULL::timestamptz AS click_at,
        pv.active_ms,
        pv.scroll_max_pct,
        pv.ended_at,
        pv.started_at
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    click_events AS (
      SELECT
        ce.session_id,
        ce.created_at AS occurred_at,
        NULL::timestamptz AS page_view_at,
        ce.created_at AS click_at,
        NULL::bigint AS active_ms,
        NULL::double precision AS scroll_max_pct,
        NULL::timestamptz AS ended_at,
        ce.created_at AS started_at
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
      SELECT
        pv.session_id,
        MAX(pv.scroll_max_pct)::double precision AS max_deep_scroll_pct
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND pv.scroll_max_pct IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY pv.session_id
    ),
    enriched AS (
      SELECT
        sa.session_id,
        sa.visit_key,
        sa.visitor_id,
        sa.source_key,
        sm.occurred_at,
        sm.page_views,
        sm.clicks,
        sc.max_deep_scroll_pct,
        sa.first_landing_url,
        sa.utm_source_eff,
        sa.utm_medium_eff,
        sa.utm_campaign_eff,
        sa.utm_content_eff,
        sa.utm_term_eff
      FROM session_attribution sa
      INNER JOIN session_metrics sm ON sm.session_id = sa.session_id
      LEFT JOIN scroll_metrics sc ON sc.session_id = sa.session_id
    )
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(page_views), 0)::bigint,
    COALESCE(SUM(clicks), 0)::bigint
  INTO unified_sessions, unified_page_views, unified_clicks
  FROM enriched;

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
        s.web_id,
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
      SELECT
        pv.session_id,
        pv.started_at AS occurred_at,
        pv.started_at AS page_view_at,
        NULL::timestamptz AS click_at
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    click_events AS (
      SELECT
        ce.session_id,
        ce.created_at AS occurred_at,
        NULL::timestamptz AS page_view_at,
        ce.created_at AS click_at
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
      SELECT
        pv.session_id,
        MAX(pv.scroll_max_pct)::double precision AS max_deep_scroll_pct
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND pv.scroll_max_pct IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY pv.session_id
    ),
    enriched AS (
      SELECT
        sa.session_id,
        sa.visit_key,
        sa.visitor_id,
        sa.source_key,
        sm.occurred_at,
        sm.page_views,
        sm.clicks,
        sc.max_deep_scroll_pct,
        sa.first_landing_url,
        sa.utm_source_eff,
        sa.utm_medium_eff,
        sa.utm_campaign_eff,
        sa.utm_content_eff,
        sa.utm_term_eff
      FROM session_attribution sa
      INNER JOIN session_metrics sm ON sm.session_id = sa.session_id
      LEFT JOIN scroll_metrics sc ON sc.session_id = sa.session_id
    ),
    source_rows AS (
      SELECT
        source_key,
        COUNT(*)::bigint AS sessions,
        COALESCE(SUM(page_views), 0)::bigint AS page_views,
        COALESCE(SUM(clicks), 0)::bigint AS clicks,
        MAX(max_deep_scroll_pct)::double precision AS max_deep_scroll_pct,
        CASE
          WHEN COUNT(*) FILTER (WHERE max_deep_scroll_pct IS NOT NULL) = 0 THEN NULL
          ELSE (
            SUM(max_deep_scroll_pct) FILTER (WHERE max_deep_scroll_pct IS NOT NULL)
            / NULLIF(COUNT(*) FILTER (WHERE max_deep_scroll_pct IS NOT NULL), 0)
          )::double precision
        END AS avg_max_deep_scroll_pct,
        COUNT(*) FILTER (WHERE max_deep_scroll_pct IS NOT NULL)::bigint AS scroll_sessions
      FROM enriched
      GROUP BY source_key
    ),
    ordered AS (
      SELECT
        source_key,
        CASE source_key
          WHEN 'utm' THEN 'UTM / kampanye (minimal satu parameter utm_* terisi)'
          WHEN 'paid_click_ids' THEN 'Iklan berbayar (gclid / fbclid / msclkid / gbraid / wbraid) tanpa UTM lengkap'
          WHEN 'referral' THEN 'Rujukan (referrer terisi)'
          WHEN 'direct' THEN 'Langsung (tanpa referrer & tanpa UTM / click id)'
          ELSE source_key
        END AS label,
        sessions,
        page_views,
        clicks,
        max_deep_scroll_pct,
        avg_max_deep_scroll_pct,
        scroll_sessions,
        CASE source_key
          WHEN 'utm' THEN 1
          WHEN 'paid_click_ids' THEN 2
          WHEN 'referral' THEN 3
          WHEN 'direct' THEN 4
          ELSE 9
        END AS ord
      FROM source_rows
    )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'key', source_key,
    'label', label,
    'sessions', sessions,
    'page_views', page_views,
    'clicks', clicks,
    'max_deep_scroll_pct', max_deep_scroll_pct,
    'avg_max_deep_scroll_pct', avg_max_deep_scroll_pct,
    'scroll_sessions', scroll_sessions
  ) ORDER BY ord), '[]'::jsonb)
  INTO source_breakdown
  FROM ordered;

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
    session_rows AS (
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
    )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'visit_key', visit_key,
    'visitor_id', visitor_id,
    'session_id', session_id,
    'occurred_at', occurred_at,
    'time_label', to_char(occurred_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI'),
    'day', (occurred_at AT TIME ZONE 'Asia/Jakarta')::date,
    'route', NULLIF(route, ''),
    'utm_campaign', utm_campaign,
    'utm_source', utm_source,
    'utm_medium', utm_medium,
    'utm_content', utm_content,
    'utm_term', utm_term,
    'sessions', 1,
    'page_views', page_views,
    'clicks', clicks,
    'max_deep_scroll_pct', max_deep_scroll_pct,
    'avg_max_deep_scroll_pct', max_deep_scroll_pct,
    'scroll_sessions', CASE WHEN max_deep_scroll_pct IS NULL THEN 0 ELSE 1 END
  ) ORDER BY occurred_at DESC, session_id), '[]'::jsonb)
  INTO utm_table
  FROM session_rows;

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(base_payload, '{source_breakdown}', source_breakdown, true),
          '{kpis,clicks}',
          to_jsonb(COALESCE(unified_clicks, 0)),
          true
        ),
        '{kpis,sessions}',
        to_jsonb(COALESCE(unified_sessions, 0)),
        true
      ),
      '{kpis,page_views}',
      to_jsonb(COALESCE(unified_page_views, 0)),
      true
    ),
    '{utm_table}',
    utm_table,
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) TO authenticated;

COMMENT ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) IS
  'Dashboard RPC; UTM Tracking and source breakdown use first-touch session attribution (SPA-safe).';
