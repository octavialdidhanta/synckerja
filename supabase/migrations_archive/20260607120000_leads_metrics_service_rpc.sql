-- Internal leads RPC for Google Ads edge enrichment (service_role only).
-- Counts all leads by exact-case utm_campaign (after btrim) for an organization and date range.

CREATE OR REPLACE FUNCTION public.service_get_leads_by_utm_campaign(
  p_organization_id uuid,
  p_from date,
  p_to date
)
RETURNS TABLE (utm_campaign_key text, leads_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz;
  v_to timestamptz;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'date range is required';
  END IF;

  IF p_to < p_from THEN
    RAISE EXCEPTION 'invalid range';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o WHERE o.id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_from := (p_from::text || 'T00:00:00.000Z')::timestamptz;
  v_to := (p_to::text || 'T23:59:59.999Z')::timestamptz;

  RETURN QUERY
  SELECT
    btrim(l.attribution ->> 'utm_campaign') AS utm_campaign_key,
    COUNT(*)::bigint AS leads_count
  FROM public.leads l
  WHERE l.organization_id = p_organization_id
    AND l.created_at >= v_from
    AND l.created_at <= v_to
    AND btrim(COALESCE(l.attribution ->> 'utm_campaign', '')) <> ''
  GROUP BY btrim(l.attribution ->> 'utm_campaign');
END;
$$;

REVOKE ALL ON FUNCTION public.service_get_leads_by_utm_campaign(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_get_leads_by_utm_campaign(uuid, date, date) TO service_role;

COMMENT ON FUNCTION public.service_get_leads_by_utm_campaign(uuid, date, date) IS
  'Count leads grouped by exact-case btrim(utm_campaign) for org-scoped Google Ads enrichment (service_role only).';
