-- Add deep scroll rollup metrics to daily source breakdown.
-- These support range aggregates without scanning raw analytics_page_views.

ALTER TABLE public.analytics_daily_source_breakdown
  ADD COLUMN IF NOT EXISTS scroll_sessions_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scroll_max_pct_max double precision NULL,
  ADD COLUMN IF NOT EXISTS scroll_max_pct_sum double precision NOT NULL DEFAULT 0;

