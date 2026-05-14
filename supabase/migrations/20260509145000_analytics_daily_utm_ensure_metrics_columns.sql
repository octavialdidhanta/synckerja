-- Skema awal analytics_daily_utm (20260427095400) hanya punya sessions_count.
-- get_traffic_dashboard memakai page_views_count, clicks_count, dan metrik scroll.
-- Tanpa migrasi 20260427140000 / 20260429234500, error: column u.page_views_count does not exist.

ALTER TABLE public.analytics_daily_utm
  ADD COLUMN IF NOT EXISTS page_views_count bigint NOT NULL DEFAULT 0;

ALTER TABLE public.analytics_daily_utm
  ADD COLUMN IF NOT EXISTS clicks_count bigint NOT NULL DEFAULT 0;

ALTER TABLE public.analytics_daily_utm
  ADD COLUMN IF NOT EXISTS scroll_sessions_count bigint NOT NULL DEFAULT 0;

ALTER TABLE public.analytics_daily_utm
  ADD COLUMN IF NOT EXISTS scroll_max_pct_max double precision NULL;

ALTER TABLE public.analytics_daily_utm
  ADD COLUMN IF NOT EXISTS scroll_max_pct_sum double precision NOT NULL DEFAULT 0;
