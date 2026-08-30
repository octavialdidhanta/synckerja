-- Security Advisor: RLS Disabled in Public (0021)
-- Transient staging + deferred-flush tables are trigger-only (SECURITY DEFINER).
-- Enable RLS with no policies so PostgREST/anon/authenticated cannot read or write.

ALTER TABLE public.operational_inventory_alert_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_inventory_alert_tx_flush ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.operational_inventory_alert_staging FROM anon, authenticated;
REVOKE ALL ON TABLE public.operational_inventory_alert_tx_flush FROM anon, authenticated;
