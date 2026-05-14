-- Visitor id support for traffic analytics.
-- `visitor_id` is a stable browser/device id. Dashboard grouping prefers visitor_id and
-- falls back to session_id for historical data that does not have visitor_id yet.

ALTER TABLE public.analytics_sessions
  ADD COLUMN IF NOT EXISTS visitor_id text;

ALTER TABLE public.analytics_page_views
  ADD COLUMN IF NOT EXISTS visitor_id text;

ALTER TABLE public.analytics_click_events
  ADD COLUMN IF NOT EXISTS visitor_id text;

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_web_visitor_id
  ON public.analytics_sessions (web_id, visitor_id)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_page_views_web_visitor_id_started
  ON public.analytics_page_views (web_id, visitor_id, started_at)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_click_events_web_visitor_id_created
  ON public.analytics_click_events (web_id, visitor_id, created_at)
  WHERE visitor_id IS NOT NULL;

ALTER FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int)
  RENAME TO get_traffic_dashboard_base_before_visitor_id_basis;

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
  base_payload := public.get_traffic_dashboard_base_before_visitor_id_basis(
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
    candidate_events AS (
      SELECT
        pv.web_id,
        COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), pv.session_id::text) AS visit_key,
        COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), '')) AS visitor_id,
        pv.session_id,
        pv.started_at AS occurred_at,
        pv.started_at AS page_view_at,
        NULL::timestamptz AS click_at,
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
        coalesce(nullif(btrim(s.last_referrer), ''), nullif(btrim(s.referrer), '')) AS referrer,
        coalesce(pv.active_ms, 0) > 0
          OR coalesce(pv.scroll_max_pct, 0) >= 5
          OR (pv.ended_at IS NOT NULL AND extract(epoch FROM (pv.ended_at - pv.started_at)) >= 5) AS is_human_page_view
      FROM public.analytics_page_views pv
      LEFT JOIN public.analytics_sessions s
        ON s.id = pv.session_id AND s.web_id = pv.web_id
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to

      UNION ALL

      SELECT
        ce.web_id,
        COALESCE(NULLIF(btrim(ce.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), ce.session_id::text) AS visit_key,
        COALESCE(NULLIF(btrim(ce.visitor_id), ''), NULLIF(btrim(s.visitor_id), '')) AS visitor_id,
        ce.session_id,
        ce.created_at AS occurred_at,
        NULL::timestamptz AS page_view_at,
        ce.created_at AS click_at,
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
        coalesce(nullif(btrim(s.last_referrer), ''), nullif(btrim(s.referrer), '')) AS referrer,
        false AS is_human_page_view
      FROM public.analytics_click_events ce
      LEFT JOIN public.analytics_sessions s
        ON s.id = ce.session_id AND s.web_id = ce.web_id
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    visit_base AS (
      SELECT DISTINCT ON (visit_key)
        web_id,
        visit_key,
        visitor_id,
        session_id,
        occurred_at,
        landing_url,
        route_landing_url,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        has_gclid,
        has_fbclid,
        has_msclkid,
        has_gbraid,
        has_wbraid,
        referrer
      FROM candidate_events
      ORDER BY visit_key, is_human_page_view DESC, occurred_at ASC
    ),
    effective AS (
      SELECT
        web_id,
        visit_key,
        visitor_id,
        session_id,
        occurred_at,
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
      FROM visit_base
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
    event_metrics AS (
      SELECT
        visit_key,
        COUNT(*) FILTER (WHERE page_view_at IS NOT NULL)::bigint AS page_views,
        COUNT(*) FILTER (WHERE click_at IS NOT NULL)::bigint AS clicks
      FROM candidate_events
      GROUP BY visit_key
    ),
    scroll_metrics AS (
      SELECT
        COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), pv.session_id::text) AS visit_key,
        MAX(pv.scroll_max_pct)::double precision AS max_deep_scroll_pct
      FROM public.analytics_page_views pv
      LEFT JOIN public.analytics_sessions s
        ON s.id = pv.session_id AND s.web_id = pv.web_id
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND pv.scroll_max_pct IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), pv.session_id::text)
    ),
    enriched AS (
      SELECT
        c.*,
        COALESCE(em.page_views, 0)::bigint AS page_views,
        COALESCE(em.clicks, 0)::bigint AS clicks,
        sm.max_deep_scroll_pct
      FROM classified c
      LEFT JOIN event_metrics em ON em.visit_key = c.visit_key
      LEFT JOIN scroll_metrics sm ON sm.visit_key = c.visit_key
    )
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(page_views), 0)::bigint,
    COALESCE(SUM(clicks), 0)::bigint
  INTO unified_sessions, unified_page_views, unified_clicks
  FROM enriched;

  WITH
    candidate_events AS (
      SELECT
        pv.web_id,
        COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), pv.session_id::text) AS visit_key,
        COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), '')) AS visitor_id,
        pv.session_id,
        pv.started_at AS occurred_at,
        pv.started_at AS page_view_at,
        NULL::timestamptz AS click_at,
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
        coalesce(nullif(btrim(s.last_referrer), ''), nullif(btrim(s.referrer), '')) AS referrer,
        coalesce(pv.active_ms, 0) > 0
          OR coalesce(pv.scroll_max_pct, 0) >= 5
          OR (pv.ended_at IS NOT NULL AND extract(epoch FROM (pv.ended_at - pv.started_at)) >= 5) AS is_human_page_view
      FROM public.analytics_page_views pv
      LEFT JOIN public.analytics_sessions s ON s.id = pv.session_id AND s.web_id = pv.web_id
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to

      UNION ALL

      SELECT
        ce.web_id,
        COALESCE(NULLIF(btrim(ce.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), ce.session_id::text) AS visit_key,
        COALESCE(NULLIF(btrim(ce.visitor_id), ''), NULLIF(btrim(s.visitor_id), '')) AS visitor_id,
        ce.session_id,
        ce.created_at AS occurred_at,
        NULL::timestamptz AS page_view_at,
        ce.created_at AS click_at,
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
        coalesce(nullif(btrim(s.last_referrer), ''), nullif(btrim(s.referrer), '')) AS referrer,
        false AS is_human_page_view
      FROM public.analytics_click_events ce
      LEFT JOIN public.analytics_sessions s ON s.id = ce.session_id AND s.web_id = ce.web_id
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    visit_base AS (
      SELECT DISTINCT ON (visit_key)
        *
      FROM candidate_events
      ORDER BY visit_key, is_human_page_view DESC, occurred_at ASC
    ),
    effective AS (
      SELECT
        web_id,
        visit_key,
        visitor_id,
        session_id,
        occurred_at,
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
      FROM visit_base
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
    event_metrics AS (
      SELECT
        visit_key,
        COUNT(*) FILTER (WHERE page_view_at IS NOT NULL)::bigint AS page_views,
        COUNT(*) FILTER (WHERE click_at IS NOT NULL)::bigint AS clicks
      FROM candidate_events
      GROUP BY visit_key
    ),
    scroll_metrics AS (
      SELECT
        COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), pv.session_id::text) AS visit_key,
        MAX(pv.scroll_max_pct)::double precision AS max_deep_scroll_pct
      FROM public.analytics_page_views pv
      LEFT JOIN public.analytics_sessions s ON s.id = pv.session_id AND s.web_id = pv.web_id
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND pv.scroll_max_pct IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), pv.session_id::text)
    ),
    enriched AS (
      SELECT
        c.*,
        COALESCE(em.page_views, 0)::bigint AS page_views,
        COALESCE(em.clicks, 0)::bigint AS clicks,
        sm.max_deep_scroll_pct
      FROM classified c
      LEFT JOIN event_metrics em ON em.visit_key = c.visit_key
      LEFT JOIN scroll_metrics sm ON sm.visit_key = c.visit_key
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
    candidate_events AS (
      SELECT
        pv.web_id,
        COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), pv.session_id::text) AS visit_key,
        COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), '')) AS visitor_id,
        pv.session_id,
        pv.started_at AS occurred_at,
        pv.started_at AS page_view_at,
        NULL::timestamptz AS click_at,
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
        coalesce(nullif(btrim(s.last_referrer), ''), nullif(btrim(s.referrer), '')) AS referrer,
        coalesce(pv.active_ms, 0) > 0
          OR coalesce(pv.scroll_max_pct, 0) >= 5
          OR (pv.ended_at IS NOT NULL AND extract(epoch FROM (pv.ended_at - pv.started_at)) >= 5) AS is_human_page_view
      FROM public.analytics_page_views pv
      LEFT JOIN public.analytics_sessions s ON s.id = pv.session_id AND s.web_id = pv.web_id
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to

      UNION ALL

      SELECT
        ce.web_id,
        COALESCE(NULLIF(btrim(ce.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), ce.session_id::text) AS visit_key,
        COALESCE(NULLIF(btrim(ce.visitor_id), ''), NULLIF(btrim(s.visitor_id), '')) AS visitor_id,
        ce.session_id,
        ce.created_at AS occurred_at,
        NULL::timestamptz AS page_view_at,
        ce.created_at AS click_at,
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
        coalesce(nullif(btrim(s.last_referrer), ''), nullif(btrim(s.referrer), '')) AS referrer,
        false AS is_human_page_view
      FROM public.analytics_click_events ce
      LEFT JOIN public.analytics_sessions s ON s.id = ce.session_id AND s.web_id = ce.web_id
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    visit_base AS (
      SELECT DISTINCT ON (visit_key) *
      FROM candidate_events
      ORDER BY visit_key, is_human_page_view DESC, occurred_at ASC
    ),
    effective AS (
      SELECT
        web_id,
        visit_key,
        visitor_id,
        session_id,
        occurred_at,
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
      FROM visit_base
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
    event_metrics AS (
      SELECT
        visit_key,
        COUNT(*) FILTER (WHERE page_view_at IS NOT NULL)::bigint AS page_views,
        COUNT(*) FILTER (WHERE click_at IS NOT NULL)::bigint AS clicks
      FROM candidate_events
      GROUP BY visit_key
    ),
    scroll_metrics AS (
      SELECT
        COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), pv.session_id::text) AS visit_key,
        MAX(pv.scroll_max_pct)::double precision AS max_deep_scroll_pct
      FROM public.analytics_page_views pv
      LEFT JOIN public.analytics_sessions s ON s.id = pv.session_id AND s.web_id = pv.web_id
      WHERE pv.web_id = p_web_id
        AND pv.session_id IS NOT NULL
        AND pv.scroll_max_pct IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY COALESCE(NULLIF(btrim(pv.visitor_id), ''), NULLIF(btrim(s.visitor_id), ''), pv.session_id::text)
    ),
    session_rows AS (
      SELECT
        c.visit_key,
        c.visitor_id,
        c.session_id,
        c.occurred_at,
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
        COALESCE(em.page_views, 0)::bigint AS page_views,
        COALESCE(em.clicks, 0)::bigint AS clicks,
        sm.max_deep_scroll_pct
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
      LEFT JOIN event_metrics em ON em.visit_key = c.visit_key
      LEFT JOIN scroll_metrics sm ON sm.visit_key = c.visit_key
      WHERE c.source_key IN ('utm', 'paid_click_ids')
      ORDER BY c.occurred_at DESC, c.visit_key
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
  ) ORDER BY occurred_at DESC, visit_key), '[]'::jsonb)
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
  'Dashboard RPC wrapper; visitor_id is preferred over session_id for traffic session grouping.';
