-- Internal traffic RPCs for edge functions (service_role only).
-- Validates org ↔ web_id via analytics_web_access instead of auth.uid().

CREATE OR REPLACE FUNCTION public.org_can_access_web_id(
  p_organization_id uuid,
  p_web_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.analytics_web_access a
    WHERE a.organization_id = p_organization_id
      AND a.web_id = p_web_id
      AND a.is_approved = true
  );
$$;

REVOKE ALL ON FUNCTION public.org_can_access_web_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_can_access_web_id(uuid, text) TO service_role;

COMMENT ON FUNCTION public.org_can_access_web_id(uuid, text) IS
  'Org-scoped web_id access check for internal edge/service_role callers.';

CREATE OR REPLACE FUNCTION public.service_get_traffic_ingestion_status(
  p_organization_id uuid,
  p_web_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_exists boolean;
  daily_exists boolean;
  agg_min date;
  agg_max date;
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

  raw_exists :=
    EXISTS (SELECT 1 FROM public.analytics_sessions s WHERE s.web_id = p_web_id LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id LIMIT 1);

  daily_exists := EXISTS (
    SELECT 1 FROM public.analytics_daily_sessions d WHERE d.web_id = p_web_id LIMIT 1
  );

  SELECT MIN(day), MAX(day)
  INTO agg_min, agg_max
  FROM public.analytics_daily_sessions
  WHERE web_id = p_web_id;

  RETURN jsonb_build_object(
    'raw_events_exist', raw_exists,
    'daily_rollups_exist', daily_exists,
    'aggregate_day_min', agg_min,
    'aggregate_day_max', agg_max,
    'data_status', CASE
      WHEN NOT raw_exists THEN 'no_ingested_data'
      WHEN NOT daily_exists THEN 'rollups_not_built'
      ELSE 'ok'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.service_get_traffic_ingestion_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_get_traffic_ingestion_status(uuid, text) TO service_role;

COMMENT ON FUNCTION public.service_get_traffic_ingestion_status(uuid, text) IS
  'Ingestion status for a web_id scoped to an organization (edge/service_role only).';

CREATE OR REPLACE FUNCTION public.service_get_traffic_sessions_by_utm_campaign(
  p_organization_id uuid,
  p_web_id text,
  p_from date,
  p_to date
)
RETURNS TABLE (utm_campaign_key text, sessions_count bigint)
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
    COALESCE(p_from, MIN(s.day)),
    COALESCE(p_to, MAX(s.day))
  INTO v_from, v_to
  FROM public.analytics_daily_sessions s
  WHERE s.web_id = p_web_id;

  IF v_from IS NULL OR v_to IS NULL THEN
    RETURN;
  END IF;

  IF v_to < v_from THEN
    RAISE EXCEPTION 'invalid range';
  END IF;

  RETURN QUERY
  SELECT
    lower(btrim(u.utm_campaign)) AS utm_campaign_key,
    COALESCE(SUM(u.sessions_count), 0)::bigint AS sessions_count
  FROM public.analytics_daily_utm u
  WHERE u.web_id = p_web_id
    AND u.day BETWEEN v_from AND v_to
    AND btrim(u.utm_campaign) <> ''
  GROUP BY lower(btrim(u.utm_campaign));
END;
$$;

REVOKE ALL ON FUNCTION public.service_get_traffic_sessions_by_utm_campaign(uuid, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_get_traffic_sessions_by_utm_campaign(uuid, text, date, date) TO service_role;

COMMENT ON FUNCTION public.service_get_traffic_sessions_by_utm_campaign(uuid, text, date, date) IS
  'Sum analytics_daily_utm sessions by utm_campaign for org-scoped edge enrichment (service_role only).';
