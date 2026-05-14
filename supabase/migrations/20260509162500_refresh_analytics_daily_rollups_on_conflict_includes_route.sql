-- PK `analytics_daily_utm` memakai kolom `route` (lihat migrasi route_pkey).
-- INSERT ... ON CONFLICT (web_id, day, utm_*) tanpa `route` gagal: tidak ada unique constraint yang cocok.
-- Rollup harian ini mengagregasi per bucket UTM tanpa path → pakai route = ''.

CREATE OR REPLACE FUNCTION public.refresh_analytics_daily_rollups(
  p_from date,
  p_to date DEFAULT NULL,
  p_web_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_to date;
BEGIN
  v_to := coalesce(p_to, p_from);
  IF p_from > v_to THEN
    RAISE EXCEPTION 'invalid date range' USING errcode = '22023';
  END IF;

  IF p_web_id IS NOT NULL
    AND (btrim(p_web_id) = '' OR p_web_id NOT IN ('vialdi', 'vialdi-wedding', 'synckerja')) THEN
    RAISE EXCEPTION 'invalid web_id' USING errcode = '22023';
  END IF;

  DELETE FROM public.analytics_daily_source_breakdown d
  WHERE d.day BETWEEN p_from AND v_to
    AND (p_web_id IS NULL OR d.web_id = p_web_id);

  DELETE FROM public.analytics_daily_utm u
  WHERE u.day BETWEEN p_from AND v_to
    AND (p_web_id IS NULL OR u.web_id = p_web_id);

  INSERT INTO public.analytics_daily_source_breakdown (web_id, day, source_key, sessions_count)
  WITH human_sessions AS (
    SELECT DISTINCT
      pv.web_id,
      pv.session_id,
      (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date AS day
    FROM public.analytics_page_views pv
    WHERE
      (p_web_id IS NULL OR pv.web_id = p_web_id)
      AND (
        coalesce(pv.active_ms, 0) > 0
        OR coalesce(pv.scroll_max_pct, 0) >= 5
        OR (
          pv.ended_at IS NOT NULL
          AND extract(epoch FROM (pv.ended_at - pv.started_at)) >= 5
        )
      )
  ),
  base AS (
    SELECT
      hs.web_id,
      hs.day,
      hs.session_id,
      coalesce(nullif(btrim(s.last_referrer), ''), nullif(btrim(s.referrer), '')) AS referrer,
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
      (
        nullif(
          trim((
            regexp_match(
              coalesce(
                nullif(btrim(s.last_landing_url), ''),
                nullif(btrim(s.landing_url), ''),
                ''
              ),
              '(?i)[?&]utm_source=([^&]*)'
            )
          )[1]),
          ''
        ) IS NOT NULL
        OR nullif(
          trim((
            regexp_match(
              coalesce(
                nullif(btrim(s.last_landing_url), ''),
                nullif(btrim(s.landing_url), ''),
                ''
              ),
              '(?i)[?&]utm_medium=([^&]*)'
            )
          )[1]),
          ''
        ) IS NOT NULL
        OR nullif(
          trim((
            regexp_match(
              coalesce(
                nullif(btrim(s.last_landing_url), ''),
                nullif(btrim(s.landing_url), ''),
                ''
              ),
              '(?i)[?&]utm_campaign=([^&]*)'
            )
          )[1]),
          ''
        ) IS NOT NULL
        OR nullif(
          trim((
            regexp_match(
              coalesce(
                nullif(btrim(s.last_landing_url), ''),
                nullif(btrim(s.landing_url), ''),
                ''
              ),
              '(?i)[?&]utm_content=([^&]*)'
            )
          )[1]),
          ''
        ) IS NOT NULL
        OR nullif(
          trim((
            regexp_match(
              coalesce(
                nullif(btrim(s.last_landing_url), ''),
                nullif(btrim(s.landing_url), ''),
                ''
              ),
              '(?i)[?&]utm_term=([^&]*)'
            )
          )[1]),
          ''
        ) IS NOT NULL
      ) AS landing_utm_any_parsed
    FROM human_sessions hs
    INNER JOIN public.analytics_sessions s
      ON s.id = hs.session_id
      AND s.web_id = hs.web_id
  ),
  classified AS (
    SELECT
      web_id,
      day,
      session_id,
      CASE
        WHEN has_gclid OR has_fbclid OR has_msclkid OR has_gbraid OR has_wbraid THEN 'paid_click_ids'
        WHEN
          nullif(btrim(utm_source), '') IS NOT NULL
          OR nullif(btrim(utm_medium), '') IS NOT NULL
          OR nullif(btrim(utm_campaign), '') IS NOT NULL
          OR nullif(btrim(utm_content), '') IS NOT NULL
          OR nullif(btrim(utm_term), '') IS NOT NULL
          OR landing_utm_any_parsed
          THEN 'utm'
        WHEN nullif(btrim(referrer), '') IS NOT NULL THEN 'referral'
        ELSE 'direct'
      END AS source_key
    FROM base
  )
  SELECT
    web_id,
    day,
    source_key,
    count(*)::bigint AS sessions_count
  FROM classified
  WHERE day BETWEEN p_from AND v_to
  GROUP BY web_id, day, source_key;

  INSERT INTO public.analytics_daily_utm (
    web_id,
    day,
    route,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    sessions_count
  )
  WITH human_sessions AS (
    SELECT DISTINCT
      pv.web_id,
      pv.session_id,
      (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date AS day
    FROM public.analytics_page_views pv
    WHERE
      (p_web_id IS NULL OR pv.web_id = p_web_id)
      AND (
        coalesce(pv.active_ms, 0) > 0
        OR coalesce(pv.scroll_max_pct, 0) >= 5
        OR (
          pv.ended_at IS NOT NULL
          AND extract(epoch FROM (pv.ended_at - pv.started_at)) >= 5
        )
      )
  ),
  base AS (
    SELECT
      hs.web_id,
      hs.day,
      hs.session_id,
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
    FROM human_sessions hs
    INNER JOIN public.analytics_sessions s
      ON s.id = hs.session_id
      AND s.web_id = hs.web_id
  ),
  effective AS (
    SELECT
      web_id,
      day,
      session_id,
      coalesce(
        nullif(btrim(utm_source), ''),
        nullif(
          trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_source=([^&]*)'))[1]),
          ''
        )
      ) AS utm_source_eff,
      coalesce(
        nullif(btrim(utm_medium), ''),
        nullif(
          trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_medium=([^&]*)'))[1]),
          ''
        )
      ) AS utm_medium_eff,
      coalesce(
        nullif(btrim(utm_campaign), ''),
        nullif(
          trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_campaign=([^&]*)'))[1]),
          ''
        )
      ) AS utm_campaign_eff,
      coalesce(
        nullif(btrim(utm_content), ''),
        nullif(
          trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_content=([^&]*)'))[1]),
          ''
        )
      ) AS utm_content_eff,
      coalesce(
        nullif(btrim(utm_term), ''),
        nullif(
          trim((regexp_match(coalesce(landing_url, ''), '(?i)[?&]utm_term=([^&]*)'))[1]),
          ''
        )
      ) AS utm_term_eff,
      has_gclid,
      has_fbclid,
      has_msclkid,
      has_gbraid,
      has_wbraid,
      referrer
    FROM base
  ),
  classified AS (
    SELECT
      *,
      CASE
        WHEN has_gclid OR has_fbclid OR has_msclkid OR has_gbraid OR has_wbraid THEN 'paid_click_ids'
        WHEN
          nullif(btrim(utm_source_eff), '') IS NOT NULL
          OR nullif(btrim(utm_medium_eff), '') IS NOT NULL
          OR nullif(btrim(utm_campaign_eff), '') IS NOT NULL
          OR nullif(btrim(utm_content_eff), '') IS NOT NULL
          OR nullif(btrim(utm_term_eff), '') IS NOT NULL
          THEN 'utm'
        WHEN nullif(btrim(referrer), '') IS NOT NULL THEN 'referral'
        ELSE 'direct'
      END AS source_key
    FROM effective
  ),
  utm_rows AS (
    SELECT
      web_id,
      day,
      ''::text AS route,
      coalesce(utm_source_eff, '') AS utm_source,
      coalesce(utm_medium_eff, '') AS utm_medium,
      coalesce(utm_campaign_eff, '') AS utm_campaign,
      coalesce(utm_content_eff, '') AS utm_content,
      coalesce(utm_term_eff, '') AS utm_term
    FROM classified
    WHERE
      day BETWEEN p_from AND v_to
      AND source_key IN ('utm', 'paid_click_ids')
      AND (
        nullif(btrim(utm_source_eff), '') IS NOT NULL
        OR nullif(btrim(utm_medium_eff), '') IS NOT NULL
        OR nullif(btrim(utm_campaign_eff), '') IS NOT NULL
        OR nullif(btrim(utm_content_eff), '') IS NOT NULL
        OR nullif(btrim(utm_term_eff), '') IS NOT NULL
      )
  )
  SELECT
    web_id,
    day,
    route,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    count(*)::bigint AS sessions_count
  FROM utm_rows
  GROUP BY web_id, day, route, utm_source, utm_medium, utm_campaign, utm_content, utm_term
  ON CONFLICT (web_id, day, route, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
  DO UPDATE SET sessions_count = excluded.sessions_count;
END;
$body$;

REVOKE ALL ON FUNCTION public.refresh_analytics_daily_rollups(date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_daily_rollups(date, date, text) TO service_role;

COMMENT ON FUNCTION public.refresh_analytics_daily_rollups(date, date, text) IS
  'Rebuild analytics_daily_*; prefers last-touch UTM/landing when first-touch columns are empty or stripped. ON CONFLICT includes route (PK).';
