-- Add deep scroll rollup metrics to daily UTM breakdown.
-- Fair aggregation: session contributes once with its max scroll pct for that day.

ALTER TABLE public.analytics_daily_utm
  ADD COLUMN IF NOT EXISTS scroll_sessions_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scroll_max_pct_max double precision NULL,
  ADD COLUMN IF NOT EXISTS scroll_max_pct_sum double precision NOT NULL DEFAULT 0;

