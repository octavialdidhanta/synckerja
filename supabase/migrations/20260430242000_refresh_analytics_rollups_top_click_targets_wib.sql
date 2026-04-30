-- Re-populate analytics_daily_top_click_targets inside refresh_analytics_rollups (WIB),
-- setelah versi WIB 20260430210000 yang mengisi analytics_daily_top_clicks tetapi belum
-- meng-refresh tabel target — modal Detail klik (get_click_targets_for_path) memakai tabel ini.

-- Isi kembali median (active_ms_hist) dan metrik scroll per path di analytics_daily_top_pages
-- setelah refresh WIB, serta kembalikan get_traffic_dashboard agar top_pages mengembalikan
-- impr, median_active_ms, max_deep_scroll_pct, avg_max_deep_scroll_pct (sama untuk blog / non-blog).

CREATE OR REPLACE FUNCTION public.refresh_analytics_rollups(
  p_web_id text,
  p_from date,
  p_to date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  v_from date;
  v_to date;
  v_min date;
  v_max date;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
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
    RETURN;
  END IF;

  v_from := COALESCE(p_from, v_min);
  v_to := COALESCE(p_to, v_max);

  IF v_to < v_from THEN
    RAISE EXCEPTION 'invalid range';
  END IF;

  d := v_from;
  WHILE d <= v_to LOOP
    INSERT INTO public.analytics_daily_sessions (
      web_id, day, sessions_count,
      sessions_with_utm_count,
      sessions_with_gclid_count, sessions_with_fbclid_count, sessions_with_msclkid_count
    )
    SELECT
      p_web_id,
      d,
      COUNT(*)::bigint,
      COUNT(*) FILTER (
        WHERE COALESCE(NULLIF(trim(s.utm_source), ''), NULLIF(trim(s.utm_medium), ''), NULLIF(trim(s.utm_campaign), ''), NULLIF(trim(s.utm_content), ''), NULLIF(trim(s.utm_term), '')) IS NOT NULL
      )::bigint,
      COUNT(*) FILTER (WHERE s.has_gclid)::bigint,
      COUNT(*) FILTER (WHERE s.has_fbclid)::bigint,
      COUNT(*) FILTER (WHERE s.has_msclkid)::bigint
    FROM public.analytics_sessions s
    WHERE s.web_id = p_web_id
      AND (timezone('Asia/Jakarta', s.started_at))::date = d
    ON CONFLICT (web_id, day) DO UPDATE SET
      sessions_count = EXCLUDED.sessions_count,
      sessions_with_utm_count = EXCLUDED.sessions_with_utm_count,
      sessions_with_gclid_count = EXCLUDED.sessions_with_gclid_count,
      sessions_with_fbclid_count = EXCLUDED.sessions_with_fbclid_count,
      sessions_with_msclkid_count = EXCLUDED.sessions_with_msclkid_count,
      updated_at = now();

    INSERT INTO public.analytics_daily_page_views (
      web_id, day, page_views_count, active_ms_sum, unique_sessions_count
    )
    SELECT
      p_web_id,
      d,
      COUNT(*)::bigint,
      COALESCE(SUM(pv.active_ms), 0)::bigint,
      COUNT(DISTINCT pv.session_id)::bigint
    FROM public.analytics_page_views pv
    WHERE pv.web_id = p_web_id
      AND (timezone('Asia/Jakarta', pv.started_at))::date = d
    ON CONFLICT (web_id, day) DO UPDATE SET
      page_views_count = EXCLUDED.page_views_count,
      active_ms_sum = EXCLUDED.active_ms_sum,
      unique_sessions_count = EXCLUDED.unique_sessions_count,
      updated_at = now();

    INSERT INTO public.analytics_daily_clicks (
      web_id, day, clicks_count, unique_sessions_count
    )
    SELECT
      p_web_id,
      d,
      COUNT(*)::bigint,
      COUNT(DISTINCT ce.session_id)::bigint
    FROM public.analytics_click_events ce
    WHERE ce.web_id = p_web_id
      AND (timezone('Asia/Jakarta', ce.created_at))::date = d
    ON CONFLICT (web_id, day) DO UPDATE SET
      clicks_count = EXCLUDED.clicks_count,
      unique_sessions_count = EXCLUDED.unique_sessions_count,
      updated_at = now();

    DELETE FROM public.analytics_daily_top_pages
    WHERE web_id = p_web_id AND day = d;

    INSERT INTO public.analytics_daily_top_pages (
      web_id, day, path, page_views_count, active_ms_sum, unique_sessions_count
    )
    SELECT
      p_web_id,
      d,
      pv.path,
      COUNT(*)::bigint,
      COALESCE(SUM(pv.active_ms), 0)::bigint,
      COUNT(DISTINCT pv.session_id)::bigint
    FROM public.analytics_page_views pv
    WHERE pv.web_id = p_web_id
      AND (timezone('Asia/Jakarta', pv.started_at))::date = d
    GROUP BY pv.path;

    -- Histogram waktu aktif per path (untuk median di dashboard)
    WITH
      paths AS (
        SELECT tp.path
        FROM public.analytics_daily_top_pages tp
        WHERE tp.web_id = p_web_id AND tp.day = d
      ),
      buckets AS (
        SELECT generate_series(1, 110) AS idx
      ),
      counts AS (
        SELECT
          pv.path,
          public.active_ms_hist_bucket_idx(pv.active_ms) AS idx,
          COUNT(*)::bigint AS cnt
        FROM public.analytics_page_views pv
        WHERE pv.web_id = p_web_id
          AND (timezone('Asia/Jakarta', pv.started_at))::date = d
        GROUP BY pv.path, public.active_ms_hist_bucket_idx(pv.active_ms)
      ),
      hist AS (
        SELECT
          p.path,
          array_agg(COALESCE(c.cnt, 0) ORDER BY b.idx)::bigint[] AS hist
        FROM paths p
        CROSS JOIN buckets b
        LEFT JOIN counts c
          ON c.path = p.path AND c.idx = b.idx
        GROUP BY p.path
      )
    UPDATE public.analytics_daily_top_pages tp
    SET active_ms_hist = h.hist,
        updated_at = now()
    FROM hist h
    WHERE tp.web_id = p_web_id
      AND tp.day = d
      AND tp.path = h.path;

    -- Scroll per path: satu kontribusi per session per path (max scroll_max_pct) â€” fair vs UTM/source
    WITH per_session_path AS (
      SELECT
        pv.path,
        pv.session_id,
        MAX(pv.scroll_max_pct)::double precision AS sp_max
      FROM public.analytics_page_views pv
      WHERE pv.web_id = p_web_id
        AND (timezone('Asia/Jakarta', pv.started_at))::date = d
      GROUP BY pv.path, pv.session_id
    ),
    agg AS (
      SELECT
        path,
        COUNT(*) FILTER (WHERE sp_max IS NOT NULL)::bigint AS scroll_sessions_count,
        MAX(sp_max) FILTER (WHERE sp_max IS NOT NULL)::double precision AS scroll_max_pct_max,
        COALESCE(SUM(sp_max) FILTER (WHERE sp_max IS NOT NULL), 0)::double precision AS scroll_max_pct_sum
      FROM per_session_path
      GROUP BY path
    )
    UPDATE public.analytics_daily_top_pages tp
    SET
      scroll_sessions_count = a.scroll_sessions_count,
      scroll_max_pct_max = a.scroll_max_pct_max,
      scroll_max_pct_sum = a.scroll_max_pct_sum,
      updated_at = now()
    FROM agg a
    WHERE tp.web_id = p_web_id
      AND tp.day = d
      AND tp.path = a.path;

    DELETE FROM public.analytics_daily_top_clicks
    WHERE web_id = p_web_id AND day = d;

    INSERT INTO public.analytics_daily_top_clicks (
      web_id, day, path, track_key, element_type, element_label, clicks_count, unique_sessions_count
    )
    SELECT
      p_web_id,
      d,
      ce.path,
      COALESCE(ce.track_key, ''),
      ce.element_type,
      ce.element_label,
      COUNT(*)::bigint,
      COUNT(DISTINCT ce.session_id)::bigint
    FROM public.analytics_click_events ce
    WHERE ce.web_id = p_web_id
      AND (timezone('Asia/Jakarta', ce.created_at))::date = d
    GROUP BY ce.path, COALESCE(ce.track_key, ''), ce.element_type, ce.element_label;

    -- Detail klik per path: agregat target (selaras filter hari WIB dengan top_clicks)
    DELETE FROM public.analytics_daily_top_click_targets
    WHERE web_id = p_web_id AND day = d;

    INSERT INTO public.analytics_daily_top_click_targets (
      web_id, day, path, track_key, element_type, element_label, target_url, is_internal,
      clicks_count, unique_sessions_count
    )
    SELECT
      p_web_id,
      d,
      ce.path,
      COALESCE(ce.track_key, ''),
      ce.element_type,
      ce.element_label,
      COALESCE(ce.target_url, ''),
      COALESCE(ce.is_internal, false),
      COUNT(*)::bigint,
      COUNT(DISTINCT ce.session_id)::bigint
    FROM public.analytics_click_events ce
    WHERE ce.web_id = p_web_id
      AND (timezone('Asia/Jakarta', ce.created_at))::date = d
    GROUP BY
      ce.path,
      COALESCE(ce.track_key, ''),
      ce.element_type,
      ce.element_label,
      COALESCE(ce.target_url, ''),
      COALESCE(ce.is_internal, false);

    DELETE FROM public.analytics_daily_utm
    WHERE web_id = p_web_id AND day = d;

    INSERT INTO public.analytics_daily_utm (
      web_id,
      day,
      route,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      sessions_count,
      page_views_count,
      clicks_count,
      scroll_sessions_count,
      scroll_max_pct_max,
      scroll_max_pct_sum
    )
    SELECT
      p_web_id,
      d,
      ud.route_norm,
      ud.utm_source,
      ud.utm_medium,
      ud.utm_campaign,
      ud.utm_content,
      ud.utm_term,
      COUNT(*)::bigint,
      SUM(COALESCE(pv.cnt, 0::bigint))::bigint,
      SUM(COALESCE(ce.cnt, 0::bigint))::bigint,
      COUNT(*) FILTER (WHERE ss.session_max_scroll_pct IS NOT NULL)::bigint,
      MAX(ss.session_max_scroll_pct)::double precision,
      COALESCE(SUM(ss.session_max_scroll_pct), 0)::double precision
    FROM (
      SELECT
        u.session_id,
        COALESCE(
          left(
            CASE
              WHEN u.route_path = '' AND u.had_landing_ref THEN '/'
              WHEN u.route_path = '' THEN ''
              WHEN left(u.route_path, 1) = '/' THEN u.route_path
              ELSE '/' || u.route_path
            END,
            512
          ),
          ''
        ) AS route_norm,
        u.utm_source,
        u.utm_medium,
        u.utm_campaign,
        u.utm_content,
        u.utm_term
      FROM (
        SELECT
          s.id AS session_id,
          COALESCE(
            trim(both '/' FROM regexp_replace(
              regexp_replace(
                COALESCE(NULLIF(trim(s.landing_url), ''), NULLIF(trim(s.first_landing_url), ''), ''),
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
            NULLIF(trim(s.landing_url), '') IS NOT NULL
            OR NULLIF(trim(s.first_landing_url), '') IS NOT NULL
          ) AS had_landing_ref,
          COALESCE(NULLIF(trim(s.utm_source), ''), '') AS utm_source,
          COALESCE(NULLIF(trim(s.utm_medium), ''), '') AS utm_medium,
          COALESCE(NULLIF(trim(s.utm_campaign), ''), '') AS utm_campaign,
          COALESCE(NULLIF(trim(s.utm_content), ''), '') AS utm_content,
          COALESCE(NULLIF(trim(s.utm_term), ''), '') AS utm_term
        FROM public.analytics_sessions s
        WHERE s.web_id = p_web_id
          AND (timezone('Asia/Jakarta', s.started_at))::date = d
      ) u
    ) ud
    LEFT JOIN (
      SELECT pv2.session_id, COUNT(*)::bigint AS cnt
      FROM public.analytics_page_views pv2
      WHERE pv2.web_id = p_web_id
        AND (timezone('Asia/Jakarta', pv2.started_at))::date = d
      GROUP BY pv2.session_id
    ) pv ON pv.session_id = ud.session_id
    LEFT JOIN (
      SELECT ce2.session_id, COUNT(*)::bigint AS cnt
      FROM public.analytics_click_events ce2
      WHERE ce2.web_id = p_web_id
        AND (timezone('Asia/Jakarta', ce2.created_at))::date = d
      GROUP BY ce2.session_id
    ) ce ON ce.session_id = ud.session_id
    LEFT JOIN (
      SELECT
        pv3.session_id,
        MAX(pv3.scroll_max_pct)::double precision AS session_max_scroll_pct
      FROM public.analytics_page_views pv3
      WHERE pv3.web_id = p_web_id
        AND (timezone('Asia/Jakarta', pv3.started_at))::date = d
        AND pv3.scroll_max_pct IS NOT NULL
      GROUP BY pv3.session_id
    ) ss ON ss.session_id = ud.session_id
    GROUP BY
      ud.route_norm,
      ud.utm_source,
      ud.utm_medium,
      ud.utm_campaign,
      ud.utm_content,
      ud.utm_term;

    -- ----------------------------------------------------------------------
    -- Source breakdown rollup (event-day attribution in WIB)
    -- ----------------------------------------------------------------------
    WITH
      src_keys AS (
        SELECT * FROM (VALUES ('utm'::text), ('paid_click_ids'::text), ('referral'::text), ('direct'::text)) v(source_key)
      ),
      sessions_agg AS (
        SELECT
          CASE
            WHEN COALESCE(
              NULLIF(trim(s.utm_source), ''),
              NULLIF(trim(s.utm_medium), ''),
              NULLIF(trim(s.utm_campaign), ''),
              NULLIF(trim(s.utm_content), ''),
              NULLIF(trim(s.utm_term), '')
            ) IS NOT NULL THEN 'utm'
            WHEN COALESCE(s.has_gclid, false)
              OR COALESCE(s.has_fbclid, false)
              OR COALESCE(s.has_msclkid, false)
              OR COALESCE(s.has_gbraid, false)
              OR COALESCE(s.has_wbraid, false) THEN 'paid_click_ids'
            WHEN NULLIF(trim(COALESCE(s.referrer, s.first_referrer, '')), '') IS NOT NULL THEN 'referral'
            ELSE 'direct'
          END AS source_key,
          COUNT(*)::bigint AS sessions_count
        FROM public.analytics_sessions s
        WHERE s.web_id = p_web_id
          AND (timezone('Asia/Jakarta', s.started_at))::date = d
        GROUP BY 1
      ),
      page_views_agg AS (
        SELECT
          CASE
            WHEN COALESCE(
              NULLIF(trim(s.utm_source), ''),
              NULLIF(trim(s.utm_medium), ''),
              NULLIF(trim(s.utm_campaign), ''),
              NULLIF(trim(s.utm_content), ''),
              NULLIF(trim(s.utm_term), '')
            ) IS NOT NULL THEN 'utm'
            WHEN COALESCE(s.has_gclid, false)
              OR COALESCE(s.has_fbclid, false)
              OR COALESCE(s.has_msclkid, false)
              OR COALESCE(s.has_gbraid, false)
              OR COALESCE(s.has_wbraid, false) THEN 'paid_click_ids'
            WHEN NULLIF(trim(COALESCE(s.referrer, s.first_referrer, '')), '') IS NOT NULL THEN 'referral'
            ELSE 'direct'
          END AS source_key,
          COUNT(*)::bigint AS page_views_count
        FROM public.analytics_page_views pv
        JOIN public.analytics_sessions s
          ON s.id = pv.session_id AND s.web_id = pv.web_id
        WHERE pv.web_id = p_web_id
          AND (timezone('Asia/Jakarta', pv.started_at))::date = d
        GROUP BY 1
      ),
      clicks_agg AS (
        SELECT
          CASE
            WHEN COALESCE(
              NULLIF(trim(s.utm_source), ''),
              NULLIF(trim(s.utm_medium), ''),
              NULLIF(trim(s.utm_campaign), ''),
              NULLIF(trim(s.utm_content), ''),
              NULLIF(trim(s.utm_term), '')
            ) IS NOT NULL THEN 'utm'
            WHEN COALESCE(s.has_gclid, false)
              OR COALESCE(s.has_fbclid, false)
              OR COALESCE(s.has_msclkid, false)
              OR COALESCE(s.has_gbraid, false)
              OR COALESCE(s.has_wbraid, false) THEN 'paid_click_ids'
            WHEN NULLIF(trim(COALESCE(s.referrer, s.first_referrer, '')), '') IS NOT NULL THEN 'referral'
            ELSE 'direct'
          END AS source_key,
          COUNT(*)::bigint AS clicks_count
        FROM public.analytics_click_events ce
        JOIN public.analytics_sessions s
          ON s.id = ce.session_id AND s.web_id = ce.web_id
        WHERE ce.web_id = p_web_id
          AND (timezone('Asia/Jakarta', ce.created_at))::date = d
        GROUP BY 1
      ),
      scroll_sessions AS (
        SELECT
          pv.session_id,
          MAX(pv.scroll_max_pct)::double precision AS session_max_scroll_pct
        FROM public.analytics_page_views pv
        WHERE pv.web_id = p_web_id
          AND (timezone('Asia/Jakarta', pv.started_at))::date = d
          AND pv.scroll_max_pct IS NOT NULL
        GROUP BY pv.session_id
      ),
      scroll_agg AS (
        SELECT
          CASE
            WHEN COALESCE(
              NULLIF(trim(s.utm_source), ''),
              NULLIF(trim(s.utm_medium), ''),
              NULLIF(trim(s.utm_campaign), ''),
              NULLIF(trim(s.utm_content), ''),
              NULLIF(trim(s.utm_term), '')
            ) IS NOT NULL THEN 'utm'
            WHEN COALESCE(s.has_gclid, false)
              OR COALESCE(s.has_fbclid, false)
              OR COALESCE(s.has_msclkid, false)
              OR COALESCE(s.has_gbraid, false)
              OR COALESCE(s.has_wbraid, false) THEN 'paid_click_ids'
            WHEN NULLIF(trim(COALESCE(s.referrer, s.first_referrer, '')), '') IS NOT NULL THEN 'referral'
            ELSE 'direct'
          END AS source_key,
          COUNT(*)::bigint AS scroll_sessions_count,
          MAX(ss.session_max_scroll_pct)::double precision AS scroll_max_pct_max,
          COALESCE(SUM(ss.session_max_scroll_pct), 0)::double precision AS scroll_max_pct_sum
        FROM scroll_sessions ss
        JOIN public.analytics_sessions s
          ON s.id = ss.session_id AND s.web_id = p_web_id
        GROUP BY 1
      )
    INSERT INTO public.analytics_daily_source_breakdown (
      web_id,
      day,
      source_key,
      sessions_count,
      page_views_count,
      clicks_count,
      scroll_sessions_count,
      scroll_max_pct_max,
      scroll_max_pct_sum
    )
    SELECT
      p_web_id,
      d,
      k.source_key,
      COALESCE(sa.sessions_count, 0),
      COALESCE(pva.page_views_count, 0),
      COALESCE(ca.clicks_count, 0),
      COALESCE(sca.scroll_sessions_count, 0),
      sca.scroll_max_pct_max,
      COALESCE(sca.scroll_max_pct_sum, 0)
    FROM src_keys k
    LEFT JOIN sessions_agg sa ON sa.source_key = k.source_key
    LEFT JOIN page_views_agg pva ON pva.source_key = k.source_key
    LEFT JOIN clicks_agg ca ON ca.source_key = k.source_key
    LEFT JOIN scroll_agg sca ON sca.source_key = k.source_key
    ON CONFLICT (web_id, day, source_key) DO UPDATE SET
      sessions_count = EXCLUDED.sessions_count,
      page_views_count = EXCLUDED.page_views_count,
      clicks_count = EXCLUDED.clicks_count,
      scroll_sessions_count = EXCLUDED.scroll_sessions_count,
      scroll_max_pct_max = EXCLUDED.scroll_max_pct_max,
      scroll_max_pct_sum = EXCLUDED.scroll_max_pct_sum,
      updated_at = now();

    d := d + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_analytics_rollups(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_rollups(text, date, date) TO service_role;

