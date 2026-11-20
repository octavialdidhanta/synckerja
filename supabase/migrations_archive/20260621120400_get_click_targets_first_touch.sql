-- Click drill-down RPCs aligned with first-touch session attribution.

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
  v_min date;
  v_max date;
  v_route text;
  v_campaign text;
  v_source text;
  v_medium text;
  v_content text;
  v_term text;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF NOT public.can_access_web_id(p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT MIN(day), MAX(day)
  INTO v_min, v_max
  FROM public.analytics_daily_sessions
  WHERE web_id = p_web_id;

  IF v_min IS NULL OR v_max IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_from := COALESCE(p_from, v_min);
  v_to := COALESCE(p_to, v_max);

  IF v_to < v_from THEN
    RAISE EXCEPTION 'invalid range';
  END IF;

  v_route := COALESCE(p_route, '');
  v_campaign := COALESCE(p_utm_campaign, '');
  v_source := COALESCE(p_utm_source, '');
  v_medium := COALESCE(p_utm_medium, '');
  v_content := COALESCE(p_utm_content, '');
  v_term := COALESCE(p_utm_term, '');

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
          public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url) AS landing_url,
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
          ) AS utm_term_eff
      ) eff
      CROSS JOIN LATERAL (
        SELECT
          coalesce(
            trim(both '/' FROM regexp_replace(
              regexp_replace(
                coalesce(
                  nullif(btrim(s.first_landing_url), ''),
                  nullif(btrim(s.landing_url), ''),
                  nullif(btrim(s.last_landing_url), ''),
                  ''
                ),
                '^https?://[^/]+',
                '',
                'i'
              ),
              '[?#].*$',
              ''
            )),
            ''
          ) AS route_path,
          (
            nullif(btrim(s.first_landing_url), '') IS NOT NULL
            OR nullif(btrim(s.landing_url), '') IS NOT NULL
            OR nullif(btrim(s.last_landing_url), '') IS NOT NULL
          ) AS had_landing_ref
      ) lp
      WHERE ce.web_id = p_web_id
        AND (timezone('Asia/Jakarta', ce.created_at))::date BETWEEN v_from AND v_to
        AND (
          COALESCE(
            left(
              CASE
                WHEN lp.route_path = '' AND lp.had_landing_ref THEN '/'
                WHEN lp.route_path = '' THEN ''
                WHEN left(lp.route_path, 1) = '/' THEN lp.route_path
                ELSE '/' || lp.route_path
              END,
              512
            ),
            ''
          )
        ) = v_route
        AND COALESCE(nullif(btrim(eff.utm_campaign_eff), ''), '') = v_campaign
        AND COALESCE(nullif(btrim(eff.utm_source_eff), ''), '') = v_source
        AND COALESCE(nullif(btrim(eff.utm_medium_eff), ''), '') = v_medium
        AND COALESCE(nullif(btrim(eff.utm_content_eff), ''), '') = v_content
        AND COALESCE(nullif(btrim(eff.utm_term_eff), ''), '') = v_term
      GROUP BY COALESCE(ce.track_key, ''), ce.element_type, ce.element_label, COALESCE(ce.target_url, ''), COALESCE(ce.is_internal, false)
      ORDER BY COUNT(*) DESC
      LIMIT GREATEST(1, LEAST(p_limit, 200))
    ) t
  );
END;
$$;

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
  v_min date;
  v_max date;
  v_key text;
BEGIN
  IF p_web_id IS NULL OR trim(p_web_id) = '' THEN
    RAISE EXCEPTION 'web_id is required';
  END IF;

  IF NOT public.can_access_web_id(p_web_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT MIN(day), MAX(day)
  INTO v_min, v_max
  FROM public.analytics_daily_sessions
  WHERE web_id = p_web_id;

  IF v_min IS NULL OR v_max IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_from := COALESCE(p_from, v_min);
  v_to := COALESCE(p_to, v_max);

  IF v_to < v_from THEN
    RAISE EXCEPTION 'invalid range';
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

REVOKE ALL ON FUNCTION public.get_click_targets_for_utm_row(
  text, date, date, text, text, text, text, text, text, int
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_click_targets_for_utm_row(
  text, date, date, text, text, text, text, text, text, int
) TO authenticated;

REVOKE ALL ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) TO authenticated;

COMMENT ON FUNCTION public.get_click_targets_for_utm_row(
  text, date, date, text, text, text, text, text, text, int
) IS
  'Click targets for UTM table row; first-touch session attribution aligned with dashboard UTM table.';

COMMENT ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) IS
  'Click targets per source_key; first-touch session classification aligned with dashboard source breakdown.';
