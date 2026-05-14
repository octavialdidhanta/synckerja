-- UTM Tracking: return one row per UTM session instead of one aggregate row per UTM bucket.

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

  WITH
    base AS (
      SELECT
        tp.path,
        SUM(tp.page_views_count)::bigint AS impr,
        SUM(tp.unique_sessions_count)::bigint AS unique_sessions,
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
    raw_median_by_path AS (
      SELECT
        b.path,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY pv.active_ms::double precision) AS median_active_ms
      FROM base b
      INNER JOIN public.analytics_page_views pv
        ON pv.web_id = p_web_id
        AND public.traffic_path_key(pv.path) = public.traffic_path_key(b.path)
        AND (timezone('Asia/Jakarta', pv.started_at))::date BETWEEN v_from AND v_to
        AND pv.active_ms IS NOT NULL
      GROUP BY b.path
    ),
    click_targets_agg AS (
      SELECT
        t.path,
        t.track_key,
        t.element_type,
        t.element_label,
        t.target_url,
        t.is_internal,
        t.clicks
      FROM (
        SELECT
          c.path,
          c.track_key,
          c.element_type,
          c.element_label,
          c.target_url,
          c.is_internal,
          SUM(c.clicks_count)::bigint AS clicks,
          ROW_NUMBER() OVER (
            PARTITION BY c.path
            ORDER BY SUM(c.clicks_count) DESC, c.is_internal DESC, c.target_url ASC
          ) AS rn
        FROM public.analytics_daily_top_click_targets c
        WHERE c.web_id = p_web_id
          AND c.day BETWEEN v_from AND v_to
        GROUP BY c.path, c.track_key, c.element_type, c.element_label, c.target_url, c.is_internal
      ) t
      WHERE t.rn = 1
    ),
    raw_scroll_by_path AS (
      SELECT
        b.path,
        MAX(sub.sp_max) FILTER (WHERE sub.sp_max IS NOT NULL)::double precision AS max_deep_scroll_pct,
        CASE
          WHEN COUNT(*) FILTER (WHERE sub.sp_max IS NOT NULL) = 0 THEN NULL
          ELSE
            (SUM(sub.sp_max) FILTER (WHERE sub.sp_max IS NOT NULL) /
              NULLIF(COUNT(*) FILTER (WHERE sub.sp_max IS NOT NULL), 0))::double precision
        END AS avg_max_deep_scroll_pct
      FROM base b
      LEFT JOIN (
        SELECT
          b2.path,
          pvs.session_id,
          MAX(pvs.scroll_max_pct)::double precision AS sp_max
        FROM base b2
        INNER JOIN public.analytics_page_views pvs
          ON pvs.web_id = p_web_id
          AND public.traffic_path_key(pvs.path) = public.traffic_path_key(b2.path)
          AND (timezone('Asia/Jakarta', pvs.started_at))::date BETWEEN v_from AND v_to
        GROUP BY b2.path, pvs.session_id
      ) sub ON public.traffic_path_key(sub.path) = public.traffic_path_key(b.path)
      GROUP BY b.path
    )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'path', b.path,
    'impr', b.impr,
    'unique_sessions', b.unique_sessions,
    'clicks', COALESCE(c.clicks, 0),
    'median_active_ms',
      CASE
        WHEN rm.median_active_ms IS NULL THEN NULL
        ELSE ROUND(rm.median_active_ms)::bigint
      END,
    'avg_active_ms', b.avg_active_ms,
    'n', b.unique_sessions,
    'max_deep_scroll_pct', rs.max_deep_scroll_pct,
    'avg_max_deep_scroll_pct', rs.avg_max_deep_scroll_pct,
    'click_event_name', 'click',
    'click_track_key', NULLIF(ct.track_key, ''),
    'click_element_type', ct.element_type,
    'click_element_label', ct.element_label,
    'click_target_url', NULLIF(ct.target_url, ''),
    'click_is_internal', ct.is_internal
  ) ORDER BY b.impr DESC), '[]'::jsonb)
  INTO top_pages
  FROM base b
  LEFT JOIN clicks_by_path c
    ON c.path = b.path
  LEFT JOIN raw_median_by_path rm
    ON rm.path = b.path
  LEFT JOIN click_targets_agg ct
    ON public.traffic_path_key(COALESCE(ct.path, E'')) = public.traffic_path_key(b.path)
  LEFT JOIN raw_scroll_by_path rs
    ON rs.path = b.path;

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

  WITH
    human_sessions AS (
      SELECT DISTINCT
        pv.web_id,
        pv.session_id,
        (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date AS day
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
    ),
    base AS (
      SELECT
        hs.web_id,
        hs.day,
        hs.session_id,
        coalesce(nullif(btrim(s.last_landing_url), ''), nullif(btrim(s.landing_url), '')) AS landing_url,
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
      FROM human_sessions hs
      INNER JOIN public.analytics_sessions s
        ON s.id = hs.session_id
        AND s.web_id = hs.web_id
    ),
    effective AS (
      SELECT
        web_id,
        day,
        session_id,
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
      FROM base
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
    pv_day AS (
      SELECT
        pv.web_id,
        pv.session_id,
        (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
        count(*)::bigint AS page_views
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY pv.web_id, pv.session_id, (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date
    ),
    clicks_day AS (
      SELECT
        ce.web_id,
        ce.session_id,
        (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
        count(*)::bigint AS clicks
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY ce.web_id, ce.session_id, (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date
    ),
    scroll_day AS (
      SELECT
        pv.web_id,
        pv.session_id,
        (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
        max(pv.scroll_max_pct)::double precision AS max_deep_scroll_pct
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND pv.scroll_max_pct IS NOT NULL
        AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
      GROUP BY pv.web_id, pv.session_id, (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date
    ),
    click_session_days AS (
      SELECT DISTINCT
        ce.web_id,
        ce.session_id,
        (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND ce.session_id IS NOT NULL
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    ),
    click_base AS (
      SELECT
        csd.web_id,
        csd.day,
        csd.session_id,
        coalesce(nullif(btrim(s.last_landing_url), ''), nullif(btrim(s.landing_url), '')) AS landing_url,
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
      FROM click_session_days csd
      LEFT JOIN public.analytics_sessions s
        ON s.id = csd.session_id
        AND s.web_id = csd.web_id
    ),
    click_effective AS (
      SELECT
        web_id,
        day,
        session_id,
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
      FROM click_base
    ),
    click_classified AS (
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
      FROM click_effective e
    ),
    session_rows AS (
      SELECT *
      FROM (
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
        COALESCE(cd.clicks, 0)::bigint AS clicks,
        sd.max_deep_scroll_pct
      FROM classified c
      INNER JOIN public.analytics_sessions s
        ON s.id = c.session_id
        AND s.web_id = c.web_id
      CROSS JOIN LATERAL (
        SELECT
          coalesce(
            trim(both '/' FROM regexp_replace(
              regexp_replace(
                coalesce(
                  nullif(btrim(s.last_landing_url), ''),
                  nullif(btrim(s.landing_url), ''),
                  nullif(btrim(s.first_landing_url), ''),
                  ''
                ),
                '^https?://[^/]+',
                '',
                'i'
              ),
              '[?#].*$',
              ''
            )),
            ''
          ) AS route_path,
          (
            nullif(btrim(s.last_landing_url), '') IS NOT NULL
            OR nullif(btrim(s.landing_url), '') IS NOT NULL
            OR nullif(btrim(s.first_landing_url), '') IS NOT NULL
          ) AS had_landing_ref
      ) lp
      LEFT JOIN pv_day pv
        ON pv.web_id = c.web_id AND pv.session_id = c.session_id AND pv.day = c.day
      LEFT JOIN clicks_day cd
        ON cd.web_id = c.web_id AND cd.session_id = c.session_id AND cd.day = c.day
      LEFT JOIN scroll_day sd
        ON sd.web_id = c.web_id AND sd.session_id = c.session_id AND sd.day = c.day
      WHERE
        (
          c.source_key = 'paid_click_ids'
          OR (
            c.source_key = 'utm'
            AND (
              nullif(btrim(c.utm_source_eff), '') IS NOT NULL
              OR nullif(btrim(c.utm_medium_eff), '') IS NOT NULL
              OR nullif(btrim(c.utm_campaign_eff), '') IS NOT NULL
              OR nullif(btrim(c.utm_content_eff), '') IS NOT NULL
              OR nullif(btrim(c.utm_term_eff), '') IS NOT NULL
            )
          )
        )
        UNION ALL

        SELECT
          cc.session_id,
          cc.day,
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
          cc.utm_campaign_eff AS utm_campaign,
          cc.utm_source_eff AS utm_source,
          cc.utm_medium_eff AS utm_medium,
          cc.utm_content_eff AS utm_content,
          cc.utm_term_eff AS utm_term,
          COALESCE(pv.page_views, 0)::bigint AS page_views,
          COALESCE(cd.clicks, 0)::bigint AS clicks,
          sd.max_deep_scroll_pct
        FROM click_classified cc
        LEFT JOIN public.analytics_sessions s
          ON s.id = cc.session_id
          AND s.web_id = cc.web_id
        CROSS JOIN LATERAL (
          SELECT
            coalesce(
              trim(both '/' FROM regexp_replace(
                regexp_replace(
                  coalesce(
                    nullif(btrim(s.last_landing_url), ''),
                    nullif(btrim(s.landing_url), ''),
                    nullif(btrim(s.first_landing_url), ''),
                    ''
                  ),
                  '^https?://[^/]+',
                  '',
                  'i'
                ),
                '[?#].*$',
                ''
              )),
              ''
            ) AS route_path,
            (
              nullif(btrim(s.last_landing_url), '') IS NOT NULL
              OR nullif(btrim(s.landing_url), '') IS NOT NULL
              OR nullif(btrim(s.first_landing_url), '') IS NOT NULL
            ) AS had_landing_ref
        ) lp
        LEFT JOIN pv_day pv
          ON pv.web_id = cc.web_id AND pv.session_id = cc.session_id AND pv.day = cc.day
        LEFT JOIN clicks_day cd
          ON cd.web_id = cc.web_id AND cd.session_id = cc.session_id AND cd.day = cc.day
        LEFT JOIN scroll_day sd
          ON sd.web_id = cc.web_id AND sd.session_id = cc.session_id AND sd.day = cc.day
        WHERE
          NOT EXISTS (
            SELECT 1
            FROM human_sessions hs
            WHERE hs.web_id = cc.web_id AND hs.session_id = cc.session_id AND hs.day = cc.day
          )
          AND (
            cc.source_key = 'paid_click_ids'
            OR (
              cc.source_key = 'utm'
              AND (
                nullif(btrim(cc.utm_source_eff), '') IS NOT NULL
                OR nullif(btrim(cc.utm_medium_eff), '') IS NOT NULL
                OR nullif(btrim(cc.utm_campaign_eff), '') IS NOT NULL
                OR nullif(btrim(cc.utm_content_eff), '') IS NOT NULL
                OR nullif(btrim(cc.utm_term_eff), '') IS NOT NULL
              )
            )
          )
      ) q
      ORDER BY q.day DESC, q.session_id
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

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', agg.source_key,
        'label', agg.lbl,
        'sessions', agg.sessions,
        'page_views', agg.page_views,
        'clicks', agg.clicks,
        'max_deep_scroll_pct', agg.max_deep_scroll_pct,
        'avg_max_deep_scroll_pct', agg.avg_max_deep_scroll_pct,
        'scroll_sessions', agg.scroll_sessions
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
      q.max_deep_scroll_pct,
      q.avg_max_deep_scroll_pct,
      q.scroll_sessions,
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
        SUM(b.clicks_count)::bigint AS clicks,
        MAX(b.scroll_max_pct_max)::double precision AS max_deep_scroll_pct,
        CASE
          WHEN COALESCE(SUM(b.scroll_sessions_count), 0) = 0 THEN NULL
          ELSE (SUM(b.scroll_max_pct_sum) / NULLIF(SUM(b.scroll_sessions_count), 0))::double precision
        END AS avg_max_deep_scroll_pct,
        SUM(b.scroll_sessions_count)::bigint AS scroll_sessions
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
