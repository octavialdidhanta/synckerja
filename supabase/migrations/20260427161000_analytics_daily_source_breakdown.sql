-- Daily source breakdown rollup (sessions / page views / clicks) per acquisition channel.
-- Designed to keep dashboard queries fast at scale (millions of events).

CREATE TABLE IF NOT EXISTS public.analytics_daily_source_breakdown (
  web_id text NOT NULL,
  day date NOT NULL,
  source_key text NOT NULL,
  sessions_count bigint NOT NULL DEFAULT 0,
  page_views_count bigint NOT NULL DEFAULT 0,
  clicks_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_daily_source_breakdown_source_key_check CHECK (
    source_key = ANY (ARRAY['utm'::text, 'paid_click_ids'::text, 'referral'::text, 'direct'::text])
  ),
  CONSTRAINT analytics_daily_source_breakdown_pkey PRIMARY KEY (web_id, day, source_key)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_source_breakdown_day
  ON public.analytics_daily_source_breakdown (day);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_source_breakdown_web_day
  ON public.analytics_daily_source_breakdown (web_id, day);

-- ----------------------------------------------------------------------------
-- RLS: defense-in-depth (RPC is primary access)
-- ----------------------------------------------------------------------------

ALTER TABLE public.analytics_daily_source_breakdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_daily_source_breakdown_select_web" ON public.analytics_daily_source_breakdown;
CREATE POLICY "analytics_daily_source_breakdown_select_web"
  ON public.analytics_daily_source_breakdown FOR SELECT TO authenticated
  USING (public.can_access_web_id(web_id));

