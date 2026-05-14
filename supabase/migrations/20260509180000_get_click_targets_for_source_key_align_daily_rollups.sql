-- Selaraskan get_click_targets_for_source_key dengan refresh_analytics_daily_rollups (click_classified):
-- paid_click_ids sebelum utm; last_touch + landing URL untuk UTM; last_has_* untuk id iklan.

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
        SELECT
          coalesce(nullif(btrim(s.last_landing_url), ''), nullif(btrim(s.landing_url), '')) AS landing_url,
          coalesce(nullif(btrim(s.last_utm_source), ''), nullif(btrim(s.utm_source), '')) AS utm_source,
          coalesce(nullif(btrim(s.last_utm_medium), ''), nullif(btrim(s.utm_medium), '')) AS utm_medium,
          coalesce(nullif(btrim(s.last_utm_campaign), ''), nullif(btrim(s.utm_campaign), '')) AS utm_campaign,
          coalesce(nullif(btrim(s.last_utm_content), ''), nullif(btrim(s.utm_content), '')) AS utm_content,
          coalesce(nullif(btrim(s.last_utm_term), ''), nullif(btrim(s.utm_term), '')) AS utm_term,
          (coalesce(s.has_gclid, false) OR coalesce(s.last_has_gclid, false)) AS has_gclid,
          (coalesce(s.has_fbclid, false) OR coalesce(s.last_has_fbclid, false)) AS has_fbclid,
          (coalesce(s.has_msclkid, false) OR coalesce(s.last_has_msclkid, false)) AS has_msclkid,
          (coalesce(s.has_gbraid, false) OR coalesce(s.last_has_gbraid, false)) AS has_gbraid,
          (coalesce(s.has_wbraid, false) OR coalesce(s.last_has_wbraid, false)) AS has_wbraid,
          coalesce(nullif(btrim(s.last_referrer), ''), nullif(btrim(s.referrer), '')) AS referrer
      ) bx
      CROSS JOIN LATERAL (
        SELECT
          coalesce(
            nullif(btrim(bx.utm_source), ''),
            nullif(
              trim((regexp_match(coalesce(bx.landing_url, ''), '(?i)[?&]utm_source=([^&]*)'))[1]),
              ''
            )
          ) AS utm_source_eff,
          coalesce(
            nullif(btrim(bx.utm_medium), ''),
            nullif(
              trim((regexp_match(coalesce(bx.landing_url, ''), '(?i)[?&]utm_medium=([^&]*)'))[1]),
              ''
            )
          ) AS utm_medium_eff,
          coalesce(
            nullif(btrim(bx.utm_campaign), ''),
            nullif(
              trim((regexp_match(coalesce(bx.landing_url, ''), '(?i)[?&]utm_campaign=([^&]*)'))[1]),
              ''
            )
          ) AS utm_campaign_eff,
          coalesce(
            nullif(btrim(bx.utm_content), ''),
            nullif(
              trim((regexp_match(coalesce(bx.landing_url, ''), '(?i)[?&]utm_content=([^&]*)'))[1]),
              ''
            )
          ) AS utm_content_eff,
          coalesce(
            nullif(btrim(bx.utm_term), ''),
            nullif(
              trim((regexp_match(coalesce(bx.landing_url, ''), '(?i)[?&]utm_term=([^&]*)'))[1]),
              ''
            )
          ) AS utm_term_eff,
          bx.has_gclid,
          bx.has_fbclid,
          bx.has_msclkid,
          bx.has_gbraid,
          bx.has_wbraid,
          bx.referrer
      ) eff
      CROSS JOIN LATERAL (
        SELECT
          CASE
            WHEN eff.has_gclid OR eff.has_fbclid OR eff.has_msclkid OR eff.has_gbraid OR eff.has_wbraid THEN 'paid_click_ids'
            WHEN
              nullif(btrim(eff.utm_source_eff), '') IS NOT NULL
              OR nullif(btrim(eff.utm_medium_eff), '') IS NOT NULL
              OR nullif(btrim(eff.utm_campaign_eff), '') IS NOT NULL
              OR nullif(btrim(eff.utm_content_eff), '') IS NOT NULL
              OR nullif(btrim(eff.utm_term_eff), '') IS NOT NULL
              THEN 'utm'
            WHEN nullif(btrim(eff.referrer), '') IS NOT NULL THEN 'referral'
            ELSE 'direct'
          END AS source_key
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

REVOKE ALL ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) TO authenticated;

COMMENT ON FUNCTION public.get_click_targets_for_source_key(text, date, date, text, int) IS
  'Click targets per source_key; classification matches refresh_analytics_daily_rollups (last-touch, paid before UTM, URL UTM).';
