-- Synckerja Order Pay at Cashier: customer QR ticket, hidden until kasir scan.

ALTER TABLE public.pos_pending_checkouts
  ADD COLUMN IF NOT EXISTS checkout_channel text NOT NULL DEFAULT 'qris',
  ADD COLUMN IF NOT EXISTS claim_token text NULL,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz NULL;

ALTER TABLE public.pos_pending_checkouts
  DROP CONSTRAINT IF EXISTS pos_pending_checkouts_checkout_channel_check;

ALTER TABLE public.pos_pending_checkouts
  ADD CONSTRAINT pos_pending_checkouts_checkout_channel_check CHECK (
    checkout_channel = ANY (ARRAY['qris', 'synckerja_cashier']::text[])
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_pending_checkouts_claim_token
  ON public.pos_pending_checkouts (claim_token)
  WHERE claim_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_pending_checkouts_cashier_pending
  ON public.pos_pending_checkouts (organization_id, claim_token)
  WHERE checkout_channel = 'synckerja_cashier' AND status = 'pending';

ALTER TABLE public.pos_table_sessions
  ADD COLUMN IF NOT EXISTS awaiting_cashier_claim boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS claimed_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public._synckerja_order_new_claim_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_try integer := 0;
BEGIN
  LOOP
    v_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.pos_pending_checkouts p WHERE p.claim_token = v_token
    );
    v_try := v_try + 1;
    IF v_try > 12 THEN
      RAISE EXCEPTION 'claim_token_collision';
    END IF;
  END LOOP;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_synckerja_order_pay_at_cashier(
  p_code text,
  p_table_name text,
  p_guest_name text,
  p_cart jsonb,
  p_guest_phone text DEFAULT NULL,
  p_guest_email text DEFAULT NULL,
  p_bill_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_tbl record;
  v_cart jsonb;
  v_session uuid;
  v_subtotal numeric;
  v_totals jsonb;
  v_payload jsonb;
  v_pending uuid;
  v_actor uuid;
  v_st_id uuid;
  v_st_name text := 'Dine In';
  v_hours jsonb;
  v_phone text;
  v_note text;
  v_client text;
  v_token text;
  v_existing public.pos_table_sessions%ROWTYPE;
  v_items jsonb := '[]'::jsonb;
  v_mods jsonb := '[]'::jsonb;
  v_line jsonb;
  v_mod jsonb;
  v_idx integer := 0;
  v_kind text;
  v_opt_id uuid;
  v_group_id uuid;
  v_group_name text;
  v_opt_name text;
  v_extra numeric;
  v_opt_qty numeric;
  v_line_qty numeric;
  v_line_note text;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  v_hours := public._synckerja_order_hours_state(v_out.outlet_id);
  IF NOT COALESCE((v_hours ->> 'is_open')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_closed');
  END IF;
  SELECT * INTO v_tbl FROM public._synckerja_order_table_state(v_out.organization_id, v_out.outlet_id, p_table_name);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'table_not_found');
  END IF;
  IF v_tbl.join_state = 'full' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'table_full');
  END IF;
  v_cart := public._synckerja_order_sanitize_cart(v_out.organization_id, v_out.outlet_id, p_cart);
  IF jsonb_array_length(v_cart) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_cart');
  END IF;
  v_subtotal := public._synckerja_order_cart_subtotal(v_cart);
  v_totals := public._synckerja_order_checkout_totals(v_out.organization_id, v_subtotal);
  v_actor := public._synckerja_order_org_actor(v_out.organization_id);
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_not_ready');
  END IF;
  v_client := COALESCE(NULLIF(btrim(p_guest_name), ''), 'Walk-in');
  v_phone := NULLIF(left(btrim(COALESCE(p_guest_phone, '')), 32), '');
  v_note := NULLIF(left(btrim(COALESCE(p_bill_note, '')), 500), '');
  v_token := public._synckerja_order_new_claim_token();
  SELECT st.id, st.name INTO v_st_id, v_st_name
  FROM public.catalog_sales_types st
  WHERE st.organization_id = v_out.organization_id AND st.is_active AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order LIMIT 1;

  IF v_tbl.join_state = 'join' AND v_tbl.open_session_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.pos_table_sessions
    WHERE id = v_tbl.open_session_id AND status = 'open';
    IF v_existing.awaiting_cashier_claim THEN
      UPDATE public.pos_table_sessions
      SET
        cart_snapshot = v_cart,
        customer_name = COALESCE(NULLIF(btrim(customer_name), ''), NULLIF(btrim(COALESCE(p_guest_name, '')), '')),
        customer_phone = COALESCE(NULLIF(btrim(customer_phone), ''), v_phone),
        guest_note = COALESCE(v_note, guest_note)
      WHERE id = v_existing.id
      RETURNING id INTO v_session;
      UPDATE public.pos_pending_checkouts
      SET status = 'cancelled', cancelled_at = now()
      WHERE session_id = v_session
        AND checkout_channel = 'synckerja_cashier'
        AND status = 'pending';
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'table_busy');
    END IF;
  ELSE
    INSERT INTO public.pos_table_sessions (
      organization_id, outlet_id, group_id, pos_table_id, table_name, pax,
      status, cart_snapshot, customer_name, customer_phone, guest_note,
      awaiting_cashier_claim
    ) VALUES (
      v_out.organization_id, v_out.outlet_id, v_tbl.group_id, v_tbl.table_id, v_tbl.table_name, 1,
      'open', v_cart, NULLIF(btrim(COALESCE(p_guest_name, '')), ''), v_phone, v_note, true
    ) RETURNING id INTO v_session;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_cart)
  LOOP
    v_kind := COALESCE(NULLIF(v_line ->> 'kind', ''), 'product');
    v_line_qty := COALESCE((v_line ->> 'quantity')::numeric, 1);
    v_line_note := public._synckerja_order_sanitize_kitchen_note(
      COALESCE(v_line ->> 'kitchenNote', v_line ->> 'kitchen_note')
    );
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'service_id', v_line -> 'serviceId',
      'sub_service_id', v_line -> 'subServiceId',
      'service_name', v_line ->> 'serviceName',
      'sub_service_name', v_line -> 'subServiceName',
      'quantity', v_line_qty,
      'unit_price', (v_line ->> 'unitPrice')::numeric,
      'total_price', v_line_qty * (v_line ->> 'unitPrice')::numeric,
      'notes', to_jsonb(v_line_note),
      'item_kind', v_kind,
      'inventory_sku_id', v_line -> 'inventorySkuId',
      'track_stock', COALESCE((v_line ->> 'trackStock')::boolean, false),
      'catalog_product_id', CASE WHEN v_kind = 'bundle' THEN NULL ELSE v_line ->> 'catalogId' END,
      'catalog_variant_id', v_line -> 'variantId',
      'catalog_bundle_id', CASE WHEN v_kind = 'bundle' THEN v_line ->> 'catalogId' ELSE NULL END,
      'catalog_sales_type_id', v_st_id,
      'unit_cogs', NULL,
      'cogs_source', 'none'
    ));
    FOR v_mod IN SELECT value FROM jsonb_array_elements(COALESCE(v_line -> 'modifiers', '[]'::jsonb))
    LOOP
      BEGIN
        v_opt_id := COALESCE(NULLIF(v_mod ->> 'optionId', ''), NULLIF(v_mod ->> 'option_id', ''))::uuid;
      EXCEPTION WHEN others THEN
        v_opt_id := NULL;
      END;
      IF v_opt_id IS NULL THEN CONTINUE; END IF;
      BEGIN
        v_opt_qty := GREATEST(1, floor(COALESCE((v_mod ->> 'quantity')::numeric, 1)));
      EXCEPTION WHEN others THEN
        v_opt_qty := 1;
      END;
      SELECT o.group_id, g.name, o.name, COALESCE(o.extra_price, 0)
      INTO v_group_id, v_group_name, v_opt_name, v_extra
      FROM public.catalog_modifier_options o
      JOIN public.catalog_modifier_groups g ON g.id = o.group_id
      WHERE o.id = v_opt_id LIMIT 1;
      v_mods := v_mods || jsonb_build_array(jsonb_build_object(
        'item_index', v_idx,
        'modifier_group_id', v_group_id,
        'modifier_option_id', v_opt_id,
        'group_name', COALESCE(v_group_name, v_mod ->> 'groupName', 'Unknown'),
        'option_name', COALESCE(v_opt_name, v_mod ->> 'name', 'Unknown'),
        'extra_price', COALESCE(v_extra, 0),
        'quantity', v_opt_qty * v_line_qty,
        'line_quantity', v_line_qty,
        'gross_sales', COALESCE(v_extra, 0) * v_opt_qty * v_line_qty,
        'discount_amount', 0
      ));
    END LOOP;
    v_idx := v_idx + 1;
  END LOOP;

  v_payload := jsonb_build_object(
    'checkoutChannel', 'synckerja_cashier',
    'kitchenFired', false,
    'activity', jsonb_build_object(
      'client_name', v_client,
      'client_phone', v_phone,
      'date', CURRENT_DATE,
      'created_by', v_actor,
      'total_amount', (v_totals ->> 'grandTotal')::numeric,
      'table_number', v_tbl.table_name,
      'pos_table_id', v_tbl.table_id,
      'catalog_sales_type_id', v_st_id,
      'checkout_subtotal', (v_totals ->> 'subtotal')::numeric,
      'checkout_tax_amount', (v_totals ->> 'taxTotal')::numeric,
      'checkout_gratuity_amount', (v_totals ->> 'gratuityTotal')::numeric,
      'checkout_application_method', v_totals ->> 'applicationMethod',
      'checkout_discount_amount', 0,
      'description', CASE
        WHEN v_note IS NULL THEN 'Synckerja Order'
        ELSE 'Synckerja Order: ' || v_note
      END
    ),
    'items', v_items,
    'modifiers', v_mods,
    'discounts', '[]'::jsonb,
    'catalogStockLines', '[]'::jsonb,
    'checkoutTotals', v_totals,
    'cart', v_cart,
    'sessionId', v_session,
    'keepSessionOpen', true,
    'remainderCartLines', '[]'::jsonb
  );

  INSERT INTO public.pos_pending_checkouts (
    organization_id, pos_outlet_id, status, payload, session_id,
    keep_session_open, expires_at, created_by, checkout_channel, claim_token
  ) VALUES (
    v_out.organization_id, v_out.outlet_id, 'pending', v_payload, v_session,
    true, now() + interval '4 hours', v_actor, 'synckerja_cashier', v_token
  ) RETURNING id INTO v_pending;

  RETURN jsonb_build_object(
    'ok', true,
    'pending_checkout_id', v_pending,
    'session_id', v_session,
    'claim_token', v_token,
    'grand_total', (v_totals ->> 'grandTotal')::numeric,
    'expires_at', (now() + interval '4 hours')
  );
