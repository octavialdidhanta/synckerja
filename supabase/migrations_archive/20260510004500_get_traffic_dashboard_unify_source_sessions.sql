-- Use one session basis for Total sessions, Source traffic, and UTM Tracking.
-- Basis: unique session_id discovered from human page views or click events in the selected range.

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
  base_payload := public.get_traffic_dashboard_base_before_utm_click_sync(
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
    human_sessions AS (
      SELECT
        pv.web_id,
        pv.session_id,
        MIN((pv.started_at AT TIME ZONE 'Asia/Jakarta')::date) AS day
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
        AND (
          coalesce(pv.active_ms, 0) > 0
          OR coalesce(pv.scroll_max_pct, 0) >= 5
          OR (
            pv.ended_at IS NOT NULL
            AND extract(epoch FROM (pv.ended_at - pv.started_at)) >= 5
          )
        )
      GROUP BY pv.web_id, pv.session_id
    ),
    click_sessions AS (
      SELECT
        ce.web_id,
        ce.session_id,
        MIN((ce.created_at AT TIME ZONE 'Asia/Jakarta')::date) AS day
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY ce.web_id, ce.session_id
    ),
    candidate_sessions AS (
      SELECT
        web_id,
        session_id,
        MIN(day) AS day
      FROM (
        SELECT * FROM human_sessions
        UNION ALL
        SELECT * FROM click_sessions
      ) s
      GROUP BY web_id, session_id
    ),
    session_base AS (
      SELECT
        cs.web_id,
        cs.day,
        cs.session_id,
        coalesce(nullif(btrim(s.last_landing_url), ''), nullif(btrim(s.landing_url), '')) AS landing_url,
        coalesce(nullif(btrim(s.last_landing_url), ''), nullif(btrim(s.landing_url), ''), nullif(btrim(s.first_landing_url), '')) AS route_landing_url,
        coalesce(nullif(btrim(s.last_utm_source), ''), nullif(btrim(s.utm_source), '')) AS utm_source,
        coalesce(nullif(btrim(s.last_utm_medium), ''), nullif(btrim(s.utm_medium), '')) AS utm_medium,
        coalesce(nullif(btrim(s.last_utm_campaign), ''), nullif(btrim(s.utm_campaign), '')) AS utm_campaign,
        coalesce(nullif(btrim(s.last_utm_content), ''), nullif(btrim(s.utm_content), '')) AS utm_content,
        coalesce(nullif(btrim(s.last_utm_term), ''), nullif(btrim(s.utm_term), '')) AS utm_term,
        (coalesce(s.has_gclid, false) OR coalesce(s.last_has_gclid, false)) AS has_gclid,
        (coalesce(s.has_fbclid, false) OR coalesce(s.last_has_fbclid, false)) AS has_fbclid,
        (coalesce(s.has_msclkid, false) OR coalesce(s.last_has_msclkid, false)) AS has_msclkid,
        (coalesce(s.has_gbraid, false) OR coalesce(s.last_has_gbraid, false)) AS has_gbraid,
        (coalesce(s.has_wbraid, false) OR coalesce(s.last_has_wbraid, false)) AS has_wbraid,
        coalesce(nullif(btrim(s.last_referrer), ''), nullif(btrim(s.referrer), '')) AS referrer
      FROM candidate_sessions cs
      LEFT JOIN public.analytics_sessions s
        ON s.id = cs.session_id
        AND s.web_id = cs.web_id
    ),
    effective AS (
      SELECT
        web_id,
        day,
        session_id,
        route_landing_url,
        coalesce(nullif(btrim(utm_source), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_source=([^&]*)'))[1]), '')) AS utm_source_eff,
        coalesce(nullif(btrim(utm_medium), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_medium=([^&]*)'))[1]), '')) AS utm_medium_eff,
        coalesce(nullif(btrim(utm_campaign), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_campaign=([^&]*)'))[1]), '')) AS utm_campaign_eff,
        coalesce(nullif(btrim(utm_content), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_content=([^&]*)'))[1]), '')) AS utm_content_eff,
        coalesce(nullif(btrim(utm_term), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_term=([^&]*)'))[1]), '')) AS utm_term_eff,
        has_gclid,
        has_fbclid,
        has_msclkid,
        has_gbraid,
        has_wbraid,
        referrer
      FROM session_base
    ),
    classified AS (
      SELECT
        e.*,
        CASE
          WHEN e.has_gclid OR e.has_fbclid OR e.has_msclkid OR e.has_gbraid OR e.has_wbraid THEN 'paid_click_ids'
          WHEN
            nullif(btrim(e.utm_source_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_medium_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_campaign_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_content_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_term_eff), '') IS NOT NULL
            THEN 'utm'
          WHEN nullif(btrim(e.referrer), '') IS NOT NULL THEN 'referral'
          ELSE 'direct'
        END AS source_key
      FROM effective e
    ),
    pv_session AS (
      SELECT
        pv.web_id,
        pv.session_id,
        count(*)::bigint AS page_views
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY pv.web_id, pv.session_id
    ),
    clicks_session AS (
      SELECT
        ce.web_id,
        ce.session_id,
        count(*)::bigint AS clicks
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY ce.web_id, ce.session_id
    ),
    scroll_session AS (
      SELECT
        pv.web_id,
        pv.session_id,
        max(pv.scroll_max_pct)::double precision AS max_deep_scroll_pct
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND pv.scroll_max_pct IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY pv.web_id, pv.session_id
    ),
    enriched AS (
      SELECT
        c.*,
        COALESCE(pv.page_views, 0)::bigint AS page_views,
        COALESCE(cs.clicks, 0)::bigint AS clicks,
        ss.max_deep_scroll_pct
      FROM classified c
      LEFT JOIN pv_session pv
        ON pv.web_id = c.web_id AND pv.session_id = c.session_id
      LEFT JOIN clicks_session cs
        ON cs.web_id = c.web_id AND cs.session_id = c.session_id
      LEFT JOIN scroll_session ss
        ON ss.web_id = c.web_id AND ss.session_id = c.session_id
    )
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(page_views), 0)::bigint,
    COALESCE(SUM(clicks), 0)::bigint
  INTO unified_sessions, unified_page_views, unified_clicks
  FROM enriched;

  WITH
    human_sessions AS (
      SELECT
        pv.web_id,
        pv.session_id,
        MIN((pv.started_at AT TIME ZONE 'Asia/Jakarta')::date) AS day
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
        AND (
          coalesce(pv.active_ms, 0) > 0
          OR coalesce(pv.scroll_max_pct, 0) >= 5
          OR (
            pv.ended_at IS NOT NULL
            AND extract(epoch FROM (pv.ended_at - pv.started_at)) >= 5
          )
        )
      GROUP BY pv.web_id, pv.session_id
    ),
    click_sessions AS (
      SELECT
        ce.web_id,
        ce.session_id,
        MIN((ce.created_at AT TIME ZONE 'Asia/Jakarta')::date) AS day
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY ce.web_id, ce.session_id
    ),
    candidate_sessions AS (
      SELECT web_id, session_id, MIN(day) AS day
      FROM (
        SELECT * FROM human_sessions
        UNION ALL
        SELECT * FROM click_sessions
      ) s
      GROUP BY web_id, session_id
    ),
    session_base AS (
      SELECT
        cs.web_id,
        cs.day,
        cs.session_id,
        coalesce(nullif(btrim(s.last_landing_url), ''), nullif(btrim(s.landing_url), '')) AS landing_url,
        coalesce(nullif(btrim(s.last_landing_url), ''), nullif(btrim(s.landing_url), ''), nullif(btrim(s.first_landing_url), '')) AS route_landing_url,
        coalesce(nullif(btrim(s.last_utm_source), ''), nullif(btrim(s.utm_source), '')) AS utm_source,
        coalesce(nullif(btrim(s.last_utm_medium), ''), nullif(btrim(s.utm_medium), '')) AS utm_medium,
        coalesce(nullif(btrim(s.last_utm_campaign), ''), nullif(btrim(s.utm_campaign), '')) AS utm_campaign,
        coalesce(nullif(btrim(s.last_utm_content), ''), nullif(btrim(s.utm_content), '')) AS utm_content,
        coalesce(nullif(btrim(s.last_utm_term), ''), nullif(btrim(s.utm_term), '')) AS utm_term,
        (coalesce(s.has_gclid, false) OR coalesce(s.last_has_gclid, false)) AS has_gclid,
        (coalesce(s.has_fbclid, false) OR coalesce(s.last_has_fbclid, false)) AS has_fbclid,
        (coalesce(s.has_msclkid, false) OR coalesce(s.last_has_msclkid, false)) AS has_msclkid,
        (coalesce(s.has_gbraid, false) OR coalesce(s.last_has_gbraid, false)) AS has_gbraid,
        (coalesce(s.has_wbraid, false) OR coalesce(s.last_has_wbraid, false)) AS has_wbraid,
        coalesce(nullif(btrim(s.last_referrer), ''), nullif(btrim(s.referrer), '')) AS referrer
      FROM candidate_sessions cs
      LEFT JOIN public.analytics_sessions s
        ON s.id = cs.session_id
        AND s.web_id = cs.web_id
    ),
    effective AS (
      SELECT
        web_id,
        day,
        session_id,
        route_landing_url,
        coalesce(nullif(btrim(utm_source), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_source=([^&]*)'))[1]), '')) AS utm_source_eff,
        coalesce(nullif(btrim(utm_medium), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_medium=([^&]*)'))[1]), '')) AS utm_medium_eff,
        coalesce(nullif(btrim(utm_campaign), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_campaign=([^&]*)'))[1]), '')) AS utm_campaign_eff,
        coalesce(nullif(btrim(utm_content), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_content=([^&]*)'))[1]), '')) AS utm_content_eff,
        coalesce(nullif(btrim(utm_term), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_term=([^&]*)'))[1]), '')) AS utm_term_eff,
        has_gclid,
        has_fbclid,
        has_msclkid,
        has_gbraid,
        has_wbraid,
        referrer
      FROM session_base
    ),
    classified AS (
      SELECT
        e.*,
        CASE
          WHEN e.has_gclid OR e.has_fbclid OR e.has_msclkid OR e.has_gbraid OR e.has_wbraid THEN 'paid_click_ids'
          WHEN
            nullif(btrim(e.utm_source_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_medium_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_campaign_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_content_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_term_eff), '') IS NOT NULL
            THEN 'utm'
          WHEN nullif(btrim(e.referrer), '') IS NOT NULL THEN 'referral'
          ELSE 'direct'
        END AS source_key
      FROM effective e
    ),
    pv_session AS (
      SELECT pv.web_id, pv.session_id, count(*)::bigint AS page_views
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY pv.web_id, pv.session_id
    ),
    clicks_session AS (
      SELECT ce.web_id, ce.session_id, count(*)::bigint AS clicks
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY ce.web_id, ce.session_id
    ),
    scroll_session AS (
      SELECT pv.web_id, pv.session_id, max(pv.scroll_max_pct)::double precision AS max_deep_scroll_pct
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND pv.scroll_max_pct IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY pv.web_id, pv.session_id
    ),
    enriched AS (
      SELECT
        c.*,
        COALESCE(pv.page_views, 0)::bigint AS page_views,
        COALESCE(cs.clicks, 0)::bigint AS clicks,
        ss.max_deep_scroll_pct
      FROM classified c
      LEFT JOIN pv_session pv ON pv.web_id = c.web_id AND pv.session_id = c.session_id
      LEFT JOIN clicks_session cs ON cs.web_id = c.web_id AND cs.session_id = c.session_id
      LEFT JOIN scroll_session ss ON ss.web_id = c.web_id AND ss.session_id = c.session_id
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
    human_sessions AS (
      SELECT pv.web_id, pv.session_id, MIN((pv.started_at AT TIME ZONE 'Asia/Jakarta')::date) AS day
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
        AND (
          coalesce(pv.active_ms, 0) > 0
          OR coalesce(pv.scroll_max_pct, 0) >= 5
          OR (pv.ended_at IS NOT NULL AND extract(epoch FROM (pv.ended_at - pv.started_at)) >= 5)
        )
      GROUP BY pv.web_id, pv.session_id
    ),
    click_sessions AS (
      SELECT ce.web_id, ce.session_id, MIN((ce.created_at AT TIME ZONE 'Asia/Jakarta')::date) AS day
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY ce.web_id, ce.session_id
    ),
    candidate_sessions AS (
      SELECT web_id, session_id, MIN(day) AS day
      FROM (
        SELECT * FROM human_sessions
        UNION ALL
        SELECT * FROM click_sessions
      ) s
      GROUP BY web_id, session_id
    ),
    session_base AS (
      SELECT
        cs.web_id,
        cs.day,
        cs.session_id,
        coalesce(nullif(btrim(s.last_landing_url), ''), nullif(btrim(s.landing_url), '')) AS landing_url,
        coalesce(nullif(btrim(s.last_landing_url), ''), nullif(btrim(s.landing_url), ''), nullif(btrim(s.first_landing_url), '')) AS route_landing_url,
        coalesce(nullif(btrim(s.last_utm_source), ''), nullif(btrim(s.utm_source), '')) AS utm_source,
        coalesce(nullif(btrim(s.last_utm_medium), ''), nullif(btrim(s.utm_medium), '')) AS utm_medium,
        coalesce(nullif(btrim(s.last_utm_campaign), ''), nullif(btrim(s.utm_campaign), '')) AS utm_campaign,
        coalesce(nullif(btrim(s.last_utm_content), ''), nullif(btrim(s.utm_content), '')) AS utm_content,
        coalesce(nullif(btrim(s.last_utm_term), ''), nullif(btrim(s.utm_term), '')) AS utm_term,
        (coalesce(s.has_gclid, false) OR coalesce(s.last_has_gclid, false)) AS has_gclid,
        (coalesce(s.has_fbclid, false) OR coalesce(s.last_has_fbclid, false)) AS has_fbclid,
        (coalesce(s.has_msclkid, false) OR coalesce(s.last_has_msclkid, false)) AS has_msclkid,
        (coalesce(s.has_gbraid, false) OR coalesce(s.last_has_gbraid, false)) AS has_gbraid,
        (coalesce(s.has_wbraid, false) OR coalesce(s.last_has_wbraid, false)) AS has_wbraid
      FROM candidate_sessions cs
      LEFT JOIN public.analytics_sessions s ON s.id = cs.session_id AND s.web_id = cs.web_id
    ),
    effective AS (
      SELECT
        web_id,
        day,
        session_id,
        route_landing_url,
        coalesce(nullif(btrim(utm_source), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_source=([^&]*)'))[1]), '')) AS utm_source_eff,
        coalesce(nullif(btrim(utm_medium), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_medium=([^&]*)'))[1]), '')) AS utm_medium_eff,
        coalesce(nullif(btrim(utm_campaign), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_campaign=([^&]*)'))[1]), '')) AS utm_campaign_eff,
        coalesce(nullif(btrim(utm_content), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_content=([^&]*)'))[1]), '')) AS utm_content_eff,
        coalesce(nullif(btrim(utm_term), ''), nullif(trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_term=([^&]*)'))[1]), '')) AS utm_term_eff,
        has_gclid,
        has_fbclid,
        has_msclkid,
        has_gbraid,
        has_wbraid
      FROM session_base
    ),
    classified AS (
      SELECT
        e.*,
        CASE
          WHEN e.has_gclid OR e.has_fbclid OR e.has_msclkid OR e.has_gbraid OR e.has_wbraid THEN 'paid_click_ids'
          WHEN
            nullif(btrim(e.utm_source_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_medium_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_campaign_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_content_eff), '') IS NOT NULL
            OR nullif(btrim(e.utm_term_eff), '') IS NOT NULL
            THEN 'utm'
          ELSE 'direct'
        END AS source_key
      FROM effective e
    ),
    pv_session AS (
      SELECT pv.web_id, pv.session_id, count(*)::bigint AS page_views
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY pv.web_id, pv.session_id
    ),
    clicks_session AS (
      SELECT ce.web_id, ce.session_id, count(*)::bigint AS clicks
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY ce.web_id, ce.session_id
    ),
    scroll_session AS (
      SELECT pv.web_id, pv.session_id, max(pv.scroll_max_pct)::double precision AS max_deep_scroll_pct
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND pv.scroll_max_pct IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY pv.web_id, pv.session_id
    ),
    session_rows AS (
      SELECT
        c.session_id,
        c.day,
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
        c.utm_campaign_eff AS utm_campaign,
        c.utm_source_eff AS utm_source,
        c.utm_medium_eff AS utm_medium,
        c.utm_content_eff AS utm_content,
        c.utm_term_eff AS utm_term,
        COALESCE(pv.page_views, 0)::bigint AS page_views,
        COALESCE(cs.clicks, 0)::bigint AS clicks,
        ss.max_deep_scroll_pct
      FROM classified c
      CROSS JOIN LATERAL (
        SELECT
          coalesce(
            trim(both '/' FROM regexp_replace(
              regexp_replace(coalesce(c.route_landing_url, ''), '^https?://[^/]+', '', 'i'),
              '[?#].*$',
              ''
            )),
            ''
          ) AS route_path,
          nullif(btrim(c.route_landing_url), '') IS NOT NULL AS had_landing_ref
      ) lp
      LEFT JOIN pv_session pv ON pv.web_id = c.web_id AND pv.session_id = c.session_id
      LEFT JOIN clicks_session cs ON cs.web_id = c.web_id AND cs.session_id = c.session_id
      LEFT JOIN scroll_session ss ON ss.web_id = c.web_id AND ss.session_id = c.session_id
      WHERE c.source_key IN ('utm', 'paid_click_ids')
      ORDER BY c.day DESC, c.session_id
      LIMIT GREATEST(1, LEAST(p_utm_limit, 2000))
    )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'session_id', session_id,
    'day', day,
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
  ) ORDER BY day DESC, session_id), '[]'::jsonb)
  INTO utm_table
  FROM session_rows;

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            base_payload,
            '{source_breakdown}',
            source_breakdown,
            true
          ),
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
  'Dashboard RPC wrapper; total sessions, source traffic, and UTM rows share the same unique session_id basis, with clicks from the same click events.';
