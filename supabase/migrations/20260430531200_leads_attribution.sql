-- Marketing / UTM attribution on CRM leads (Leads Management table + filters).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS attribution jsonb NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS attribution_label text NULL;

COMMENT ON COLUMN public.leads.attribution IS 'First-touch or capture-time UTM and landing context (JSON), e.g. utm_source, utm_medium, landing_url.';
COMMENT ON COLUMN public.leads.attribution_label IS 'Human-readable attribution summary for display.';