END;
$$;

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
    'claimed', v_pending.claimed_at IS NOT NULL OR COALESCE(v_session.claimed_at IS NOT NULL, false),
    'paid', v_pending.status = 'paid' OR COALESCE(v_session.status = 'paid', false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_claim_synckerja_cashier_checkout(
  p_claim_token text,
  p_outlet_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_session public.pos_table_sessions%ROWTYPE;
  v_token text;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  v_token := upper(btrim(COALESCE(p_claim_token, '')));
  IF length(v_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_pending
  FROM public.pos_pending_checkouts
  WHERE claim_token = v_token
    AND checkout_channel = 'synckerja_cashier'
    AND pos_outlet_id = p_outlet_id
    AND organization_id IN (SELECT public.user_organization_ids())
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_pending.status NOT IN ('pending', 'paid') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_available', 'status', v_pending.status);
  END IF;
  IF v_pending.expires_at < now() AND v_pending.status = 'pending' THEN
    UPDATE public.pos_pending_checkouts SET status = 'expired' WHERE id = v_pending.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF v_pending.session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_session');
  END IF;
  SELECT * INTO v_session
  FROM public.pos_table_sessions
  WHERE id = v_pending.session_id
    AND outlet_id = p_outlet_id
    AND status = 'open';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_closed');
  END IF;

  UPDATE public.pos_table_sessions
  SET
    awaiting_cashier_claim = false,
    claimed_at = COALESCE(claimed_at, now()),
    claimed_by = COALESCE(claimed_by, v_user)
  WHERE id = v_session.id;

  UPDATE public.pos_pending_checkouts
  SET claimed_at = COALESCE(claimed_at, now())
  WHERE id = v_pending.id;

  RETURN jsonb_build_object(
    'ok', true,
    'pending_checkout_id', v_pending.id,
    'session_id', v_session.id,
    'checkout_channel', 'synckerja_cashier',
    'cart_snapshot', COALESCE(v_session.cart_snapshot, v_pending.payload -> 'cart', '[]'::jsonb),
    'customer_name', v_session.customer_name,
    'customer_phone', v_session.customer_phone,
    'table_name', v_session.table_name,
    'pos_table_id', v_session.pos_table_id,
    'group_id', v_session.group_id,
    'pax', v_session.pax,
    'seated_at', v_session.seated_at,
    'checkout_totals', v_pending.payload -> 'checkoutTotals',
    'payload', v_pending.payload
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_mark_synckerja_cashier_kitchen_fired(
  p_pending_id uuid,
  p_outlet_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.pos_pending_checkouts%ROWTYPE;
  v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  SELECT * INTO v_pending
  FROM public.pos_pending_checkouts
  WHERE id = p_pending_id
    AND pos_outlet_id = p_outlet_id
    AND checkout_channel = 'synckerja_cashier'
    AND organization_id IN (SELECT public.user_organization_ids());
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  v_payload := COALESCE(v_pending.payload, '{}'::jsonb) || jsonb_build_object('kitchenFired', true);
  UPDATE public.pos_pending_checkouts SET payload = v_payload WHERE id = v_pending.id;
  RETURN jsonb_build_object('ok', true, 'kitchen_fired', true);
END;
$$;

REVOKE ALL ON FUNCTION public._synckerja_order_new_claim_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_synckerja_order_pay_at_cashier(text, text, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_synckerja_order_pay_at_cashier(text, text, text, jsonb, text, text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_synckerja_order_cashier_ticket(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_cashier_ticket(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_claim_synckerja_cashier_checkout(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_claim_synckerja_cashier_checkout(text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.pos_mark_synckerja_cashier_kitchen_fired(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_mark_synckerja_cashier_kitchen_fired(uuid, uuid) TO authenticated;
