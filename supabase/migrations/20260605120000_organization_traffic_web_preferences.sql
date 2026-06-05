-- Default web_id per org for Google Ads ↔ Traffic metric joins.

CREATE TABLE IF NOT EXISTS public.organization_traffic_web_preferences (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  default_web_id text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_traffic_web_preferences_web_id_check CHECK (
    default_web_id IS NULL OR btrim(default_web_id) <> ''
  )
);

COMMENT ON TABLE public.organization_traffic_web_preferences IS
  'Org-level default analytics web_id for Synckerja traffic metrics on Google Ads campaigns.';

ALTER TABLE public.organization_traffic_web_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_traffic_web_preferences_select ON public.organization_traffic_web_preferences;
CREATE POLICY organization_traffic_web_preferences_select
  ON public.organization_traffic_web_preferences
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS organization_traffic_web_preferences_insert ON public.organization_traffic_web_preferences;
CREATE POLICY organization_traffic_web_preferences_insert
  ON public.organization_traffic_web_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND (
      default_web_id IS NULL
      OR public.can_access_web_id(default_web_id)
    )
  );

DROP POLICY IF EXISTS organization_traffic_web_preferences_update ON public.organization_traffic_web_preferences;
CREATE POLICY organization_traffic_web_preferences_update
  ON public.organization_traffic_web_preferences
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND (
      default_web_id IS NULL
      OR public.can_access_web_id(default_web_id)
    )
  );

DROP TRIGGER IF EXISTS update_organization_traffic_web_preferences_updated_at
  ON public.organization_traffic_web_preferences;
CREATE TRIGGER update_organization_traffic_web_preferences_updated_at
  BEFORE UPDATE ON public.organization_traffic_web_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Aggregate unique sessions per normalized utm_campaign from daily rollups.
CREATE OR REPLACE FUNCTION public.get_traffic_sessions_by_utm_campaign(
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
  IF p_web_id IS NULL OR btrim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF NOT public.can_access_web_id(p_web_id) THEN
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

REVOKE ALL ON FUNCTION public.get_traffic_sessions_by_utm_campaign(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_traffic_sessions_by_utm_campaign(text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_traffic_sessions_by_utm_campaign(text, date, date) TO service_role;

COMMENT ON FUNCTION public.get_traffic_sessions_by_utm_campaign(text, date, date) IS
  'Sum analytics_daily_utm.sessions_count grouped by normalized utm_campaign for a web_id and date range.';
