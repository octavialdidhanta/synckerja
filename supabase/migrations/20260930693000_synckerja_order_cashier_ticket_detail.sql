-- Guest ticket detail: return cart + checkout totals for Order History detail screen.

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_cashier_ticket(
  p_code text,
  p_claim_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_session public.pos_table_sessions%ROWTYPE;
  v_token text;
  v_bill_note text;
BEGIN
  v_token := upper(btrim(COALESCE(p_claim_token, '')));
  IF length(v_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT * INTO v_pending
  FROM public.pos_pending_checkouts
  WHERE organization_id = v_out.organization_id
    AND pos_outlet_id = v_out.outlet_id
    AND claim_token = v_token
    AND checkout_channel = 'synckerja_cashier'
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_pending.expires_at < now() AND v_pending.status = 'pending' THEN
    UPDATE public.pos_pending_checkouts SET status = 'expired' WHERE id = v_pending.id;
    v_pending.status := 'expired';
  END IF;
  IF v_pending.session_id IS NOT NULL THEN
    SELECT * INTO v_session FROM public.pos_table_sessions WHERE id = v_pending.session_id;
  END IF;

  v_bill_note := COALESCE(
    NULLIF(btrim(v_session.guest_note), ''),
    NULLIF(
      btrim(
        regexp_replace(
          COALESCE(v_pending.payload #>> '{activity,description}', ''),
          '^Synckerja Order:\s*',
          '',
          'i'
        )
      ),
      ''
    ),
    NULLIF(btrim(v_pending.payload #>> '{activity,description}'), 'Synckerja Order')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', v_pending.status,
    'claim_token', v_token,
    'table_number', COALESCE(v_session.table_name, v_pending.payload #>> '{activity,table_number}'),
    'grand_total', COALESCE(
      (v_pending.payload #>> '{checkoutTotals,grandTotal}')::numeric,
      (v_pending.payload #>> '{activity,total_amount}')::numeric,
      0
    ),
    'expires_at', v_pending.expires_at,
    'cart_updated_at', v_pending.updated_at,
    'claimed', v_pending.claimed_at IS NOT NULL OR COALESCE(v_session.claimed_at IS NOT NULL, false),
    'paid', v_pending.status = 'paid' OR COALESCE(v_session.status = 'paid', false),
    'cart', COALESCE(v_session.cart_snapshot, v_pending.payload -> 'cart', '[]'::jsonb),
    'checkout_totals', COALESCE(v_pending.payload -> 'checkoutTotals', '{}'::jsonb),
    'bill_note', v_bill_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_cashier_ticket(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_cashier_ticket(text, text) TO anon, authenticated;
