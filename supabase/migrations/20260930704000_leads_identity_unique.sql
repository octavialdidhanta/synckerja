-- Fase 3 Migration B: enforce one active lead per normalized phone / email per org.
-- Apply ONLY after merge_customer_lead_duplicates_execute has been run for orgs with duplicates.
-- Soft-archived losers (merged_into_lead_id IS NOT NULL) are excluded via partial predicate.

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_org_active_phone_key
  ON public.leads (organization_id, (public.normalize_wa_phone_key(phone_number)))
  WHERE phone_number IS NOT NULL
    AND public.normalize_wa_phone_key(phone_number) IS NOT NULL
    AND merged_into_lead_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_org_active_email_key
  ON public.leads (organization_id, (lower(btrim(email))))
  WHERE email IS NOT NULL
    AND length(btrim(email)) > 0
    AND merged_into_lead_id IS NULL;

COMMENT ON INDEX public.uq_leads_org_active_phone_key IS
  'Fase 3: at most one active lead per org + normalized phone.';
COMMENT ON INDEX public.uq_leads_org_active_email_key IS
  'Fase 3: at most one active lead per org + normalized email.';
