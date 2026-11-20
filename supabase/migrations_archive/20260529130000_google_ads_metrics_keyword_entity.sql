-- Allow keyword entity in Google Ads metrics cache and user preferences.

ALTER TABLE public.google_ads_metrics_cache
  DROP CONSTRAINT IF EXISTS google_ads_metrics_cache_entity_check;

ALTER TABLE public.google_ads_metrics_cache
  ADD CONSTRAINT google_ads_metrics_cache_entity_check CHECK (
    entity = ANY (
      ARRAY[
        'campaign'::text,
        'ad_group'::text,
        'ad'::text,
        'keyword'::text
      ]
    )
  );

ALTER TABLE public.organization_google_ads_metrics_preferences
  DROP CONSTRAINT IF EXISTS organization_google_ads_metrics_preferences_entity_check;

ALTER TABLE public.organization_google_ads_metrics_preferences
  ADD CONSTRAINT organization_google_ads_metrics_preferences_entity_check CHECK (
    entity = ANY (
      ARRAY[
        'campaign'::text,
        'ad_group'::text,
        'ad'::text,
        'keyword'::text
      ]
    )
  );
