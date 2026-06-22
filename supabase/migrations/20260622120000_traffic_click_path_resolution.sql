-- Click path resolution: infer page where click occurred from active page_view at click time.
-- Adds path_client audit column and backfills mismatched historical paths.

CREATE OR REPLACE FUNCTION public.traffic_normalize_route_path(p_path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.traffic_path_key(p_path);
$$;

COMMENT ON FUNCTION public.traffic_normalize_route_path(text) IS
  'Alias for traffic_path_key; canonical route path for click/page attribution.';

CREATE OR REPLACE FUNCTION public.traffic_active_page_view_at(
  p_session_id uuid,
  p_at timestamptz
)
RETURNS TABLE (
  page_view_id uuid,
  path text,
  started_at timestamptz
)
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT
    pv.id AS page_view_id,
    pv.path,
    pv.started_at
  FROM public.analytics_page_views pv
  WHERE pv.session_id = p_session_id
    AND pv.started_at <= p_at
  ORDER BY pv.started_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.traffic_active_page_view_at(uuid, timestamptz) IS
  'Page view active at click time: latest page_view with started_at <= p_at in the session.';

ALTER TABLE public.analytics_click_events
  ADD COLUMN IF NOT EXISTS path_client text;

COMMENT ON COLUMN public.analytics_click_events.path_client IS
  'Original path sent by client when server corrected path from active page_view.';

-- Backfill: correct path when it mismatches inferred active page_view path.
UPDATE public.analytics_click_events ce
SET
  path_client = ce.path,
  path = resolved.resolved_path
FROM (
  SELECT
    ce2.id,
    apv.path AS resolved_path
  FROM public.analytics_click_events ce2
  CROSS JOIN LATERAL public.traffic_active_page_view_at(ce2.session_id, ce2.created_at) apv
  WHERE ce2.session_id IS NOT NULL
    AND apv.page_view_id IS NOT NULL
    AND apv.path IS NOT NULL
    AND public.traffic_path_key(ce2.path) IS DISTINCT FROM public.traffic_path_key(apv.path)
    AND ce2.target_url IS NOT NULL
    AND btrim(ce2.target_url) <> ''
    AND public.traffic_path_key(
      coalesce(
        nullif(
          regexp_replace(
            regexp_replace(ce2.target_url, '^https?://[^/]+', '', 'i'),
            '[?#].*$',
            ''
          ),
          ''
        ),
        '/'
      )
    ) = public.traffic_path_key(ce2.path)
) resolved
WHERE ce.id = resolved.id;

-- Refresh rollups for web_ids with corrected clicks (today + yesterday WIB).
DO $$
DECLARE
  r record;
  v_today date;
  v_yesterday date;
BEGIN
  SELECT day_today, day_yesterday
  INTO v_today, v_yesterday
  FROM public.traffic_wib_today_yesterday();

  IF v_today IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT ce.web_id
    FROM public.analytics_click_events ce
    WHERE ce.path_client IS NOT NULL
      AND ce.web_id IS NOT NULL
  LOOP
    PERFORM public.refresh_analytics_daily_rollups(v_yesterday, v_today, r.web_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.traffic_active_page_view_at(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.traffic_active_page_view_at(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.traffic_active_page_view_at(uuid, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.traffic_normalize_route_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.traffic_normalize_route_path(text) TO authenticated;
