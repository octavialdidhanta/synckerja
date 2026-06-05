-- Initialize remaining_budget on campaign create/update (fixes budget guard blocking first agreement)

CREATE OR REPLACE FUNCTION public.init_kol_campaign_budget()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_effective_total numeric(15, 2);
BEGIN
  v_effective_total := COALESCE(NULLIF(NEW.total_budget, 0), NULLIF(NEW.budget, 0), 0);

  NEW.total_budget := v_effective_total;
  NEW.budget := COALESCE(NULLIF(NEW.budget, 0), v_effective_total, 0);
  NEW.allocated_budget := COALESCE(NEW.allocated_budget, 0);
  NEW.remaining_budget := GREATEST(v_effective_total - COALESCE(NEW.allocated_budget, 0), 0);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS init_kol_campaign_budget_trigger ON public.kol_campaigns;
CREATE TRIGGER init_kol_campaign_budget_trigger
  BEFORE INSERT OR UPDATE OF budget, total_budget, allocated_budget ON public.kol_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.init_kol_campaign_budget();

-- Backfill campaigns with inconsistent remaining_budget
UPDATE public.kol_campaigns
SET
  total_budget = COALESCE(NULLIF(total_budget, 0), NULLIF(budget, 0), 0),
  budget = COALESCE(NULLIF(budget, 0), NULLIF(total_budget, 0), 0),
  remaining_budget = GREATEST(
    COALESCE(NULLIF(total_budget, 0), NULLIF(budget, 0), 0) - COALESCE(allocated_budget, 0),
    0
  ),
  updated_at = timezone('utc'::text, now())
WHERE remaining_budget IS DISTINCT FROM GREATEST(
  COALESCE(NULLIF(total_budget, 0), NULLIF(budget, 0), 0) - COALESCE(allocated_budget, 0),
  0
)
OR (total_budget IS NULL OR total_budget = 0) AND (budget IS NOT NULL AND budget > 0);
