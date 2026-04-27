-- refresh_analytics_rollups: map root landing (/?query or /) to '/' when landing_url / first_landing_url are set.

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
      (SELECT MIN((started_at AT TIME ZONE 'UTC')::date) FROM public.analytics_sessions s WHERE s.web_id = p_web_id),
      (SELECT MIN((started_at AT TIME ZONE 'UTC')::date) FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id),
      (SELECT MIN((created_at AT TIME ZONE 'UTC')::date) FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id)
    ),
    GREATEST(
      (SELECT MAX((started_at AT TIME ZONE 'UTC')::date) FROM public.analytics_sessions s WHERE s.web_id = p_web_id),
      (SELECT MAX((started_at AT TIME ZONE 'UTC')::date) FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id),
      (SELECT MAX((created_at AT TIME ZONE 'UTC')::date) FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id)
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
      AND (s.started_at AT TIME ZONE 'UTC')::date = d
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
      AND (pv.started_at AT TIME ZONE 'UTC')::date = d
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
      AND (ce.created_at AT TIME ZONE 'UTC')::date = d
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
      AND (pv.started_at AT TIME ZONE 'UTC')::date = d
    GROUP BY pv.path;

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
      AND (ce.created_at AT TIME ZONE 'UTC')::date = d
    GROUP BY ce.path, COALESCE(ce.track_key, ''), ce.element_type, ce.element_label;

    DELETE FROM public.analytics_daily_utm
    WHERE web_id = p_web_id AND day = d;

    INSERT INTO public.analytics_daily_utm (
      web_id, day, route, utm_source, utm_medium, utm_campaign, utm_content, utm_term, sessions_count
    )
    SELECT
      p_web_id,
      d,
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
      ),
      u.utm_source,
      u.utm_medium,
      u.utm_campaign,
      u.utm_content,
      u.utm_term,
      COUNT(*)::bigint
    FROM (
      SELECT
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
        AND (s.started_at AT TIME ZONE 'UTC')::date = d
    ) u
    GROUP BY
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
      ),
      u.utm_source,
      u.utm_medium,
      u.utm_campaign,
      u.utm_content,
      u.utm_term;

    d := d + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_analytics_rollups(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_rollups(text, date, date) TO service_role;
