-- Normalize legacy campaign targets, require sane engagement %, milestone duplicate audit

CREATE OR REPLACE FUNCTION public.normalize_kol_campaign_targets()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.target_engagement IS NOT NULL AND NEW.target_engagement > 100
     AND NEW.target_reach IS NOT NULL AND NEW.target_reach > 0 THEN
    NEW.target_engagement := LEAST(
      100,
      GREATEST(1, ROUND((NEW.target_engagement::numeric / NEW.target_reach) * 100, 1)::integer)
    );
  END IF;

  IF NEW.target_engagement IS NOT NULL THEN
    NEW.target_engagement := LEAST(100, GREATEST(0, NEW.target_engagement));
  END IF;

  IF NEW.target_engagement IS NULL OR NEW.target_engagement <= 0 THEN
    NEW.target_engagement := 5;
  END IF;

  IF NEW.target_conversion IS NULL OR NEW.target_conversion <= 0 THEN
    NEW.target_conversion := GREATEST(
      1,
      COALESCE(ROUND(COALESCE(NEW.target_reach, 100000)::numeric / 5000.0)::integer, 1)
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS normalize_kol_campaign_targets_trigger ON public.kol_campaigns;
CREATE TRIGGER normalize_kol_campaign_targets_trigger
  BEFORE INSERT OR UPDATE OF target_reach, target_engagement, target_conversion ON public.kol_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_kol_campaign_targets();

-- Backfill legacy campaigns: engagement stored as absolute count, missing conversion
UPDATE public.kol_campaigns
SET
  target_engagement = LEAST(
    100,
    GREATEST(
      1,
      ROUND((target_engagement::numeric / NULLIF(target_reach, 0)) * 100, 1)::integer
    )
  ),
  updated_at = timezone('utc'::text, now())
WHERE target_engagement IS NOT NULL
  AND target_engagement > 100
  AND target_reach IS NOT NULL
  AND target_reach > 0;

UPDATE public.kol_campaigns
SET
  target_conversion = GREATEST(1, ROUND(COALESCE(target_reach, 100000)::numeric / 5000.0)::integer),
  updated_at = timezone('utc'::text, now())
WHERE target_conversion IS NULL OR target_conversion <= 0;

UPDATE public.kol_campaigns
SET
  target_engagement = 5,
  updated_at = timezone('utc'::text, now())
WHERE target_engagement IS NULL OR target_engagement <= 0;

-- Production monitoring: duplicate milestones per (payment_terms_id, milestone_order)
CREATE OR REPLACE FUNCTION public.audit_duplicate_payment_milestones()
 RETURNS TABLE(
   payment_terms_id uuid,
   milestone_order integer,
   duplicate_count bigint,
   organization_id uuid
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    pm.payment_terms_id,
    pm.milestone_order,
    COUNT(*) AS duplicate_count,
    kpt.organization_id
  FROM public.payment_milestones pm
  JOIN public.kol_payment_terms kpt ON kpt.id = pm.payment_terms_id
  GROUP BY pm.payment_terms_id, pm.milestone_order, kpt.organization_id
  HAVING COUNT(*) > 1
  ORDER BY duplicate_count DESC;
$function$;

REVOKE ALL ON FUNCTION public.audit_duplicate_payment_milestones() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_duplicate_payment_milestones() TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_duplicate_payment_milestones() TO service_role;
