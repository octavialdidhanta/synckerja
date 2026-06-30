-- Security Advisor:
-- - Security Definer View (0010): set security_invoker on public views so caller RLS applies.
-- - RLS Disabled in Public (0021): enable RLS on internal analytics debounce table (service_role only).

ALTER VIEW public.organization_xendit_accounts SET (security_invoker = true);

ALTER VIEW public.v_social_media_schedules_pending_late SET (security_invoker = true);
ALTER VIEW public.v_social_media_schedules_stuck_publishing SET (security_invoker = true);
ALTER VIEW public.v_social_media_schedules_failed_24h SET (security_invoker = true);
ALTER VIEW public.v_social_media_schedules_rate_deferred SET (security_invoker = true);
ALTER VIEW public.v_social_media_scheduler_tick_stats_1h SET (security_invoker = true);

ALTER TABLE public.analytics_rollup_refresh_state ENABLE ROW LEVEL SECURITY;
-- No policies: service_role only (maybe_refresh_analytics_rollups SECURITY DEFINER path).
