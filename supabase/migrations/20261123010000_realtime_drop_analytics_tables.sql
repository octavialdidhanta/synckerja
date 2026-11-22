-- Website analytics tables are written on every visit and no client listens to them.
-- Keeping them in the Realtime publication made WAL decoding the top database cost.
ALTER PUBLICATION supabase_realtime DROP TABLE public.analytics_page_views, public.analytics_sessions, public.analytics_click_events;
