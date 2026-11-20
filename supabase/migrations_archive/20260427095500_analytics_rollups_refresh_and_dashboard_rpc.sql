-- Rollup refresh + dashboard RPC

-- Utility: update updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_touch_analytics_daily_sessions') THEN
    CREATE TRIGGER trg_touch_analytics_daily_sessions
      BEFORE UPDATE ON public.analytics_daily_sessions
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_touch_analytics_daily_page_views') THEN
    CREATE TRIGGER trg_touch_analytics_daily_page_views
      BEFORE UPDATE ON public.analytics_daily_page_views
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_touch_analytics_daily_clicks') THEN
    CREATE TRIGGER trg_touch_analytics_daily_clicks
      BEFORE UPDATE ON public.analytics_daily_clicks
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_touch_analytics_daily_top_pages') THEN
    CREATE TRIGGER trg_touch_analytics_daily_top_pages
      BEFORE UPDATE ON public.analytics_daily_top_pages
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_touch_analytics_daily_top_clicks') THEN
    CREATE TRIGGER trg_touch_analytics_daily_top_clicks
      BEFORE UPDATE ON public.analytics_daily_top_clicks
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_touch_analytics_daily_utm') THEN
    CREATE TRIGGER trg_touch_analytics_daily_utm
      BEFORE UPDATE ON public.analytics_daily_utm
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Refresh rollups from raw tables for (web_id, day range).
-- Intended for cron/service role only.
-- ---------------------------------------------------------------------------

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
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'from/to are required';
  END IF;
  IF p_to < p_from THEN
    RAISE EXCEPTION 'invalid range';
  END IF;

  -- Only allow service_role to execute (no partner/user access).
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  d := p_from;
  WHILE d <= p_to LOOP
    -- Sessions rollup (landing now: utm_*)
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

    -- Page views rollup
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

    -- Clicks rollup
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

    -- Top pages per day
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

    -- Top clicks per day
    DELETE FROM public.analytics_daily_top_clicks
    WHERE web_id = p_web_id AND day = d;

    INSERT INTO public.analytics_daily_top_clicks (
      web_id, day, path, track_key, element_type, element_label, clicks_count, unique_sessions_count
    )
    SELECT
      p_web_id,
      d,
      ce.path,
      ce.track_key,
      ce.element_type,
      ce.element_label,
      COUNT(*)::bigint,
      COUNT(DISTINCT ce.session_id)::bigint
    FROM public.analytics_click_events ce
    WHERE ce.web_id = p_web_id
      AND (ce.created_at AT TIME ZONE 'UTC')::date = d
    GROUP BY ce.path, ce.track_key, ce.element_type, ce.element_label;

    -- UTM per day (landing now from sessions)
    DELETE FROM public.analytics_daily_utm
    WHERE web_id = p_web_id AND day = d;

    INSERT INTO public.analytics_daily_utm (
      web_id, day, utm_source, utm_medium, utm_campaign, utm_content, utm_term, sessions_count
    )
    SELECT
      p_web_id,
      d,
      COALESCE(NULLIF(trim(s.utm_source), ''), ''),
      COALESCE(NULLIF(trim(s.utm_medium), ''), ''),
      COALESCE(NULLIF(trim(s.utm_campaign), ''), ''),
      COALESCE(NULLIF(trim(s.utm_content), ''), ''),
      COALESCE(NULLIF(trim(s.utm_term), ''), ''),
      COUNT(*)::bigint
    FROM public.analytics_sessions s
    WHERE s.web_id = p_web_id
      AND (s.started_at AT TIME ZONE 'UTC')::date = d
    GROUP BY 3, 4, 5, 6, 7;

    d := d + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_analytics_rollups(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_rollups(text, date, date) TO service_role;

-- ---------------------------------------------------------------------------
-- Dashboard RPC for `/digital-marketing/traffic`
-- Reads rollups only; validates access via analytics_web_access.
-- ---------------------------------------------------------------------------

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
  funnel jsonb;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'from/to are required';
  END IF;
  IF p_to < p_from THEN
    RAISE EXCEPTION 'invalid range';
  END IF;

  IF NOT public.can_access_web_id(p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- KPIs
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
    AND s.day BETWEEN p_from AND p_to;

  -- Series per day
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
      AND s.day BETWEEN p_from AND p_to
    ORDER BY s.day
  ) d;

  -- Top pages (range aggregate)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'path', path,
    'page_views', page_views,
    'avg_active_ms', avg_active_ms
  ) ORDER BY page_views DESC), '[]'::jsonb)
  INTO top_pages
  FROM (
    SELECT
      tp.path,
      SUM(tp.page_views_count)::bigint AS page_views,
      CASE
        WHEN SUM(tp.page_views_count) = 0 THEN 0
        ELSE (SUM(tp.active_ms_sum) / NULLIF(SUM(tp.page_views_count), 0))::bigint
      END AS avg_active_ms
    FROM public.analytics_daily_top_pages tp
    WHERE tp.web_id = p_web_id
      AND tp.day BETWEEN p_from AND p_to
    GROUP BY tp.path
    ORDER BY SUM(tp.page_views_count) DESC
    LIMIT GREATEST(1, LEAST(p_top_pages_limit, 100))
  ) t;

  -- Top clicks (range aggregate)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'path', path,
    'track_key', track_key,
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
      AND tc.day BETWEEN p_from AND p_to
    GROUP BY tc.path, tc.track_key, tc.element_type, tc.element_label
    ORDER BY SUM(tc.clicks_count) DESC
    LIMIT GREATEST(1, LEAST(p_top_clicks_limit, 100))
  ) t;

  -- UTM table (range aggregate)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'utm_campaign', utm_campaign,
    'utm_source', utm_source,
    'utm_medium', utm_medium,
    'utm_content', utm_content,
    'utm_term', utm_term,
    'sessions', sessions
  ) ORDER BY sessions DESC), '[]'::jsonb)
  INTO utm_table
  FROM (
    SELECT
      NULLIF(utm_campaign, '') AS utm_campaign,
      NULLIF(utm_source, '') AS utm_source,
      NULLIF(utm_medium, '') AS utm_medium,
      NULLIF(utm_content, '') AS utm_content,
      NULLIF(utm_term, '') AS utm_term,
      SUM(u.sessions_count)::bigint AS sessions
    FROM public.analytics_daily_utm u
    WHERE u.web_id = p_web_id
      AND u.day BETWEEN p_from AND p_to
    GROUP BY utm_campaign, utm_source, utm_medium, utm_content, utm_term
    ORDER BY SUM(u.sessions_count) DESC
    LIMIT GREATEST(1, LEAST(p_utm_limit, 2000))
  ) t;

  -- Simple funnel
  funnel := jsonb_build_object(
    'sessions', (kpis->>'sessions')::bigint,
    'page_views', (kpis->>'page_views')::bigint,
    'clicks', (kpis->>'clicks')::bigint
  );

  RETURN jsonb_build_object(
    'web_id', p_web_id,
    'from', p_from,
    'to', p_to,
    'kpis', kpis,
    'series', series,
    'top_pages', top_pages,
    'top_clicks', top_clicks,
    'utm_table', utm_table,
    'funnel', funnel
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_traffic_dashboard(text, date, date, int, int, int) TO authenticated;

