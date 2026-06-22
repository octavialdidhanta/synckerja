-- Speed up floating WA stub dedupe: one lead per analytics_session_id + web_id per org.
CREATE INDEX IF NOT EXISTS idx_leads_org_web_analytics_session
  ON public.leads (organization_id, web_id, analytics_session_id)
  WHERE analytics_session_id IS NOT NULL;
