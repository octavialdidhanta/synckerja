-- Manual sanity checks for source_breakdown rollup.
-- Replace :web_id, :from, :to in your SQL runner.

-- 1) Reconcile sessions: KPI sessions (from analytics_daily_sessions) vs sum(source_breakdown.sessions_count).
-- Expect: same number for same web_id & date range.
WITH bounds AS (
  SELECT ':web_id'::text AS web_id, ':from'::date AS d_from, ':to'::date AS d_to
)
SELECT
  (SELECT COALESCE(SUM(s.sessions_count), 0)::bigint
   FROM public.analytics_daily_sessions s, bounds b
   WHERE s.web_id = b.web_id AND s.day BETWEEN b.d_from AND b.d_to) AS kpi_sessions,
  (SELECT COALESCE(SUM(bd.sessions_count), 0)::bigint
   FROM public.analytics_daily_source_breakdown bd, bounds b
   WHERE bd.web_id = b.web_id AND bd.day BETWEEN b.d_from AND b.d_to) AS breakdown_sessions;

-- 2) Reconcile page views: KPI PV (event-day) vs breakdown PV sum (event-day).
WITH bounds AS (
  SELECT ':web_id'::text AS web_id, ':from'::date AS d_from, ':to'::date AS d_to
)
SELECT
  (SELECT COALESCE(SUM(pv.page_views_count), 0)::bigint
   FROM public.analytics_daily_page_views pv, bounds b
   WHERE pv.web_id = b.web_id AND pv.day BETWEEN b.d_from AND b.d_to) AS kpi_page_views,
  (SELECT COALESCE(SUM(bd.page_views_count), 0)::bigint
   FROM public.analytics_daily_source_breakdown bd, bounds b
   WHERE bd.web_id = b.web_id AND bd.day BETWEEN b.d_from AND b.d_to) AS breakdown_page_views;

-- 3) Reconcile clicks: KPI clicks (event-day) vs breakdown clicks sum (event-day).
WITH bounds AS (
  SELECT ':web_id'::text AS web_id, ':from'::date AS d_from, ':to'::date AS d_to
)
SELECT
  (SELECT COALESCE(SUM(c.clicks_count), 0)::bigint
   FROM public.analytics_daily_clicks c, bounds b
   WHERE c.web_id = b.web_id AND c.day BETWEEN b.d_from AND b.d_to) AS kpi_clicks,
  (SELECT COALESCE(SUM(bd.clicks_count), 0)::bigint
   FROM public.analytics_daily_source_breakdown bd, bounds b
   WHERE bd.web_id = b.web_id AND bd.day BETWEEN b.d_from AND b.d_to) AS breakdown_clicks;

-- 4) Spot-check per-day totals (useful to find drift on specific dates).
WITH bounds AS (
  SELECT ':web_id'::text AS web_id, ':from'::date AS d_from, ':to'::date AS d_to
),
per_day AS (
  SELECT
    d.day,
    COALESCE(s.sessions_count, 0)::bigint AS kpi_sessions,
    COALESCE(SUM(bd.sessions_count), 0)::bigint AS breakdown_sessions
  FROM (
    SELECT generate_series((SELECT d_from FROM bounds), (SELECT d_to FROM bounds), '1 day'::interval)::date AS day
  ) d
  LEFT JOIN public.analytics_daily_sessions s
    ON s.web_id = (SELECT web_id FROM bounds) AND s.day = d.day
  LEFT JOIN public.analytics_daily_source_breakdown bd
    ON bd.web_id = (SELECT web_id FROM bounds) AND bd.day = d.day
  GROUP BY d.day, s.sessions_count
)
SELECT * FROM per_day ORDER BY day;

