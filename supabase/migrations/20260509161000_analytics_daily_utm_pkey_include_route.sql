-- Drift: kolom `route` sudah dipakai rollup WIB, tetapi PK masih skema lama tanpa `route`
-- (nama constraint `analytics_daily_utm_pkey1`). INSERT multi-route per bucket UTM bentrok → duplicate key.
--
-- Jangan pakai nama constraint/index `analytics_daily_utm_pkey` jika ada tabel lain (mis.
-- `analytics_daily_utm_legacy`) yang sudah memakai index itu — nama index harus unik per schema.

ALTER TABLE public.analytics_daily_utm DROP CONSTRAINT IF EXISTS analytics_daily_utm_pkey1;

ALTER TABLE public.analytics_daily_utm
  ADD CONSTRAINT analytics_daily_utm_route_pkey PRIMARY KEY (
    web_id,
    day,
    route,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term
  );

CREATE INDEX IF NOT EXISTS idx_analytics_daily_utm_web_day_route
  ON public.analytics_daily_utm (web_id, day, route);
