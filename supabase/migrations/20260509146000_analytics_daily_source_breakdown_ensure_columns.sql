-- Tabel analytics_daily_source_breakdown seharusnya punya page_views_count & clicks_count
-- (20260427161000) serta kolom scroll (20260429233000). Skema DB yang tidak lengkap
-- memicu: column b.page_views_count does not exist pada get_traffic_dashboard.

ALTER TABLE public.analytics_daily_source_breakdown
  ADD COLUMN IF NOT EXISTS sessions_count bigint NOT NULL DEFAULT 0;

ALTER TABLE public.analytics_daily_source_breakdown
  ADD COLUMN IF NOT EXISTS page_views_count bigint NOT NULL DEFAULT 0;

ALTER TABLE public.analytics_daily_source_breakdown
  ADD COLUMN IF NOT EXISTS clicks_count bigint NOT NULL DEFAULT 0;

ALTER TABLE public.analytics_daily_source_breakdown
  ADD COLUMN IF NOT EXISTS scroll_sessions_count bigint NOT NULL DEFAULT 0;

ALTER TABLE public.analytics_daily_source_breakdown
  ADD COLUMN IF NOT EXISTS scroll_max_pct_max double precision NULL;

ALTER TABLE public.analytics_daily_source_breakdown
  ADD COLUMN IF NOT EXISTS scroll_max_pct_sum double precision NOT NULL DEFAULT 0;
