-- Add deep scroll rollup metrics to daily top pages.
-- Fair aggregation: session contributes once per day+path with its max scroll pct.

ALTER TABLE public.analytics_daily_top_pages
  ADD COLUMN IF NOT EXISTS scroll_sessions_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scroll_max_pct_max double precision NULL,
  ADD COLUMN IF NOT EXISTS scroll_max_pct_sum double precision NOT NULL DEFAULT 0;

