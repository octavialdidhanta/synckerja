-- get_click_targets_for_source_key / get_click_targets_for_utm_row previously filtered
-- sessions with (s.started_at AT TIME ZONE 'UTC')::date, while refresh_analytics_rollups and
-- get_traffic_dashboard use kalender hari WIB. Akibatnya jumlah klik di dashboard ada,
-- detail klik (RPC) kosong.
-- Sumber: clicks_agg + utm di refresh memakai timezone('Asia/Jakarta', ce.created_at) dan
-- (untuk UTM) sesi yang jatuh pada hari WIB yang sama dengan klik.

-- 1) Detail per source_key: sama persis agregasi clicks di refresh (join ce + s, filter hari WIB klik)
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
      INNER JOIN public.analytics_sessions s
        ON s.id = ce.session_id AND s.web_id = ce.web_id
      WHERE ce.web_id = p_web_id
        AND (timezone('Asia/Jakarta', ce.created_at))::date BETWEEN v_from AND v_to
        AND (
          CASE
            WHEN COALESCE(
              NULLIF(trim(s.utm_source), ''),
              NULLIF(trim(s.utm_medium), ''),
              NULLIF(trim(s.utm_campaign), ''),
              NULLIF(trim(s.utm_content), ''),
              NULLIF(trim(s.utm_term), '')
            ) IS NOT NULL THEN 'utm'
            WHEN COALESCE(s.has_gclid, false)
              OR COALESCE(s.has_fbclid, false)
              OR COALESCE(s.has_msclkid, false)
              OR COALESCE(s.has_gbraid, false)
              OR COALESCE(s.has_wbraid, false) THEN 'paid_click_ids'
            WHEN NULLIF(trim(COALESCE(s.referrer, s.first_referrer, '')), '') IS NOT NULL THEN 'referral'
            ELSE 'direct'
          END
        ) = v_key
      GROUP BY COALESCE(ce.track_key, ''), ce.element_type, ce.element_label, COALESCE(ce.target_url, ''), COALESCE(ce.is_internal, false)
      ORDER BY COUNT(*) DESC
      LIMIT GREATEST(1, LEAST(p_limit, 200))
    ) t
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) TO authenticated;

-- 2) Detail UTM row: hari WIB klik in range, dan sama dengan hari WIB start sesi (konsisten analytics_daily_utm)
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
          COALESCE(
            trim(both '/' FROM regexp_replace(
              regexp_replace(
                COALESCE(NULLIF(trim(s.landing_url), ''), NULLIF(trim(s.first_landing_url), ''), ''),
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
            NULLIF(trim(s.landing_url), '') IS NOT NULL
            OR NULLIF(trim(s.first_landing_url), '') IS NOT NULL
          ) AS had_landing_ref
      ) lp
      WHERE ce.web_id = p_web_id
        AND (timezone('Asia/Jakarta', ce.created_at))::date BETWEEN v_from AND v_to
        AND (timezone('Asia/Jakarta', s.started_at))::date = (timezone('Asia/Jakarta', ce.created_at))::date
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
        AND COALESCE(NULLIF(trim(s.utm_campaign), ''), '') = v_campaign
        AND COALESCE(NULLIF(trim(s.utm_source), ''), '') = v_source
        AND COALESCE(NULLIF(trim(s.utm_medium), ''), '') = v_medium
        AND COALESCE(NULLIF(trim(s.utm_content), ''), '') = v_content
        AND COALESCE(NULLIF(trim(s.utm_term), ''), '') = v_term
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

COMMENT ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) IS
  'Click target breakdown for acquisition source; uses WIB calendar day on click (same as refresh_clicks source_breakdown).';
COMMENT ON FUNCTION public.get_click_targets_for_utm_row(
  text, date, date, text, text, text, text, text, text, int
) IS
  'Click targets for UTM bucket; WIB day on click, session/click same WIB day (same as analytics_daily_utm).';
