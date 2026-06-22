-- First-touch session attribution for daily rollups (SPA-safe).

-- analytics_daily_utm.route: path dari landing URL (last_landing_url → landing_url → first_landing_url),
-- normalisasi sama rollup UTM lama + root `/?` → `/`. (Bukan lagi string kosong untuk semua baris.)

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

  INSERT INTO public.analytics_daily_source_breakdown (
    web_id,
    day,
    source_key,
    sessions_count,
    page_views_count,
    clicks_count,
    scroll_sessions_count,
    scroll_max_pct_max,
    scroll_max_pct_sum
  )
  WITH human_sessions AS (
    SELECT DISTINCT
      pv.web_id,
      pv.session_id,
      (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date AS day
    FROM public.analytics_page_views pv
    WHERE
      (p_web_id IS NULL OR pv.web_id = p_web_id)
      AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND v_to
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
      public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url) AS landing_url,
      public.traffic_first_utm_dim(s.first_utm_source, s.utm_source, s.last_utm_source) AS utm_source,
      public.traffic_first_utm_dim(s.first_utm_medium, s.utm_medium, s.last_utm_medium) AS utm_medium,
      public.traffic_first_utm_dim(s.first_utm_campaign, s.utm_campaign, s.last_utm_campaign) AS utm_campaign,
      public.traffic_first_utm_dim(s.first_utm_content, s.utm_content, s.last_utm_content) AS utm_content,
      public.traffic_first_utm_dim(s.first_utm_term, s.utm_term, s.last_utm_term) AS utm_term,
      (coalesce(s.has_gclid, false) OR coalesce(s.first_has_gclid, false) OR coalesce(s.last_has_gclid, false)) AS has_gclid,
      (coalesce(s.has_fbclid, false) OR coalesce(s.first_has_fbclid, false) OR coalesce(s.last_has_fbclid, false)) AS has_fbclid,
      (coalesce(s.has_msclkid, false) OR coalesce(s.last_has_msclkid, false)) AS has_msclkid,
      (coalesce(s.has_gbraid, false) OR coalesce(s.last_has_gbraid, false)) AS has_gbraid,
      (coalesce(s.has_wbraid, false) OR coalesce(s.last_has_wbraid, false)) AS has_wbraid,
      public.traffic_first_referrer(s.first_referrer, s.referrer, s.last_referrer) AS referrer
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
      web_id,
      day,
      session_id,
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
  click_session_days AS (
    SELECT DISTINCT
      ce.web_id,
      ce.session_id,
      (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day
    FROM public.analytics_click_events ce
    WHERE
      (p_web_id IS NULL OR ce.web_id = p_web_id)
      AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND v_to
      AND ce.session_id IS NOT NULL
  ),
  click_base AS (
    SELECT
      csd.web_id,
      csd.day,
      csd.session_id,
      public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url) AS landing_url,
      public.traffic_first_utm_dim(s.first_utm_source, s.utm_source, s.last_utm_source) AS utm_source,
      public.traffic_first_utm_dim(s.first_utm_medium, s.utm_medium, s.last_utm_medium) AS utm_medium,
      public.traffic_first_utm_dim(s.first_utm_campaign, s.utm_campaign, s.last_utm_campaign) AS utm_campaign,
      public.traffic_first_utm_dim(s.first_utm_content, s.utm_content, s.last_utm_content) AS utm_content,
      public.traffic_first_utm_dim(s.first_utm_term, s.utm_term, s.last_utm_term) AS utm_term,
      (coalesce(s.has_gclid, false) OR coalesce(s.first_has_gclid, false) OR coalesce(s.last_has_gclid, false)) AS has_gclid,
      (coalesce(s.has_fbclid, false) OR coalesce(s.first_has_fbclid, false) OR coalesce(s.last_has_fbclid, false)) AS has_fbclid,
      (coalesce(s.has_msclkid, false) OR coalesce(s.last_has_msclkid, false)) AS has_msclkid,
      (coalesce(s.has_gbraid, false) OR coalesce(s.last_has_gbraid, false)) AS has_gbraid,
      (coalesce(s.has_wbraid, false) OR coalesce(s.last_has_wbraid, false)) AS has_wbraid,
      public.traffic_first_referrer(s.first_referrer, s.referrer, s.last_referrer) AS referrer
    FROM click_session_days csd
    LEFT JOIN public.analytics_sessions s
      ON s.id = csd.session_id
      AND s.web_id = csd.web_id
  ),
  click_effective AS (
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
    FROM click_base
  ),
  click_classified AS (
    SELECT
      web_id,
      day,
      session_id,
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
    FROM click_effective
  ),
  src_keys AS (
    SELECT * FROM (VALUES ('utm'::text), ('paid_click_ids'::text), ('referral'::text), ('direct'::text)) v(source_key)
  ),
  sess_agg AS (
    SELECT
      web_id,
      day,
      source_key,
      count(*)::bigint AS sessions_count
    FROM classified
    GROUP BY web_id, day, source_key
  ),
  pv_agg AS (
    SELECT
      c.web_id,
      c.day,
      c.source_key,
      count(*)::bigint AS page_views_count
    FROM classified c
    INNER JOIN public.analytics_page_views pv
      ON pv.web_id = c.web_id
      AND pv.session_id = c.session_id
      AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date = c.day
    GROUP BY c.web_id, c.day, c.source_key
  ),
  ce_agg AS (
    SELECT
      web_id,
      day,
      source_key,
      sum(cnt)::bigint AS clicks_count
    FROM (
      SELECT
        cc.web_id,
        cc.day,
        cc.source_key,
        count(*)::bigint AS cnt
      FROM public.analytics_click_events ce
      INNER JOIN click_classified cc
        ON cc.web_id = ce.web_id
        AND cc.session_id = ce.session_id
        AND cc.day = (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date
      WHERE
        (p_web_id IS NULL OR ce.web_id = p_web_id)
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND v_to
        AND ce.session_id IS NOT NULL
      GROUP BY cc.web_id, cc.day, cc.source_key
      UNION ALL
      SELECT
        ce.web_id,
        (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
        'direct'::text AS source_key,
        count(*)::bigint AS cnt
      FROM public.analytics_click_events ce
      WHERE
        (p_web_id IS NULL OR ce.web_id = p_web_id)
        AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND v_to
        AND ce.session_id IS NULL
      GROUP BY ce.web_id, (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date
    ) u
    GROUP BY web_id, day, source_key
  ),
  scroll_sess AS (
    SELECT
      c.web_id,
      c.day,
      c.source_key,
      c.session_id,
      max(pv.scroll_max_pct)::double precision AS session_max_scroll_pct
    FROM classified c
    INNER JOIN public.analytics_page_views pv
      ON pv.web_id = c.web_id
      AND pv.session_id = c.session_id
      AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date = c.day
      AND pv.scroll_max_pct IS NOT NULL
    GROUP BY c.web_id, c.day, c.source_key, c.session_id
  ),
  scroll_agg AS (
    SELECT
      web_id,
      day,
      source_key,
      count(*)::bigint AS scroll_sessions_count,
      max(session_max_scroll_pct)::double precision AS scroll_max_pct_max,
      coalesce(sum(session_max_scroll_pct), 0)::double precision AS scroll_max_pct_sum
    FROM scroll_sess
    GROUP BY web_id, day, source_key
  ),
  web_days AS (
    SELECT DISTINCT web_id, day FROM classified
    UNION
    SELECT DISTINCT web_id, day FROM ce_agg
  )
  SELECT
    w.web_id,
    w.day,
    k.source_key,
    coalesce(sa.sessions_count, 0)::bigint,
    coalesce(pva.page_views_count, 0)::bigint,
    coalesce(ca.clicks_count, 0)::bigint,
    coalesce(sca.scroll_sessions_count, 0)::bigint,
    sca.scroll_max_pct_max,
    coalesce(sca.scroll_max_pct_sum, 0)::double precision
  FROM web_days w
  CROSS JOIN src_keys k
  LEFT JOIN sess_agg sa
    ON sa.web_id = w.web_id AND sa.day = w.day AND sa.source_key = k.source_key
  LEFT JOIN pv_agg pva
    ON pva.web_id = w.web_id AND pva.day = w.day AND pva.source_key = k.source_key
  LEFT JOIN ce_agg ca
    ON ca.web_id = w.web_id AND ca.day = w.day AND ca.source_key = k.source_key
  LEFT JOIN scroll_agg sca
    ON sca.web_id = w.web_id AND sca.day = w.day AND sca.source_key = k.source_key
  WHERE
    coalesce(sa.sessions_count, 0) > 0
    OR coalesce(pva.page_views_count, 0) > 0
    OR coalesce(ca.clicks_count, 0) > 0
    OR coalesce(sca.scroll_sessions_count, 0) > 0
  ON CONFLICT (web_id, day, source_key) DO UPDATE SET
    sessions_count = excluded.sessions_count,
    page_views_count = excluded.page_views_count,
    clicks_count = excluded.clicks_count,
    scroll_sessions_count = excluded.scroll_sessions_count,
    scroll_max_pct_max = excluded.scroll_max_pct_max,
    scroll_max_pct_sum = excluded.scroll_max_pct_sum,
    updated_at = now();

  INSERT INTO public.analytics_daily_utm (
    web_id,
    day,
    route,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    sessions_count,
    page_views_count,
    clicks_count,
    scroll_sessions_count,
    scroll_max_pct_max,
    scroll_max_pct_sum
  )
  WITH human_sessions AS (
    SELECT DISTINCT
      pv.web_id,
      pv.session_id,
      (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date AS day
    FROM public.analytics_page_views pv
    WHERE
      (p_web_id IS NULL OR pv.web_id = p_web_id)
      AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND v_to
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
      public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url) AS landing_url,
      public.traffic_first_utm_dim(s.first_utm_source, s.utm_source, s.last_utm_source) AS utm_source,
      public.traffic_first_utm_dim(s.first_utm_medium, s.utm_medium, s.last_utm_medium) AS utm_medium,
      public.traffic_first_utm_dim(s.first_utm_campaign, s.utm_campaign, s.last_utm_campaign) AS utm_campaign,
      public.traffic_first_utm_dim(s.first_utm_content, s.utm_content, s.last_utm_content) AS utm_content,
      public.traffic_first_utm_dim(s.first_utm_term, s.utm_term, s.last_utm_term) AS utm_term,
      (coalesce(s.has_gclid, false) OR coalesce(s.first_has_gclid, false) OR coalesce(s.last_has_gclid, false)) AS has_gclid,
      (coalesce(s.has_fbclid, false) OR coalesce(s.first_has_fbclid, false) OR coalesce(s.last_has_fbclid, false)) AS has_fbclid,
      (coalesce(s.has_msclkid, false) OR coalesce(s.last_has_msclkid, false)) AS has_msclkid,
      (coalesce(s.has_gbraid, false) OR coalesce(s.last_has_gbraid, false)) AS has_gbraid,
      (coalesce(s.has_wbraid, false) OR coalesce(s.last_has_wbraid, false)) AS has_wbraid,
      public.traffic_first_referrer(s.first_referrer, s.referrer, s.last_referrer) AS referrer
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
  pv_day AS (
    SELECT
      pv.web_id,
      pv.session_id,
      (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
      count(*)::bigint AS pv_n
    FROM public.analytics_page_views pv
    WHERE
      (p_web_id IS NULL OR pv.web_id = p_web_id)
      AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND v_to
    GROUP BY pv.web_id, pv.session_id, (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date
  ),
  ce_day AS (
    SELECT
      ce.web_id,
      ce.session_id,
      (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
      count(*)::bigint AS ce_n
    FROM public.analytics_click_events ce
    WHERE
      (p_web_id IS NULL OR ce.web_id = p_web_id)
      AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND v_to
    GROUP BY ce.web_id, ce.session_id, (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date
  ),
  scroll_day AS (
    SELECT
      pv.web_id,
      pv.session_id,
      (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
      max(pv.scroll_max_pct)::double precision AS smax
    FROM public.analytics_page_views pv
    WHERE
      (p_web_id IS NULL OR pv.web_id = p_web_id)
      AND (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND v_to
      AND pv.scroll_max_pct IS NOT NULL
    GROUP BY pv.web_id, pv.session_id, (pv.started_at AT TIME ZONE 'Asia/Jakarta')::date
  ),
  click_session_days AS (
    SELECT DISTINCT
      ce.web_id,
      ce.session_id,
      (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day
    FROM public.analytics_click_events ce
    WHERE
      (p_web_id IS NULL OR ce.web_id = p_web_id)
      AND (ce.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND v_to
      AND ce.session_id IS NOT NULL
  ),
  click_base AS (
    SELECT
      csd.web_id,
      csd.day,
      csd.session_id,
      public.traffic_first_landing_url(s.first_landing_url, s.landing_url, s.last_landing_url) AS landing_url,
      public.traffic_first_utm_dim(s.first_utm_source, s.utm_source, s.last_utm_source) AS utm_source,
      public.traffic_first_utm_dim(s.first_utm_medium, s.utm_medium, s.last_utm_medium) AS utm_medium,
      public.traffic_first_utm_dim(s.first_utm_campaign, s.utm_campaign, s.last_utm_campaign) AS utm_campaign,
      public.traffic_first_utm_dim(s.first_utm_content, s.utm_content, s.last_utm_content) AS utm_content,
      public.traffic_first_utm_dim(s.first_utm_term, s.utm_term, s.last_utm_term) AS utm_term,
      (coalesce(s.has_gclid, false) OR coalesce(s.first_has_gclid, false) OR coalesce(s.last_has_gclid, false)) AS has_gclid,
      (coalesce(s.has_fbclid, false) OR coalesce(s.first_has_fbclid, false) OR coalesce(s.last_has_fbclid, false)) AS has_fbclid,
      (coalesce(s.has_msclkid, false) OR coalesce(s.last_has_msclkid, false)) AS has_msclkid,
      (coalesce(s.has_gbraid, false) OR coalesce(s.last_has_gbraid, false)) AS has_gbraid,
      (coalesce(s.has_wbraid, false) OR coalesce(s.last_has_wbraid, false)) AS has_wbraid,
      public.traffic_first_referrer(s.first_referrer, s.referrer, s.last_referrer) AS referrer
    FROM click_session_days csd
    LEFT JOIN public.analytics_sessions s
      ON s.id = csd.session_id
      AND s.web_id = csd.web_id
  ),
  click_effective AS (
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
    FROM click_base
  ),
  click_classified_utm AS (
    SELECT
      e.*,
      CASE
        WHEN e.has_gclid OR e.has_fbclid OR e.has_msclkid OR e.has_gbraid OR e.has_wbraid THEN 'paid_click_ids'
        WHEN
          nullif(btrim(e.utm_source_eff), '') IS NOT NULL
          OR nullif(btrim(e.utm_medium_eff), '') IS NOT NULL
          OR nullif(btrim(e.utm_campaign_eff), '') IS NOT NULL
          OR nullif(btrim(e.utm_content_eff), '') IS NOT NULL
          OR nullif(btrim(e.utm_term_eff), '') IS NOT NULL
          THEN 'utm'
        WHEN nullif(btrim(e.referrer), '') IS NOT NULL THEN 'referral'
        ELSE 'direct'
      END AS source_key
    FROM click_effective e
  ),
  utm_enriched_human AS (
    SELECT
      c.web_id,
      c.day,
      coalesce(
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
      ) AS route,
      coalesce(c.utm_source_eff, '') AS utm_source,
      coalesce(c.utm_medium_eff, '') AS utm_medium,
      coalesce(c.utm_campaign_eff, '') AS utm_campaign,
      coalesce(c.utm_content_eff, '') AS utm_content,
      coalesce(c.utm_term_eff, '') AS utm_term,
      coalesce(p.pv_n, 0)::bigint AS pv_n,
      coalesce(e.ce_n, 0)::bigint AS ce_n,
      sd.smax AS sess_scroll_max
    FROM classified c
    INNER JOIN public.analytics_sessions s
      ON s.id = c.session_id AND s.web_id = c.web_id
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
          nullif(btrim(s.last_landing_url), '') IS NOT NULL
          OR nullif(btrim(s.landing_url), '') IS NOT NULL
          OR nullif(btrim(s.first_landing_url), '') IS NOT NULL
        ) AS had_landing_ref
    ) lp
    LEFT JOIN pv_day p
      ON p.web_id = c.web_id AND p.session_id = c.session_id AND p.day = c.day
    LEFT JOIN ce_day e
      ON e.web_id = c.web_id AND e.session_id = c.session_id AND e.day = c.day
    LEFT JOIN scroll_day sd
      ON sd.web_id = c.web_id AND sd.session_id = c.session_id AND sd.day = c.day
    WHERE
      c.day BETWEEN p_from AND v_to
      AND c.source_key IN ('utm', 'paid_click_ids')
      AND (
        nullif(btrim(c.utm_source_eff), '') IS NOT NULL
        OR nullif(btrim(c.utm_medium_eff), '') IS NOT NULL
        OR nullif(btrim(c.utm_campaign_eff), '') IS NOT NULL
        OR nullif(btrim(c.utm_content_eff), '') IS NOT NULL
        OR nullif(btrim(c.utm_term_eff), '') IS NOT NULL
      )
  ),
  click_utm_addon AS (
    SELECT
      cc.web_id,
      cc.day,
      coalesce(
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
      ) AS route,
      coalesce(cc.utm_source_eff, '') AS utm_source,
      coalesce(cc.utm_medium_eff, '') AS utm_medium,
      coalesce(cc.utm_campaign_eff, '') AS utm_campaign,
      coalesce(cc.utm_content_eff, '') AS utm_content,
      coalesce(cc.utm_term_eff, '') AS utm_term,
      coalesce(p.pv_n, 0)::bigint AS pv_n,
      ed.ce_n::bigint AS ce_n,
      sd.smax AS sess_scroll_max
    FROM click_classified_utm cc
    INNER JOIN ce_day ed
      ON ed.web_id = cc.web_id AND ed.session_id = cc.session_id AND ed.day = cc.day
    LEFT JOIN public.analytics_sessions s
      ON s.id = cc.session_id AND s.web_id = cc.web_id
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
          nullif(btrim(s.last_landing_url), '') IS NOT NULL
          OR nullif(btrim(s.landing_url), '') IS NOT NULL
          OR nullif(btrim(s.first_landing_url), '') IS NOT NULL
        ) AS had_landing_ref
    ) lp
    LEFT JOIN pv_day p
      ON p.web_id = cc.web_id AND p.session_id = cc.session_id AND p.day = cc.day
    LEFT JOIN scroll_day sd
      ON sd.web_id = cc.web_id AND sd.session_id = cc.session_id AND sd.day = cc.day
    WHERE
      cc.day BETWEEN p_from AND v_to
      AND cc.source_key IN ('utm', 'paid_click_ids')
      AND (
        nullif(btrim(cc.utm_source_eff), '') IS NOT NULL
        OR nullif(btrim(cc.utm_medium_eff), '') IS NOT NULL
        OR nullif(btrim(cc.utm_campaign_eff), '') IS NOT NULL
        OR nullif(btrim(cc.utm_content_eff), '') IS NOT NULL
        OR nullif(btrim(cc.utm_term_eff), '') IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM human_sessions hs
        WHERE hs.web_id = cc.web_id AND hs.session_id = cc.session_id AND hs.day = cc.day
      )
  ),
  utm_enriched AS (
    SELECT * FROM utm_enriched_human
    UNION ALL
    SELECT * FROM click_utm_addon
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
    count(*)::bigint AS sessions_count,
    sum(pv_n)::bigint AS page_views_count,
    sum(ce_n)::bigint AS clicks_count,
    count(*) FILTER (WHERE sess_scroll_max IS NOT NULL)::bigint AS scroll_sessions_count,
    max(sess_scroll_max)::double precision AS scroll_max_pct_max,
    coalesce(sum(sess_scroll_max) FILTER (WHERE sess_scroll_max IS NOT NULL), 0)::double precision AS scroll_max_pct_sum
  FROM utm_enriched
  GROUP BY web_id, day, route, utm_source, utm_medium, utm_campaign, utm_content, utm_term
  ON CONFLICT (web_id, day, route, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
  DO UPDATE SET
    sessions_count = excluded.sessions_count,
    page_views_count = excluded.page_views_count,
    clicks_count = excluded.clicks_count,
    scroll_sessions_count = excluded.scroll_sessions_count,
    scroll_max_pct_max = excluded.scroll_max_pct_max,
    scroll_max_pct_sum = excluded.scroll_max_pct_sum;
END;
$body$;

REVOKE ALL ON FUNCTION public.refresh_analytics_daily_rollups(date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_daily_rollups(date, date, text) TO service_role;

COMMENT ON FUNCTION public.refresh_analytics_daily_rollups(date, date, text) IS
  'Rebuild analytics_daily_source_breakdown + analytics_daily_utm using first-touch session attribution helpers.';
