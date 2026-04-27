-- Analytics rollups (daily) for fast dashboard queries at scale (millions of events)

-- Daily sessions rollup
CREATE TABLE IF NOT EXISTS public.analytics_daily_sessions (
  web_id text NOT NULL,
  day date NOT NULL,
  sessions_count bigint NOT NULL DEFAULT 0,
  sessions_with_utm_count bigint NOT NULL DEFAULT 0,
  sessions_with_gclid_count bigint NOT NULL DEFAULT 0,
  sessions_with_fbclid_count bigint NOT NULL DEFAULT 0,
  sessions_with_msclkid_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_daily_sessions_pkey PRIMARY KEY (web_id, day)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_sessions_day
  ON public.analytics_daily_sessions (day);

-- Daily page views rollup (overall)
CREATE TABLE IF NOT EXISTS public.analytics_daily_page_views (
  web_id text NOT NULL,
  day date NOT NULL,
  page_views_count bigint NOT NULL DEFAULT 0,
  active_ms_sum bigint NOT NULL DEFAULT 0,
  unique_sessions_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_daily_page_views_pkey PRIMARY KEY (web_id, day)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_page_views_day
  ON public.analytics_daily_page_views (day);

-- Daily clicks rollup (overall)
CREATE TABLE IF NOT EXISTS public.analytics_daily_clicks (
  web_id text NOT NULL,
  day date NOT NULL,
  clicks_count bigint NOT NULL DEFAULT 0,
  unique_sessions_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_daily_clicks_pkey PRIMARY KEY (web_id, day)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_clicks_day
  ON public.analytics_daily_clicks (day);

-- Daily top pages rollup
CREATE TABLE IF NOT EXISTS public.analytics_daily_top_pages (
  web_id text NOT NULL,
  day date NOT NULL,
  path text NOT NULL,
  page_views_count bigint NOT NULL DEFAULT 0,
  active_ms_sum bigint NOT NULL DEFAULT 0,
  unique_sessions_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_daily_top_pages_pkey PRIMARY KEY (web_id, day, path)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_top_pages_web_day_views
  ON public.analytics_daily_top_pages (web_id, day, page_views_count DESC);

-- Daily top clicks rollup
CREATE TABLE IF NOT EXISTS public.analytics_daily_top_clicks (
  web_id text NOT NULL,
  day date NOT NULL,
  path text NOT NULL,
  track_key text NULL,
  element_type text NOT NULL,
  element_label text NOT NULL,
  clicks_count bigint NOT NULL DEFAULT 0,
  unique_sessions_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_daily_top_clicks_pkey PRIMARY KEY (web_id, day, path, element_type, element_label, track_key)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_top_clicks_web_day_clicks
  ON public.analytics_daily_top_clicks (web_id, day, clicks_count DESC);

-- Daily UTM rollup (landing now: analytics_sessions.utm_*)
CREATE TABLE IF NOT EXISTS public.analytics_daily_utm (
  web_id text NOT NULL,
  day date NOT NULL,
  utm_source text NOT NULL DEFAULT '',
  utm_medium text NOT NULL DEFAULT '',
  utm_campaign text NOT NULL DEFAULT '',
  utm_content text NOT NULL DEFAULT '',
  utm_term text NOT NULL DEFAULT '',
  sessions_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_daily_utm_pkey PRIMARY KEY (
    web_id, day, utm_source, utm_medium, utm_campaign, utm_content, utm_term
  )
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_utm_web_day_sessions
  ON public.analytics_daily_utm (web_id, day, sessions_count DESC);

-- ----------------------------------------------------------------------------
-- RLS: allow reading rollups only when user can access the web_id
-- (Front-end will still use RPC; this is defense-in-depth.)
-- ----------------------------------------------------------------------------

ALTER TABLE public.analytics_daily_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily_top_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily_top_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily_utm ENABLE ROW LEVEL SECURITY;

-- Sessions
DROP POLICY IF EXISTS "analytics_daily_sessions_select_web" ON public.analytics_daily_sessions;
CREATE POLICY "analytics_daily_sessions_select_web"
  ON public.analytics_daily_sessions FOR SELECT TO authenticated
  USING (public.can_access_web_id(web_id));

-- Page views
DROP POLICY IF EXISTS "analytics_daily_page_views_select_web" ON public.analytics_daily_page_views;
CREATE POLICY "analytics_daily_page_views_select_web"
  ON public.analytics_daily_page_views FOR SELECT TO authenticated
  USING (public.can_access_web_id(web_id));

-- Clicks
DROP POLICY IF EXISTS "analytics_daily_clicks_select_web" ON public.analytics_daily_clicks;
CREATE POLICY "analytics_daily_clicks_select_web"
  ON public.analytics_daily_clicks FOR SELECT TO authenticated
  USING (public.can_access_web_id(web_id));

-- Top pages
DROP POLICY IF EXISTS "analytics_daily_top_pages_select_web" ON public.analytics_daily_top_pages;
CREATE POLICY "analytics_daily_top_pages_select_web"
  ON public.analytics_daily_top_pages FOR SELECT TO authenticated
  USING (public.can_access_web_id(web_id));

-- Top clicks
DROP POLICY IF EXISTS "analytics_daily_top_clicks_select_web" ON public.analytics_daily_top_clicks;
CREATE POLICY "analytics_daily_top_clicks_select_web"
  ON public.analytics_daily_top_clicks FOR SELECT TO authenticated
  USING (public.can_access_web_id(web_id));

-- UTM
DROP POLICY IF EXISTS "analytics_daily_utm_select_web" ON public.analytics_daily_utm;
CREATE POLICY "analytics_daily_utm_select_web"
  ON public.analytics_daily_utm FOR SELECT TO authenticated
  USING (public.can_access_web_id(web_id));

