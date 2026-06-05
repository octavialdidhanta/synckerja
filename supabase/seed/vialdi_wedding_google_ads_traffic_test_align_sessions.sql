-- TEST ONLY: align raw sessions with rollup counts (285 total for 4 Google Ads campaigns).
-- Run AFTER vialdi_wedding_google_ads_traffic_test.sql

DELETE FROM analytics_page_views
WHERE web_id = 'vialdi-wedding' AND visitor_id LIKE 'test-gads-%';

DELETE FROM analytics_sessions
WHERE web_id = 'vialdi-wedding' AND visitor_id LIKE 'test-gads-%';

WITH targets(campaign, cnt, base_day) AS (
  VALUES
    ('JASA FOTO WEDDING.'::text, 120, '2026-05-18'::date),
    ('JASA FOTO WEDDING (WINNING KEYWORD CONVERSI DARI THANK YOU PAGE) Q2 2023'::text, 80, '2026-05-19'::date),
    ('Website traffic-Search Jasa Foto Wedding'::text, 55, '2026-05-21'::date),
    ('JASA FOTO PREWEDDING'::text, 30, '2026-05-23'::date)
),
expanded AS (
  SELECT
    t.campaign,
    gs AS seq,
    (t.base_day + ((gs - 1) % 14))::date AS day,
    gen_random_uuid() AS session_id,
    ('test-gads-' || lpad(gs::text, 4, '0') || '-' || substr(md5(t.campaign || gs::text), 1, 8)) AS visitor_id
  FROM targets t
  CROSS JOIN LATERAL generate_series(1, t.cnt) AS gs
),
ins_sessions AS (
  INSERT INTO public.analytics_sessions (
    id, web_id, visitor_id, started_at, last_seen_at,
    landing_url, first_landing_url, last_landing_url,
    utm_source, utm_medium, utm_campaign,
    first_utm_source, first_utm_medium, first_utm_campaign,
    last_utm_source, last_utm_medium, last_utm_campaign,
    has_gclid, first_has_gclid, last_has_gclid
  )
  SELECT
    e.session_id,
    'vialdi-wedding',
    e.visitor_id,
    (e.day + time '10:00:00' + (e.seq || ' minutes')::interval) AT TIME ZONE 'Asia/Jakarta',
    (e.day + time '10:00:00' + (e.seq || ' minutes')::interval) AT TIME ZONE 'Asia/Jakarta',
    '/?utm_source=google&utm_medium=cpc&utm_campaign=' || replace(e.campaign, ' ', '%20'),
    '/?utm_source=google&utm_medium=cpc&utm_campaign=' || replace(e.campaign, ' ', '%20'),
    '/?utm_source=google&utm_medium=cpc&utm_campaign=' || replace(e.campaign, ' ', '%20'),
    'google', 'cpc', e.campaign,
    'google', 'cpc', e.campaign,
    'google', 'cpc', e.campaign,
    true, true, true
  FROM expanded e
  RETURNING id, visitor_id, started_at
)
INSERT INTO public.analytics_page_views (
  id, session_id, web_id, visitor_id, path, started_at, active_ms, scroll_max_pct
)
SELECT
  gen_random_uuid(),
  s.id,
  'vialdi-wedding',
  s.visitor_id,
  '/',
  s.started_at,
  5000,
  50
FROM ins_sessions s;

UPDATE analytics_daily_utm
SET page_views_count = sessions_count
WHERE web_id = 'vialdi-wedding' AND utm_medium = 'cpc_test';
