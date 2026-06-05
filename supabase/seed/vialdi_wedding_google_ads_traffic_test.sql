-- TEST ONLY: seed traffic rollup for Google Ads "Web Speed Performance" (vialdi-wedding).
--
-- Google Ads enrichment reads analytics_daily_utm via service_get_traffic_sessions_by_utm_campaign.
-- Traffic UTM table reads analytics_sessions (one row per session).
-- Both must have the SAME session counts per campaign (120+80+55+30 = 285).
--
-- Run alignment script after rollup insert:
--   supabase/seed/vialdi_wedding_google_ads_traffic_test_align_sessions.sql
--
-- Cleanup:
-- DELETE FROM analytics_page_views WHERE web_id = 'vialdi-wedding' AND visitor_id LIKE 'test-gads-%';
-- DELETE FROM analytics_sessions WHERE web_id = 'vialdi-wedding' AND visitor_id LIKE 'test-gads-%';
-- DELETE FROM analytics_daily_utm WHERE web_id = 'vialdi-wedding' AND utm_source = 'google' AND utm_medium = 'cpc_test';

DELETE FROM public.analytics_daily_utm
WHERE web_id = 'vialdi-wedding'
  AND utm_source = 'google'
  AND utm_medium = 'cpc_test';

INSERT INTO public.analytics_daily_utm (
  web_id, day, utm_source, utm_medium, utm_campaign, utm_content, utm_term, route,
  sessions_count, page_views_count, clicks_count
) VALUES
  ('vialdi-wedding', '2026-05-18', 'google', 'cpc_test', 'JASA FOTO WEDDING.', '', '', '/', 30, 30, 0),
  ('vialdi-wedding', '2026-05-22', 'google', 'cpc_test', 'JASA FOTO WEDDING.', '', '', '/', 30, 30, 0),
  ('vialdi-wedding', '2026-05-28', 'google', 'cpc_test', 'JASA FOTO WEDDING.', '', '', '/', 30, 30, 0),
  ('vialdi-wedding', '2026-06-03', 'google', 'cpc_test', 'JASA FOTO WEDDING.', '', '', '/', 30, 30, 0),
  ('vialdi-wedding', '2026-05-19', 'google', 'cpc_test', 'JASA FOTO WEDDING (WINNING KEYWORD CONVERSI DARI THANK YOU PAGE) Q2 2023', '', '', '/', 25, 25, 0),
  ('vialdi-wedding', '2026-05-25', 'google', 'cpc_test', 'JASA FOTO WEDDING (WINNING KEYWORD CONVERSI DARI THANK YOU PAGE) Q2 2023', '', '', '/', 30, 30, 0),
  ('vialdi-wedding', '2026-06-01', 'google', 'cpc_test', 'JASA FOTO WEDDING (WINNING KEYWORD CONVERSI DARI THANK YOU PAGE) Q2 2023', '', '', '/', 25, 25, 0),
  ('vialdi-wedding', '2026-05-21', 'google', 'cpc_test', 'Website traffic-Search Jasa Foto Wedding', '', '', '/', 20, 20, 0),
  ('vialdi-wedding', '2026-05-27', 'google', 'cpc_test', 'Website traffic-Search Jasa Foto Wedding', '', '', '/', 18, 18, 0),
  ('vialdi-wedding', '2026-06-02', 'google', 'cpc_test', 'Website traffic-Search Jasa Foto Wedding', '', '', '/', 17, 17, 0),
  ('vialdi-wedding', '2026-05-23', 'google', 'cpc_test', 'JASA FOTO PREWEDDING', '', '', '/', 12, 12, 0),
  ('vialdi-wedding', '2026-05-30', 'google', 'cpc_test', 'JASA FOTO PREWEDDING', '', '', '/', 18, 18, 0)
ON CONFLICT (web_id, day, utm_source, utm_medium, utm_campaign, utm_content, utm_term, route)
DO UPDATE SET
  sessions_count = EXCLUDED.sessions_count,
  page_views_count = EXCLUDED.page_views_count;
