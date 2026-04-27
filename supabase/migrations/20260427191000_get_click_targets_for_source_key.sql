-- RPC: get click targets breakdown for a coarse acquisition source_key (utm / paid_click_ids / referral / direct).
-- Must match the same source classification used in `get_traffic_dashboard` source_breakdown rollup.

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
      WITH bucket_sessions AS (
        SELECT s.id AS session_id
        FROM public.analytics_sessions s
        WHERE s.web_id = p_web_id
          AND (s.started_at AT TIME ZONE 'UTC')::date BETWEEN v_from AND v_to
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
      )
      SELECT
        COUNT(*)::bigint AS clicks,
        COUNT(DISTINCT ce.session_id)::bigint AS unique_sessions,
        COALESCE(ce.track_key, '') AS track_key,
        ce.element_type,
        ce.element_label,
        COALESCE(ce.target_url, '') AS target_url,
        COALESCE(ce.is_internal, false) AS is_internal
      FROM public.analytics_click_events ce
      INNER JOIN bucket_sessions bs ON bs.session_id = ce.session_id
      WHERE ce.web_id = p_web_id
      GROUP BY COALESCE(ce.track_key, ''), ce.element_type, ce.element_label, COALESCE(ce.target_url, ''), COALESCE(ce.is_internal, false)
      ORDER BY COUNT(*) DESC
      LIMIT GREATEST(1, LEAST(p_limit, 200))
    ) s
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) TO authenticated;

