-- Remove auto_create_payment_terms stub, add campaign budget headroom guard

DROP TRIGGER IF EXISTS trigger_auto_create_payment_terms ON public.kol_campaign_budget_allocations;
DROP FUNCTION IF EXISTS public.auto_create_payment_terms();

CREATE OR REPLACE FUNCTION public.check_campaign_budget_headroom(
  p_campaign_id uuid,
  p_additional_amount numeric
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining numeric(15, 2);
  v_additional numeric(15, 2);
BEGIN
  IF p_campaign_id IS NULL THEN
    RETURN true;
  END IF;

  v_additional := COALESCE(p_additional_amount, 0);
  IF v_additional <= 0 THEN
    RETURN true;
  END IF;

  SELECT COALESCE(remaining_budget, 0)
  INTO v_remaining
  FROM public.kol_campaigns
  WHERE id = p_campaign_id;

  IF v_remaining < v_additional THEN
    RAISE EXCEPTION 'Campaign budget exceeded: remaining %, requested %', v_remaining, v_additional
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_payment_terms_budget_headroom()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'agreement' AND NEW.campaign_id IS NOT NULL AND COALESCE(NEW.base_amount, 0) > 0 THEN
    PERFORM public.check_campaign_budget_headroom(NEW.campaign_id, NEW.base_amount);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_payment_terms_budget_headroom_trigger ON public.kol_payment_terms;
CREATE TRIGGER guard_payment_terms_budget_headroom_trigger
  BEFORE INSERT ON public.kol_payment_terms
  FOR EACH ROW
  WHEN (NEW.type = 'agreement' AND NEW.campaign_id IS NOT NULL)
  EXECUTE FUNCTION public.guard_payment_terms_budget_headroom();
