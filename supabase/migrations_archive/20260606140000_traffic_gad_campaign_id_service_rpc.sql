-- Google Ads auto-tagging often passes gad_campaignid in landing URLs while utm_campaign stays generic.
-- Edge enrichment can fall back to this map when utm_campaign name does not match campaign name.

CREATE OR REPLACE FUNCTION public.service_get_traffic_sessions_by_gad_campaign_id(
  p_organization_id uuid,
  p_web_id text,
  p_from date,
  p_to date
)
RETURNS TABLE (gad_campaign_id text, sessions_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date;
  v_to date;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  IF p_web_id IS NULL OR btrim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF NOT public.org_can_access_web_id(p_organization_id, p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COALESCE(p_from, MIN((timezone('Asia/Jakarta', s.started_at))::date)),
    COALESCE(p_to, MAX((timezone('Asia/Jakarta', s.started_at))::date))
  INTO v_from, v_to
  FROM public.analytics_sessions s
  WHERE s.web_id = p_web_id;

  IF v_from IS NULL OR v_to IS NULL THEN
    RETURN;
  END IF;

  IF v_to < v_from THEN
    RAISE EXCEPTION 'invalid range';
  END IF;

  RETURN QUERY
  SELECT
    gad_id AS gad_campaign_id,
    COUNT(*)::bigint AS sessions_count
  FROM (
    SELECT DISTINCT
      s.id,
      substring(
        COALESCE(s.last_landing_url, s.first_landing_url, s.landing_url, '')
        FROM 'gad_campaignid=([0-9]+)'
      ) AS gad_id
    FROM public.analytics_sessions s
    WHERE s.web_id = p_web_id
      AND (timezone('Asia/Jakarta', s.started_at))::date BETWEEN v_from AND v_to
      AND COALESCE(s.last_landing_url, s.first_landing_url, s.landing_url, '') ~ 'gad_campaignid=[0-9]+'
      AND (
        s.has_gclid = true
        OR s.has_gbraid = true
        OR s.gclid IS NOT NULL
        OR lower(btrim(COALESCE(s.last_utm_medium, s.first_utm_medium, s.utm_medium, ''))) = 'cpc'
      )
  ) q
  WHERE gad_id IS NOT NULL AND btrim(gad_id) <> ''
  GROUP BY gad_id;
END;
$$;

REVOKE ALL ON FUNCTION public.service_get_traffic_sessions_by_gad_campaign_id(uuid, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_get_traffic_sessions_by_gad_campaign_id(uuid, text, date, date) TO service_role;

COMMENT ON FUNCTION public.service_get_traffic_sessions_by_gad_campaign_id(uuid, text, date, date) IS
  'Count sessions per gad_campaignid parsed from landing URLs (Google Ads auto-tagging fallback for edge enrichment).';
