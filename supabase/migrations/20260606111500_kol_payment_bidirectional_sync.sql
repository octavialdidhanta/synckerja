-- Bidirectional agreement <-> milestone sync; fix stale partial_paid state

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

  IF v_paid = 0 THEN
    v_new_status := 'draft';
    v_down_payment := 0;
  ELSIF v_paid = v_total THEN
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

  PERFORM set_config('kol.suppress_agreement_milestone_sync', 'on', true);

  UPDATE public.kol_payment_terms
  SET
    status = v_new_status,
    down_payment_amount = CASE WHEN v_down_payment > 0 THEN v_down_payment WHEN v_paid = 0 THEN 0 ELSE down_payment_amount END,
    down_payment_date = CASE
      WHEN v_down_payment > 0 AND down_payment_date IS NULL THEN CURRENT_DATE
      WHEN v_paid = 0 THEN NULL
      ELSE down_payment_date
    END,
    remaining_amount = v_remaining,
    final_payment_date = CASE WHEN v_new_status = 'paid' AND final_payment_date IS NULL THEN CURRENT_DATE ELSE final_payment_date END,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_payment_terms_id
    AND (
      status IS DISTINCT FROM v_new_status
      OR down_payment_amount IS DISTINCT FROM CASE WHEN v_down_payment > 0 THEN v_down_payment WHEN v_paid = 0 THEN 0 ELSE down_payment_amount END
      OR remaining_amount IS DISTINCT FROM v_remaining
    );

  PERFORM set_config('kol.suppress_agreement_milestone_sync', 'off', true);

  IF v_pt.campaign_id IS NOT NULL AND v_pt.kol_profile_id IS NOT NULL THEN
    PERFORM public.refresh_budget_allocation_payout(v_pt.campaign_id, v_pt.kol_profile_id);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_milestones_from_payment_status(p_payment_terms_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pt public.kol_payment_terms%ROWTYPE;
BEGIN
  SELECT * INTO v_pt FROM public.kol_payment_terms WHERE id = p_payment_terms_id;
  IF NOT FOUND OR v_pt.type <> 'agreement' THEN
    RETURN;
  END IF;

  PERFORM set_config('kol.suppress_milestone_status_sync', 'on', true);

  IF v_pt.status = 'paid' THEN
    UPDATE public.payment_milestones
    SET status = 'paid', updated_at = timezone('utc'::text, now())
    WHERE payment_terms_id = p_payment_terms_id AND status IS DISTINCT FROM 'paid';
  ELSIF v_pt.status IN ('dp_paid', 'partial_paid') AND COALESCE(v_pt.down_payment_amount, 0) > 0 THEN
    UPDATE public.payment_milestones
    SET status = 'paid', updated_at = timezone('utc'::text, now())
    WHERE payment_terms_id = p_payment_terms_id
      AND (
        milestone_order = 1
        OR milestone_name ILIKE '%dp%'
        OR milestone_name ILIKE '%down%'
      )
      AND status IS DISTINCT FROM 'paid';
  END IF;

  PERFORM set_config('kol.suppress_milestone_status_sync', 'off', true);
  PERFORM public.sync_payment_status_from_milestones(p_payment_terms_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_sync_milestones_from_payment_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('kol.suppress_agreement_milestone_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.down_payment_amount IS DISTINCT FROM OLD.down_payment_amount THEN
    PERFORM public.sync_milestones_from_payment_status(NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_milestones_from_payment_status_trigger ON public.kol_payment_terms;
CREATE TRIGGER sync_milestones_from_payment_status_trigger
  AFTER UPDATE OF status, down_payment_amount ON public.kol_payment_terms
  FOR EACH ROW
  WHEN (NEW.type = 'agreement')
  EXECUTE FUNCTION public.trigger_sync_milestones_from_payment_status();

-- Re-sync stale agreements where partial_paid but no paid milestones
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT kpt.id
    FROM public.kol_payment_terms kpt
    WHERE kpt.type = 'agreement'
      AND kpt.status IN ('partial_paid', 'dp_paid', 'paid')
  LOOP
    PERFORM public.sync_payment_status_from_milestones(r.id);
  END LOOP;
END;
$$;
