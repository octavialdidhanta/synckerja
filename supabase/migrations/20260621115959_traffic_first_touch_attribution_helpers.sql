-- First-touch session attribution helpers for traffic dashboard, rollups, and click drill-down.

CREATE OR REPLACE FUNCTION public.traffic_first_utm_dim(p_first text, p_utm text, p_last text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    nullif(btrim(p_first), ''),
    nullif(btrim(p_utm), ''),
    nullif(btrim(p_last), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.traffic_first_landing_url(p_first text, p_landing text, p_last text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    nullif(btrim(p_first), ''),
    nullif(btrim(p_landing), ''),
    nullif(btrim(p_last), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.traffic_first_referrer(p_first text, p_referrer text, p_last text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    nullif(btrim(p_first), ''),
    nullif(btrim(p_referrer), ''),
    nullif(btrim(p_last), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.traffic_effective_utm_source(
  p_first text,
  p_utm text,
  p_last text,
  p_landing_url text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    nullif(btrim(public.traffic_first_utm_dim(p_first, p_utm, p_last)), ''),
    nullif(trim((regexp_match(coalesce(p_landing_url, ''), '(?i)[?&]utm_source=([^&]*)'))[1]), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.traffic_effective_utm_medium(
  p_first text,
  p_utm text,
  p_last text,
  p_landing_url text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    nullif(btrim(public.traffic_first_utm_dim(p_first, p_utm, p_last)), ''),
    nullif(trim((regexp_match(coalesce(p_landing_url, ''), '(?i)[?&]utm_medium=([^&]*)'))[1]), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.traffic_effective_utm_campaign(
  p_first text,
  p_utm text,
  p_last text,
  p_landing_url text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    nullif(btrim(public.traffic_first_utm_dim(p_first, p_utm, p_last)), ''),
    nullif(trim((regexp_match(coalesce(p_landing_url, ''), '(?i)[?&]utm_campaign=([^&]*)'))[1]), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.traffic_effective_utm_content(
  p_first text,
  p_utm text,
  p_last text,
  p_landing_url text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    nullif(btrim(public.traffic_first_utm_dim(p_first, p_utm, p_last)), ''),
    nullif(trim((regexp_match(coalesce(p_landing_url, ''), '(?i)[?&]utm_content=([^&]*)'))[1]), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.traffic_effective_utm_term(
  p_first text,
  p_utm text,
  p_last text,
  p_landing_url text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    nullif(btrim(public.traffic_first_utm_dim(p_first, p_utm, p_last)), ''),
    nullif(trim((regexp_match(coalesce(p_landing_url, ''), '(?i)[?&]utm_term=([^&]*)'))[1]), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.traffic_session_has_paid_click_ids(
  p_has_gclid boolean,
  p_first_has_gclid boolean,
  p_last_has_gclid boolean,
  p_has_fbclid boolean,
  p_first_has_fbclid boolean,
  p_last_has_fbclid boolean,
  p_has_msclkid boolean,
  p_has_gbraid boolean,
  p_has_wbraid boolean
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    coalesce(p_has_gclid, false)
    OR coalesce(p_first_has_gclid, false)
    OR coalesce(p_last_has_gclid, false)
    OR coalesce(p_has_fbclid, false)
    OR coalesce(p_first_has_fbclid, false)
    OR coalesce(p_last_has_fbclid, false)
    OR coalesce(p_has_msclkid, false)
    OR coalesce(p_has_gbraid, false)
    OR coalesce(p_has_wbraid, false);
$$;

CREATE OR REPLACE FUNCTION public.traffic_classify_session_source_key(
  p_first_utm_source text,
  p_utm_source text,
  p_last_utm_source text,
  p_first_utm_medium text,
  p_utm_medium text,
  p_last_utm_medium text,
  p_first_utm_campaign text,
  p_utm_campaign text,
  p_last_utm_campaign text,
  p_first_utm_content text,
  p_utm_content text,
  p_last_utm_content text,
  p_first_utm_term text,
  p_utm_term text,
  p_last_utm_term text,
  p_first_landing_url text,
  p_landing_url text,
  p_last_landing_url text,
  p_has_gclid boolean,
  p_first_has_gclid boolean,
  p_last_has_gclid boolean,
  p_has_fbclid boolean,
  p_first_has_fbclid boolean,
  p_last_has_fbclid boolean,
  p_has_msclkid boolean,
  p_has_gbraid boolean,
  p_has_wbraid boolean,
  p_first_referrer text,
  p_referrer text,
  p_last_referrer text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  WITH landing AS (
    SELECT public.traffic_first_landing_url(p_first_landing_url, p_landing_url, p_last_landing_url) AS url
  ),
  eff AS (
    SELECT
      public.traffic_effective_utm_source(p_first_utm_source, p_utm_source, p_last_utm_source, landing.url) AS utm_source_eff,
      public.traffic_effective_utm_medium(p_first_utm_medium, p_utm_medium, p_last_utm_medium, landing.url) AS utm_medium_eff,
      public.traffic_effective_utm_campaign(p_first_utm_campaign, p_utm_campaign, p_last_utm_campaign, landing.url) AS utm_campaign_eff,
      public.traffic_effective_utm_content(p_first_utm_content, p_utm_content, p_last_utm_content, landing.url) AS utm_content_eff,
      public.traffic_effective_utm_term(p_first_utm_term, p_utm_term, p_last_utm_term, landing.url) AS utm_term_eff
    FROM landing
  )
  SELECT
    CASE
      WHEN public.traffic_session_has_paid_click_ids(
        p_has_gclid,
        p_first_has_gclid,
        p_last_has_gclid,
        p_has_fbclid,
        p_first_has_fbclid,
        p_last_has_fbclid,
        p_has_msclkid,
        p_has_gbraid,
        p_has_wbraid
      ) THEN 'paid_click_ids'
      WHEN
        nullif(btrim(eff.utm_source_eff), '') IS NOT NULL
        OR nullif(btrim(eff.utm_medium_eff), '') IS NOT NULL
        OR nullif(btrim(eff.utm_campaign_eff), '') IS NOT NULL
        OR nullif(btrim(eff.utm_content_eff), '') IS NOT NULL
        OR nullif(btrim(eff.utm_term_eff), '') IS NOT NULL
        THEN 'utm'
      WHEN nullif(btrim(public.traffic_first_referrer(p_first_referrer, p_referrer, p_last_referrer)), '') IS NOT NULL
        THEN 'referral'
      ELSE 'direct'
    END
  FROM eff;
$$;

COMMENT ON FUNCTION public.traffic_classify_session_source_key(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text, text
) IS
  'Classify analytics session source using first-touch UTM / click IDs (SPA-safe).';
