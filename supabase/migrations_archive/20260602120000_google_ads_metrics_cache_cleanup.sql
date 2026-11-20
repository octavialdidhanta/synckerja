-- Purge expired Google Ads metrics cache rows (optional pg_cron schedule).

CREATE OR REPLACE FUNCTION public.purge_expired_google_ads_metrics_cache()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.google_ads_metrics_cache
    WHERE expires_at < now()
    RETURNING id
  )
  SELECT count(*)::integer FROM deleted;
$$;

COMMENT ON FUNCTION public.purge_expired_google_ads_metrics_cache() IS
  'Deletes google_ads_metrics_cache rows past expires_at. Schedule via pg_cron or manual call.';

REVOKE ALL ON FUNCTION public.purge_expired_google_ads_metrics_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_google_ads_metrics_cache() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'purge-google-ads-metrics-cache'
    ) THEN
      PERFORM cron.schedule(
        'purge-google-ads-metrics-cache',
        '15 * * * *',
        $cmd$SELECT public.purge_expired_google_ads_metrics_cache();$cmd$
      );
    END IF;
  END IF;
END
$cron$;
