-- Perbaikan DB yang belum punya kolom `route` di rollup UTM (biasanya migrasi
-- 20260427110000_analytics_daily_utm_route.sql tidak pernah di-apply).
-- Tanpa ini, get_traffic_dashboard memicu: column u.route does not exist.

ALTER TABLE public.analytics_daily_utm
  ADD COLUMN IF NOT EXISTS route text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_analytics_daily_utm_web_day_route
  ON public.analytics_daily_utm (web_id, day, route);

-- Kolom agregat lain (page_views_count, clicks, scroll): 20260509145000_analytics_daily_utm_ensure_metrics_columns.sql
