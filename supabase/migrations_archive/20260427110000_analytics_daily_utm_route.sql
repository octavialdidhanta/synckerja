-- UTM rollup: add landing route (path) — DDL only (functions in next migration).

ALTER TABLE public.analytics_daily_utm
  ADD COLUMN IF NOT EXISTS route text NOT NULL DEFAULT '';

ALTER TABLE public.analytics_daily_utm DROP CONSTRAINT IF EXISTS analytics_daily_utm_pkey;

ALTER TABLE public.analytics_daily_utm
  ADD CONSTRAINT analytics_daily_utm_pkey PRIMARY KEY (
    web_id, day, route, utm_source, utm_medium, utm_campaign, utm_content, utm_term
  );

CREATE INDEX IF NOT EXISTS idx_analytics_daily_utm_web_day_route
  ON public.analytics_daily_utm (web_id, day, route);
