-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_kol_conversion_aggregates_unique
  ON public.kol_conversion_aggregates (content_post_id, kol_profile_id, conversion_day);

-- Harden trigger: fallback to non-concurrent refresh; support DELETE
CREATE OR REPLACE FUNCTION public.trigger_refresh_conversion_aggregates()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.kol_conversion_aggregates;
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
    WHEN OTHERS THEN
      BEGIN
        REFRESH MATERIALIZED VIEW public.kol_conversion_aggregates;
      EXCEPTION
        WHEN undefined_table THEN
          NULL;
      END;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
