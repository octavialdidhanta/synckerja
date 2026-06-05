-- actual_payout, milestone_completion_rate, and agreement↔milestone status sync

CREATE OR REPLACE FUNCTION public.refresh_budget_allocation_payout(
  p_campaign_id uuid,
  p_kol_profile_id uuid
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_paid_milestones numeric(15, 2);
  v_total_milestones int;
  v_paid_count int;
  v_completion_rate numeric(5, 2);
  v_bonus numeric(15, 2);
BEGIN
  IF p_campaign_id IS NULL OR p_kol_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(pm.amount) FILTER (WHERE pm.status = 'paid'), 0),
    COUNT(pm.id),
    COUNT(pm.id) FILTER (WHERE pm.status = 'paid')
  INTO v_paid_milestones, v_total_milestones, v_paid_count
  FROM public.kol_payment_terms kpt
  JOIN public.payment_milestones pm ON pm.payment_terms_id = kpt.id
  WHERE kpt.campaign_id = p_campaign_id
    AND kpt.kol_profile_id = p_kol_profile_id
    AND kpt.type = 'agreement';

  SELECT COALESCE(SUM(kpt.bonus_amount), 0)
  INTO v_bonus
  FROM public.kol_payment_terms kpt
  WHERE kpt.campaign_id = p_campaign_id
    AND kpt.kol_profile_id = p_kol_profile_id
    AND kpt.type = 'agreement'
    AND kpt.status IN ('paid', 'partial_paid', 'dp_paid');

  v_completion_rate := CASE
    WHEN v_total_milestones > 0 THEN (v_paid_count::numeric / v_total_milestones::numeric) * 100
    ELSE 0
  END;

  UPDATE public.kol_campaign_budget_allocations
  SET
    actual_payout = v_paid_milestones + v_bonus,
    milestone_completion_rate = v_completion_rate,
    updated_at = timezone('utc'::text, now())
  WHERE campaign_id = p_campaign_id
    AND kol_profile_id = p_kol_profile_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_payment_status_from_milestones(p_payment_terms_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pt public.kol_payment_terms%ROWTYPE;
  v_total int;
  v_paid int;
  v_pending int;
  v_down_payment numeric(15, 2);
  v_new_status text;
  v_remaining numeric(15, 2);
BEGIN
  SELECT * INTO v_pt FROM public.kol_payment_terms WHERE id = p_payment_terms_id;
  IF NOT FOUND OR v_pt.type <> 'agreement' THEN
    RETURN;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'paid'), COUNT(*) FILTER (WHERE status <> 'paid')
  INTO v_total, v_paid, v_pending
  FROM public.payment_milestones
  WHERE payment_terms_id = p_payment_terms_id;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND (milestone_order = 1 OR milestone_name ILIKE '%dp%' OR milestone_name ILIKE '%down%')), 0)
  INTO v_down_payment
  FROM public.payment_milestones
  WHERE payment_terms_id = p_payment_terms_id;

  IF v_paid = v_total THEN
    v_new_status := 'paid';
  ELSIF v_paid > 0 AND v_pending > 0 THEN
    v_new_status := CASE WHEN v_down_payment > 0 THEN 'partial_paid' ELSE 'dp_paid' END;
  ELSE
    v_new_status := v_pt.status;
  END IF;

  v_remaining := GREATEST(
    COALESCE(v_pt.base_amount, 0) + COALESCE(v_pt.bonus_amount, 0) - v_down_payment - COALESCE(v_pt.deduction_amount, 0),
    0
  );

  UPDATE public.kol_payment_terms
  SET
    status = v_new_status,
    down_payment_amount = CASE WHEN v_down_payment > 0 THEN v_down_payment ELSE down_payment_amount END,
    down_payment_date = CASE
      WHEN v_down_payment > 0 AND down_payment_date IS NULL THEN CURRENT_DATE
      ELSE down_payment_date
    END,
    remaining_amount = v_remaining,
    final_payment_date = CASE WHEN v_new_status = 'paid' AND final_payment_date IS NULL THEN CURRENT_DATE ELSE final_payment_date END,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_payment_terms_id
    AND (
      status IS DISTINCT FROM v_new_status
      OR down_payment_amount IS DISTINCT FROM CASE WHEN v_down_payment > 0 THEN v_down_payment ELSE down_payment_amount END
      OR remaining_amount IS DISTINCT FROM v_remaining
    );

  IF v_pt.campaign_id IS NOT NULL AND v_pt.kol_profile_id IS NOT NULL THEN
    PERFORM public.refresh_budget_allocation_payout(v_pt.campaign_id, v_pt.kol_profile_id);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_sync_payment_status_from_milestones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_payment_status_from_milestones(OLD.payment_terms_id);
    RETURN OLD;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.amount IS DISTINCT FROM OLD.amount THEN
    PERFORM public.sync_payment_status_from_milestones(NEW.payment_terms_id);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_payout_on_payment_terms()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.campaign_id IS NOT NULL AND NEW.kol_profile_id IS NOT NULL THEN
    PERFORM public.refresh_budget_allocation_payout(NEW.campaign_id, NEW.kol_profile_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_payout_on_milestone_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign_id uuid;
  v_kol_profile_id uuid;
  v_terms_id uuid;
BEGIN
  v_terms_id := COALESCE(NEW.payment_terms_id, OLD.payment_terms_id);

  SELECT campaign_id, kol_profile_id
  INTO v_campaign_id, v_kol_profile_id
  FROM public.kol_payment_terms
  WHERE id = v_terms_id;

  IF v_campaign_id IS NOT NULL AND v_kol_profile_id IS NOT NULL THEN
    PERFORM public.refresh_budget_allocation_payout(v_campaign_id, v_kol_profile_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_payment_status_from_milestones_trigger ON public.payment_milestones;
CREATE TRIGGER sync_payment_status_from_milestones_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_payment_status_from_milestones();

DROP TRIGGER IF EXISTS refresh_payout_on_milestone_change_trigger ON public.payment_milestones;
CREATE TRIGGER refresh_payout_on_milestone_change_trigger
  AFTER INSERT OR UPDATE OF status, amount OR DELETE ON public.payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_refresh_payout_on_milestone_change();

DROP TRIGGER IF EXISTS refresh_payout_on_payment_terms_trigger ON public.kol_payment_terms;
CREATE TRIGGER refresh_payout_on_payment_terms_trigger
  AFTER UPDATE OF status, bonus_amount, down_payment_amount ON public.kol_payment_terms
  FOR EACH ROW
  WHEN (NEW.type = 'agreement')
  EXECUTE FUNCTION public.trigger_refresh_payout_on_payment_terms();

-- Backfill existing allocations
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT campaign_id, kol_profile_id
    FROM public.kol_campaign_budget_allocations
  LOOP
    PERFORM public.refresh_budget_allocation_payout(r.campaign_id, r.kol_profile_id);
  END LOOP;

  FOR r IN
    SELECT id FROM public.kol_payment_terms WHERE type = 'agreement'
  LOOP
    PERFORM public.sync_payment_status_from_milestones(r.id);
  END LOOP;
END;
$$;
