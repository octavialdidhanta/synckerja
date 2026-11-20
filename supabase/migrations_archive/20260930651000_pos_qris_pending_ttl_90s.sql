-- Align pending checkout TTL with 60s QRIS UX (90s buffer).
CREATE OR REPLACE FUNCTION public.pos_create_pending_checkout(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_amount numeric;
  v_session_id uuid;
  v_shift_id uuid;
  v_lead_id uuid;
  v_actor uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'pos_outlet_required';
  END IF;

  v_amount := COALESCE((p_payload -> 'checkoutTotals' ->> 'grandTotal')::numeric, 0);
  IF v_amount < 1500 THEN
    RAISE EXCEPTION 'pos_qris_amount_too_low';
  END IF;
  IF v_amount > 10000000 THEN
    RAISE EXCEPTION 'pos_qris_amount_too_high';
  END IF;

  v_session_id := NULLIF(p_payload ->> 'sessionId', '')::uuid;
  IF v_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pos_pending_checkouts
    WHERE organization_id = p_organization_id
      AND session_id = v_session_id
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'pos_qris_pending_exists';
  END IF;

  v_shift_id := NULLIF(p_payload ->> 'posShiftId', '')::uuid;
  v_lead_id := NULLIF(p_payload ->> 'leadId', '')::uuid;
  v_actor := auth.uid();

  INSERT INTO public.pos_pending_checkouts (
    organization_id,
    pos_outlet_id,
    pos_shift_id,
    status,
    payload,
    lead_id,
    session_id,
    keep_session_open,
    expires_at,
    created_by
  )
  VALUES (
    p_organization_id,
    p_outlet_id,
    v_shift_id,
    'pending',
    p_payload,
    v_lead_id,
    v_session_id,
    COALESCE((p_payload ->> 'keepSessionOpen')::boolean, false),
    now() + interval '90 seconds',
    v_actor
  )
  RETURNING * INTO v_pending;

  RETURN jsonb_build_object(
    'ok', true,
    'pending_checkout_id', v_pending.id,
    'expires_at', v_pending.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pos_create_pending_checkout(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_create_pending_checkout(uuid, uuid, jsonb) TO authenticated;
