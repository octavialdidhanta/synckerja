-- UTM Tracking detail: when a table row represents a session, click details must be scoped to that session row.

DROP FUNCTION IF EXISTS public.get_click_targets_for_utm_row(
  text, date, date, text, text, text, text, text, text, int
);

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
  v_session_id text;
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
  v_session_id := COALESCE(NULLIF(btrim(p_session_id), ''), '');

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
          coalesce(nullif(btrim(s.last_landing_url), ''), nullif(btrim(s.landing_url), '')) AS landing_url,
          coalesce(nullif(btrim(s.last_utm_source), ''), nullif(btrim(s.utm_source), '')) AS utm_source,
          coalesce(nullif(btrim(s.last_utm_medium), ''), nullif(btrim(s.utm_medium), '')) AS utm_medium,
          coalesce(nullif(btrim(s.last_utm_campaign), ''), nullif(btrim(s.utm_campaign), '')) AS utm_campaign,
          coalesce(nullif(btrim(s.last_utm_content), ''), nullif(btrim(s.utm_content), '')) AS utm_content,
          coalesce(nullif(btrim(s.last_utm_term), ''), nullif(btrim(s.utm_term), '')) AS utm_term
      ) bx
      CROSS JOIN LATERAL (
        SELECT
          coalesce(nullif(btrim(bx.utm_source), ''), nullif(trim((regexp_match(coalesce(bx.landing_url, ''), '(?i)[?&]utm_source=([^&]*)'))[1]), '')) AS utm_source_eff,
          coalesce(nullif(btrim(bx.utm_medium), ''), nullif(trim((regexp_match(coalesce(bx.landing_url, ''), '(?i)[?&]utm_medium=([^&]*)'))[1]), '')) AS utm_medium_eff,
          coalesce(nullif(btrim(bx.utm_campaign), ''), nullif(trim((regexp_match(coalesce(bx.landing_url, ''), '(?i)[?&]utm_campaign=([^&]*)'))[1]), '')) AS utm_campaign_eff,
          coalesce(nullif(btrim(bx.utm_content), ''), nullif(trim((regexp_match(coalesce(bx.landing_url, ''), '(?i)[?&]utm_content=([^&]*)'))[1]), '')) AS utm_content_eff,
          coalesce(nullif(btrim(bx.utm_term), ''), nullif(trim((regexp_match(coalesce(bx.landing_url, ''), '(?i)[?&]utm_term=([^&]*)'))[1]), '')) AS utm_term_eff
      ) eff
      CROSS JOIN LATERAL (
        SELECT
          coalesce(
            trim(both '/' FROM regexp_replace(
              regexp_replace(
                coalesce(
                  nullif(btrim(s.last_landing_url), ''),
                  nullif(btrim(s.landing_url), ''),
                  nullif(btrim(s.first_landing_url), ''),
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
            nullif(btrim(s.last_landing_url), '') IS NOT NULL
            OR nullif(btrim(s.landing_url), '') IS NOT NULL
            OR nullif(btrim(s.first_landing_url), '') IS NOT NULL
          ) AS had_landing_ref
      ) lp
      WHERE ce.web_id = p_web_id
        AND (timezone('Asia/Jakarta', ce.created_at))::date BETWEEN v_from AND v_to
        AND (p_session_day IS NULL OR (timezone('Asia/Jakarta', ce.created_at))::date = p_session_day)
        AND (
          (
            v_session_id <> ''
            AND ce.session_id::text = v_session_id
          )
          OR (
            v_session_id = ''
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
          )
        )
      GROUP BY COALESCE(ce.track_key, ''), ce.element_type, ce.element_label, COALESCE(ce.target_url, ''), COALESCE(ce.is_internal, false)
      ORDER BY COUNT(*) DESC
      LIMIT GREATEST(1, LEAST(p_limit, 200))
    ) t
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_click_targets_for_utm_row(
  text, date, date, text, text, text, text, text, text, text, date, int
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_click_targets_for_utm_row(
  text, date, date, text, text, text, text, text, text, text, date, int
) TO authenticated;

COMMENT ON FUNCTION public.get_click_targets_for_utm_row(
  text, date, date, text, text, text, text, text, text, text, date, int
) IS
  'Click targets for UTM table row; when p_session_id is supplied, results are scoped to that session row.';
