-- Auto-finalize purchase request (expense + bank mutation) when gateway disbursement completes.
-- Works for both edge-function immediate completion and webhook status updates (no edge deploy required).

CREATE OR REPLACE FUNCTION public.trg_gateway_disbursement_finalize_pr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.source_type IS DISTINCT FROM 'purchase_request' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    BEGIN
      PERFORM public.finalize_purchase_request_gateway_payment(NEW.source_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'finalize_purchase_request_gateway_payment failed for pr %: %', NEW.source_id, SQLERRM;
    END;
  END IF;

  IF NEW.status = 'failed' AND (OLD.status IS DISTINCT FROM 'failed') THEN
    UPDATE public.purchase_requests
    SET payment_status = 'pending', updated_at = now()
    WHERE id = NEW.source_id
      AND payment_status IN ('processing', 'paid');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xendit_disbursement_finalize_pr ON public.xendit_disbursements;
CREATE TRIGGER trg_xendit_disbursement_finalize_pr
  AFTER UPDATE OF status ON public.xendit_disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_gateway_disbursement_finalize_pr();

DROP TRIGGER IF EXISTS trg_brick_disbursement_finalize_pr ON public.brick_disbursements;
CREATE TRIGGER trg_brick_disbursement_finalize_pr
  AFTER UPDATE OF status ON public.brick_disbursements
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_gateway_disbursement_finalize_pr();
