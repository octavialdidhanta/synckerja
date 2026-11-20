-- Click drill-down: resolve date bounds from raw events when rollups are empty/stale;
-- path drill-down reads raw analytics_click_events (aligned with dashboard counts).

CREATE OR REPLACE FUNCTION public.traffic_resolve_query_date_bounds(
  p_web_id text,
  p_from date,
  p_to date
)
RETURNS TABLE(resolved_from date, resolved_to date, has_bounds boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agg_min date;
  agg_max date;
  raw_min date;
  raw_max date;
  v_from date;
  v_to date;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    resolved_from := NULL;
    resolved_to := NULL;
    has_bounds := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_from IS NOT NULL AND p_to IS NOT NULL THEN
    IF p_to < p_from THEN
      resolved_from := NULL;
      resolved_to := NULL;
      has_bounds := false;
    ELSE
      resolved_from := p_from;
      resolved_to := p_to;
      has_bounds := true;
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT MIN(day), MAX(day)
  INTO agg_min, agg_max
  FROM public.analytics_daily_sessions
  WHERE web_id = p_web_id;

  SELECT
    LEAST(
      (SELECT MIN((timezone('Asia/Jakarta', s.started_at))::date) FROM public.analytics_sessions s WHERE s.web_id = p_web_id),
      (SELECT MIN((timezone('Asia/Jakarta', pv.started_at))::date) FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id),
      (SELECT MIN((timezone('Asia/Jakarta', ce.created_at))::date) FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id)
    ),
    GREATEST(
      (SELECT MAX((timezone('Asia/Jakarta', s.started_at))::date) FROM public.analytics_sessions s WHERE s.web_id = p_web_id),
      (SELECT MAX((timezone('Asia/Jakarta', pv.started_at))::date) FROM public.analytics_page_views pv WHERE pv.web_id = p_web_id),
      (SELECT MAX((timezone('Asia/Jakarta', ce.created_at))::date) FROM public.analytics_click_events ce WHERE ce.web_id = p_web_id)
    )
  INTO raw_min, raw_max;

  v_from := COALESCE(p_from, agg_min, raw_min);
  v_to := COALESCE(p_to, agg_max, raw_max);

  IF v_from IS NULL OR v_to IS NULL OR v_to < v_from THEN
    resolved_from := NULL;
    resolved_to := NULL;
    has_bounds := false;
  ELSE
    resolved_from := v_from;
    resolved_to := v_to;
    has_bounds := true;
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.traffic_resolve_query_date_bounds(text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.traffic_resolve_query_date_bounds(text, date, date) TO authenticated;

COMMENT ON FUNCTION public.traffic_resolve_query_date_bounds(text, date, date) IS
  'Resolve WIB date bounds for traffic RPCs; aggregate rollup first, then raw event fallback (matches dashboard hook).';

CREATE OR REPLACE FUNCTION public.get_click_targets_for_source_key(
  p_web_id text,
  p_from date,
  p_to date,
  p_source_key text,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date;
  v_to date;
  v_has_bounds boolean;
  v_key text;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF NOT public.can_access_web_id(p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT b.resolved_from, b.resolved_to, b.has_bounds
  INTO v_from, v_to, v_has_bounds
  FROM public.traffic_resolve_query_date_bounds(p_web_id, p_from, p_to) b;

  IF NOT v_has_bounds THEN
    RETURN '[]'::jsonb;
  END IF;

  v_key := COALESCE(NULLIF(trim(p_source_key), ''), '');
  IF v_key NOT IN ('utm', 'paid_click_ids', 'referral', 'direct') THEN
    RAISE EXCEPTION 'invalid source_key';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'clicks', clicks,
      'unique_sessions', unique_sessions,
      'track_key', NULLIF(track_key, ''),
      'element_type', element_type,
      'element_label', element_label,
      'target_url', NULLIF(target_url, ''),
      'is_internal', is_internal
    ) ORDER BY clicks DESC), '[]'::jsonb)
    FROM (
      SELECT
        COUNT(*)::bigint AS clicks,
        COUNT(DISTINCT ce.session_id)::bigint AS unique_sessions,
        COALESCE(ce.track_key, '') AS track_key,
        ce.element_type,
        ce.element_label,
        COALESCE(ce.target_url, '') AS target_url,
        COALESCE(ce.is_internal, false) AS is_internal
      FROM public.analytics_click_events ce
      LEFT JOIN public.analytics_sessions s
        ON s.id = ce.session_id AND s.web_id = ce.web_id
      CROSS JOIN LATERAL (
        SELECT public.traffic_classify_session_source_key(
          s.first_utm_source, s.utm_source, s.last_utm_source,
          s.first_utm_medium, s.utm_medium, s.last_utm_medium,
          s.first_utm_campaign, s.utm_campaign, s.last_utm_campaign,
          s.first_utm_content, s.utm_content, s.last_utm_content,
          s.first_utm_term, s.utm_term, s.last_utm_term,
          s.first_landing_url, s.landing_url, s.last_landing_url,
          s.has_gclid, s.first_has_gclid, s.last_has_gclid,
          s.has_fbclid, s.first_has_fbclid, s.last_has_fbclid,
          s.has_msclkid, s.has_gbraid, s.has_wbraid,
          s.first_referrer, s.referrer, s.last_referrer
        ) AS source_key
      ) sk
      WHERE ce.web_id = p_web_id
        AND (timezone('Asia/Jakarta', ce.created_at))::date BETWEEN v_from AND v_to
        AND sk.source_key = v_key
      GROUP BY COALESCE(ce.track_key, ''), ce.element_type, ce.element_label, COALESCE(ce.target_url, ''), COALESCE(ce.is_internal, false)
      ORDER BY COUNT(*) DESC
      LIMIT GREATEST(1, LEAST(p_limit, 200))
    ) t
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_click_targets_for_utm_row(
  p_web_id text,
  p_from date,
  p_to date,
  p_route text,
  p_utm_campaign text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_content text,
  p_utm_term text,
  p_session_id text DEFAULT NULL,
  p_session_day date DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_visitor_id text DEFAULT NULL,
  p_row_kind text DEFAULT 'session',
  p_page_view_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date;
  v_to date;
  v_has_bounds boolean;
  v_route text;
  v_campaign text;
  v_source text;
  v_medium text;
  v_content text;
  v_term text;
  v_session_id text;
  v_visitor_id text;
  v_row_kind text;
  v_page_view_id uuid;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF NOT public.can_access_web_id(p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT b.resolved_from, b.resolved_to, b.has_bounds
  INTO v_from, v_to, v_has_bounds
  FROM public.traffic_resolve_query_date_bounds(p_web_id, p_from, p_to) b;

  IF NOT v_has_bounds THEN
    RETURN '[]'::jsonb;
  END IF;

  v_route := COALESCE(p_route, '');
  v_campaign := COALESCE(p_utm_campaign, '');
  v_source := COALESCE(p_utm_source, '');
  v_medium := COALESCE(p_utm_medium, '');
  v_content := COALESCE(p_utm_content, '');
  v_term := COALESCE(p_utm_term, '');
  v_session_id := COALESCE(NULLIF(btrim(p_session_id), ''), '');
  v_visitor_id := COALESCE(NULLIF(btrim(p_visitor_id), ''), '');
  v_row_kind := COALESCE(NULLIF(btrim(p_row_kind), ''), 'session');
  IF v_row_kind NOT IN ('session', 'journey') THEN
    v_row_kind := 'session';
  END IF;

  v_page_view_id := NULL;
  IF NULLIF(btrim(p_page_view_id), '') IS NOT NULL THEN
    BEGIN
      v_page_view_id := NULLIF(btrim(p_page_view_id), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_page_view_id := NULL;
    END;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'clicks', clicks,
      'unique_sessions', unique_sessions,
      'track_key', NULLIF(track_key, ''),
      'element_type', element_type,
      'element_label', element_label,
      'target_url', NULLIF(target_url, ''),
      'is_internal', is_internal
    ) ORDER BY clicks DESC), '[]'::jsonb)
    FROM (
      SELECT
        COUNT(*)::bigint AS clicks,
        COUNT(DISTINCT ce.session_id)::bigint AS unique_sessions,
        COALESCE(ce.track_key, '') AS track_key,
        ce.element_type,
        ce.element_label,
        COALESCE(ce.target_url, '') AS target_url,
        COALESCE(ce.is_internal, false) AS is_internal
      FROM public.analytics_click_events ce
      INNER JOIN public.analytics_sessions s
        ON s.id = ce.session_id AND s.web_id = ce.web_id
      CROSS JOIN LATERAL (
        SELECT
          public.traffic_effective_utm_source(
            s.first_utm_source, s.utm_source, s.last_utm_source,
            public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url)
          ) AS utm_source_eff,
          public.traffic_effective_utm_medium(
            s.first_utm_medium, s.utm_medium, s.last_utm_medium,
            public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url)
          ) AS utm_medium_eff,
          public.traffic_effective_utm_campaign(
            s.first_utm_campaign, s.utm_campaign, s.last_utm_campaign,
            public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url)
          ) AS utm_campaign_eff,
          public.traffic_effective_utm_content(
            s.first_utm_content, s.utm_content, s.last_utm_content,
            public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url)
          ) AS utm_content_eff,
          public.traffic_effective_utm_term(
            s.first_utm_term, s.utm_term, s.last_utm_term,
            public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url)
          ) AS utm_term_eff,
          COALESCE(NULLIF(btrim(ce.visitor_id), ''), NULLIF(btrim(s.visitor_id), '')) AS visitor_id
      ) eff
      WHERE ce.web_id = p_web_id
        AND (timezone('Asia/Jakarta', ce.created_at))::date BETWEEN v_from AND v_to
        AND (p_session_day IS NULL OR (timezone('Asia/Jakarta', ce.created_at))::date = p_session_day)
        AND COALESCE(nullif(btrim(eff.utm_campaign_eff), ''), '') = v_campaign
        AND COALESCE(nullif(btrim(eff.utm_source_eff), ''), '') = v_source
        AND COALESCE(nullif(btrim(eff.utm_medium_eff), ''), '') = v_medium
        AND COALESCE(nullif(btrim(eff.utm_content_eff), ''), '') = v_content
        AND COALESCE(nullif(btrim(eff.utm_term_eff), ''), '') = v_term
        AND (
          (v_session_id <> '' AND ce.session_id::text = v_session_id)
          OR (v_session_id = '' AND v_visitor_id <> '' AND eff.visitor_id = v_visitor_id)
          OR (v_session_id = '' AND v_visitor_id = '')
        )
        AND (
          v_row_kind = 'session'
          OR (
            v_row_kind = 'journey'
            AND public.traffic_path_key(ce.path) = public.traffic_path_key(v_route)
          )
        )
        AND (
          v_page_view_id IS NULL
          OR v_row_kind <> 'journey'
          OR EXISTS (
            SELECT 1
            FROM public.analytics_page_views pv
            WHERE pv.id = v_page_view_id
              AND pv.session_id = ce.session_id
              AND public.traffic_path_key(pv.path) = public.traffic_path_key(ce.path)
          )
        )
      GROUP BY COALESCE(ce.track_key, ''), ce.element_type, ce.element_label, COALESCE(ce.target_url, ''), COALESCE(ce.is_internal, false)
      ORDER BY COUNT(*) DESC
      LIMIT GREATEST(1, LEAST(p_limit, 200))
    ) t
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_click_targets_for_path(
  p_web_id text,
  p_from date,
  p_to date,
  p_path text,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date;
  v_to date;
  v_has_bounds boolean;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF p_path IS NULL OR trim(p_path) = '' THEN
    RAISE EXCEPTION 'path is required';
  END IF;

  IF NOT public.can_access_web_id(p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT b.resolved_from, b.resolved_to, b.has_bounds
  INTO v_from, v_to, v_has_bounds
  FROM public.traffic_resolve_query_date_bounds(p_web_id, p_from, p_to) b;

  IF NOT v_has_bounds THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'clicks', clicks,
      'unique_sessions', unique_sessions,
      'track_key', NULLIF(track_key, ''),
      'element_type', element_type,
      'element_label', element_label,
      'target_url', NULLIF(target_url, ''),
      'is_internal', is_internal
    ) ORDER BY clicks DESC), '[]'::jsonb)
    FROM (
      SELECT
        COUNT(*)::bigint AS clicks,
        COUNT(DISTINCT ce.session_id)::bigint AS unique_sessions,
        COALESCE(ce.track_key, '') AS track_key,
        ce.element_type,
        ce.element_label,
        COALESCE(ce.target_url, '') AS target_url,
        COALESCE(ce.is_internal, false) AS is_internal
      FROM public.analytics_click_events ce
      WHERE ce.web_id = p_web_id
        AND (timezone('Asia/Jakarta', ce.created_at))::date BETWEEN v_from AND v_to
        AND public.traffic_path_key(ce.path) = public.traffic_path_key(p_path)
      GROUP BY COALESCE(ce.track_key, ''), ce.element_type, ce.element_label, COALESCE(ce.target_url, ''), COALESCE(ce.is_internal, false)
      ORDER BY COUNT(*) DESC
      LIMIT GREATEST(1, LEAST(p_limit, 200))
    ) t
  );
END;
$$;

COMMENT ON FUNCTION public.get_click_targets_for_path(text, date, date, text, int) IS
  'Click target breakdown for a page path from raw events; paths matched via traffic_path_key.';

COMMENT ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) IS
  'Click targets per source_key; raw events with traffic_resolve_query_date_bounds.';

COMMENT ON FUNCTION public.get_click_targets_for_utm_row(
  text, date, date, text, text, text, text, text, text, text, date, int, text, text, text
) IS
  'Click targets for UTM row; raw events with traffic_resolve_query_date_bounds.';
