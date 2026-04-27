-- Daily top click targets rollup (adds target_url for "direct to" column).
-- Kept separate from analytics_daily_top_clicks to avoid PK/compat breaking changes.

CREATE TABLE IF NOT EXISTS public.analytics_daily_top_click_targets (
  web_id text NOT NULL,
  day date NOT NULL,
  path text NOT NULL,
  track_key text NOT NULL DEFAULT '',
  element_type text NOT NULL,
  element_label text NOT NULL,
  target_url text NOT NULL DEFAULT '',
  is_internal boolean NOT NULL DEFAULT false,
  clicks_count bigint NOT NULL DEFAULT 0,
  unique_sessions_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_daily_top_click_targets_pkey PRIMARY KEY (
    web_id, day, path, element_type, element_label, track_key, target_url
  )
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_top_click_targets_web_day_clicks
  ON public.analytics_daily_top_click_targets (web_id, day, clicks_count DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_top_click_targets_web_day_path_clicks
  ON public.analytics_daily_top_click_targets (web_id, day, path, clicks_count DESC);

-- RLS: defense-in-depth (RPC is primary access)
ALTER TABLE public.analytics_daily_top_click_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics_daily_top_click_targets_select_web" ON public.analytics_daily_top_click_targets;
CREATE POLICY "analytics_daily_top_click_targets_select_web"
  ON public.analytics_daily_top_click_targets FOR SELECT TO authenticated
  USING (public.can_access_web_id(web_id));

