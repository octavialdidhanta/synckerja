-- Allow org members to reconcile a stuck Xendit disbursement after verifying funds left xenPlatform.
-- Updates status → completed, which fires trg_gateway_disbursement_finalize_pr (expense + bank mutation).

CREATE OR REPLACE FUNCTION public.reconcile_xendit_disbursement_completed(p_disbursement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.xendit_disbursements%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_row FROM public.xendit_disbursements WHERE id = p_disbursement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'disbursement_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.organization_id = v_row.organization_id
      AND ur.user_id = v_uid
      AND ur.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_row.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'status', v_row.status);
  END IF;

  UPDATE public.xendit_disbursements
  SET
    status = 'completed',
    completed_at = COALESCE(completed_at, now()),
    updated_at = now()
  WHERE id = p_disbursement_id;

  RETURN jsonb_build_object('ok', true, 'disbursement_id', p_disbursement_id);
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_xendit_disbursement_completed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_xendit_disbursement_completed(uuid) TO authenticated;
