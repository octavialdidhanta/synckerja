-- Table-menu Take Away: resolve sales type by fulfillment, stamp on cashier + QRIS pending.

CREATE OR REPLACE FUNCTION public._synckerja_order_resolve_sales_type(
  p_org uuid,
  p_fulfillment text
)
RETURNS TABLE (
  sales_type_id uuid,
  sales_type_name text,
  fulfillment text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text := lower(btrim(COALESCE(p_fulfillment, 'dine_in')));
  v_id uuid;
  v_name text;
BEGIN
  IF v_mode NOT IN ('dine_in', 'takeaway') THEN
    v_mode := 'dine_in';
  END IF;

  IF v_mode = 'takeaway' THEN
    SELECT st.id, st.name INTO v_id, v_name
    FROM public.catalog_sales_types st
    WHERE st.organization_id = p_org
      AND st.is_active
      AND (lower(st.name) LIKE '%take%' OR lower(st.name) LIKE '%bawa%')
    ORDER BY st.sort_order
    LIMIT 1;
    IF v_id IS NULL THEN
      v_name := 'Takeaway';
    END IF;
  ELSE
    SELECT st.id, st.name INTO v_id, v_name
    FROM public.catalog_sales_types st
    WHERE st.organization_id = p_org
      AND st.is_active
      AND lower(st.name) LIKE '%dine%'
    ORDER BY st.sort_order
    LIMIT 1;
    IF v_id IS NULL THEN
      v_name := 'Dine In';
    END IF;
  END IF;

  sales_type_id := v_id;
  sales_type_name := COALESCE(v_name, CASE WHEN v_mode = 'takeaway' THEN 'Takeaway' ELSE 'Dine In' END);
  fulfillment := v_mode;
  RETURN NEXT;
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
  v_fulfillment text;
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
  v_fulfillment := COALESCE(
    NULLIF(v_pending.payload ->> 'fulfillmentMode', ''),
    'dine_in'
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
    'fulfillment', v_fulfillment,
    'sales_type_label', COALESCE(
      v_pending.payload ->> 'salesTypeLabel',
      CASE WHEN v_fulfillment = 'takeaway' THEN 'Takeaway' ELSE 'Dine In' END
    )
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
  v_st_id uuid;
  v_st_label text;
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
  IF v_pending.status = 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_paid');
  END IF;
  IF v_pending.status NOT IN ('pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_available', 'status', v_pending.status);
  END IF;
  IF v_pending.expires_at < now() THEN
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
    IF EXISTS (
      SELECT 1 FROM public.pos_table_sessions
      WHERE id = v_pending.session_id AND status = 'paid'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'already_paid');
    END IF;
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

  BEGIN
    v_st_id := NULLIF(v_pending.payload #>> '{activity,catalog_sales_type_id}', '')::uuid;
  EXCEPTION WHEN others THEN
    v_st_id := NULL;
  END;
  v_st_label := COALESCE(
    NULLIF(v_pending.payload ->> 'salesTypeLabel', ''),
    CASE
      WHEN COALESCE(v_pending.payload ->> 'fulfillmentMode', 'dine_in') = 'takeaway' THEN 'Takeaway'
      ELSE 'Dine In'
    END
  );

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
    'payload', v_pending.payload,
    'catalog_sales_type_id', v_st_id,
    'sales_type_label', v_st_label,
    'fulfillment', COALESCE(v_pending.payload ->> 'fulfillmentMode', 'dine_in')
  );
END;
$$;

DROP FUNCTION IF EXISTS public.submit_synckerja_order_pay_at_cashier(text, text, text, jsonb, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_synckerja_order_pay_at_cashier(
  p_code text,
  p_table_name text,
  p_guest_name text,
  p_cart jsonb,
  p_guest_phone text DEFAULT NULL,
  p_guest_email text DEFAULT NULL,
  p_bill_note text DEFAULT NULL,
  p_fulfillment text DEFAULT 'dine_in'
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
  v_pending_row public.pos_pending_checkouts%ROWTYPE;
  v_actor uuid;
  v_st record;
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
  v_reuse_pending boolean := false;
  v_prev_fulfillment text;
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
  SELECT * INTO v_st
  FROM public._synckerja_order_resolve_sales_type(v_out.organization_id, p_fulfillment);

  SELECT p.* INTO v_pending_row
  FROM public.pos_pending_checkouts p
  JOIN public.pos_table_sessions s ON s.id = p.session_id
  WHERE s.organization_id = v_out.organization_id
    AND s.outlet_id = v_out.outlet_id
    AND s.pos_table_id = v_tbl.table_id
    AND s.status = 'open'
    AND p.checkout_channel = 'synckerja_cashier'
    AND p.status = 'pending'
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_prev_fulfillment := COALESCE(NULLIF(v_pending_row.payload ->> 'fulfillmentMode', ''), 'dine_in');
    IF v_prev_fulfillment IS DISTINCT FROM v_st.fulfillment THEN
      RETURN jsonb_build_object('ok', false, 'error', 'fulfillment_mismatch');
    END IF;
    v_reuse_pending := true;
    v_token := v_pending_row.claim_token;
    v_pending := v_pending_row.id;
    SELECT * INTO v_existing FROM public.pos_table_sessions WHERE id = v_pending_row.session_id;
    UPDATE public.pos_table_sessions
    SET
      cart_snapshot = v_cart,
      customer_name = COALESCE(NULLIF(btrim(customer_name), ''), NULLIF(btrim(COALESCE(p_guest_name, '')), '')),
      customer_phone = COALESCE(NULLIF(btrim(customer_phone), ''), v_phone),
      guest_note = COALESCE(v_note, guest_note)
    WHERE id = v_existing.id;
    v_session := v_existing.id;
  ELSE
    SELECT * INTO v_existing
    FROM public.pos_table_sessions
    WHERE organization_id = v_out.organization_id
      AND outlet_id = v_out.outlet_id
      AND pos_table_id = v_tbl.table_id
      AND status = 'open'
      AND awaiting_cashier_claim = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.pos_table_sessions
      SET
        cart_snapshot = v_cart,
        customer_name = COALESCE(NULLIF(btrim(customer_name), ''), NULLIF(btrim(COALESCE(p_guest_name, '')), '')),
        customer_phone = COALESCE(NULLIF(btrim(customer_phone), ''), v_phone),
        guest_note = COALESCE(v_note, guest_note)
      WHERE id = v_existing.id
      RETURNING id INTO v_session;
      v_token := public._synckerja_order_new_claim_token();
    ELSIF v_tbl.join_state = 'join' AND v_tbl.open_session_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'table_busy');
    ELSE
      v_token := public._synckerja_order_new_claim_token();
      INSERT INTO public.pos_table_sessions (
        organization_id, outlet_id, group_id, pos_table_id, table_name, pax,
        status, cart_snapshot, customer_name, customer_phone, guest_note,
        awaiting_cashier_claim
      ) VALUES (
        v_out.organization_id, v_out.outlet_id, v_tbl.group_id, v_tbl.table_id, v_tbl.table_name, 1,
        'open', v_cart, NULLIF(btrim(COALESCE(p_guest_name, '')), ''), v_phone, v_note, true
      ) RETURNING id INTO v_session;
    END IF;
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
      'catalog_sales_type_id', v_st.sales_type_id,
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
    'fulfillmentMode', v_st.fulfillment,
    'salesTypeLabel', v_st.sales_type_name,
    'kitchenFired', COALESCE((v_pending_row.payload ->> 'kitchenFired')::boolean, false),
    'activity', jsonb_build_object(
      'client_name', v_client,
      'client_phone', v_phone,
      'date', CURRENT_DATE,
      'created_by', v_actor,
      'total_amount', (v_totals ->> 'grandTotal')::numeric,
      'table_number', v_tbl.table_name,
      'pos_table_id', v_tbl.table_id,
      'catalog_sales_type_id', v_st.sales_type_id,
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

  IF v_reuse_pending THEN
    UPDATE public.pos_pending_checkouts
    SET
      payload = v_payload,
      expires_at = now() + interval '4 hours',
      updated_at = now()
    WHERE id = v_pending;
  ELSE
    INSERT INTO public.pos_pending_checkouts (
      organization_id, pos_outlet_id, status, payload, session_id,
      keep_session_open, expires_at, created_by, checkout_channel, claim_token
    ) VALUES (
      v_out.organization_id, v_out.outlet_id, 'pending', v_payload, v_session,
      true, now() + interval '4 hours', v_actor, 'synckerja_cashier', v_token
    ) RETURNING id INTO v_pending;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pending_checkout_id', v_pending,
    'session_id', v_session,
    'claim_token', v_token,
    'grand_total', (v_totals ->> 'grandTotal')::numeric,
    'expires_at', (now() + interval '4 hours'),
    'updated_in_place', v_reuse_pending,
    'fulfillment', v_st.fulfillment,
    'sales_type_label', v_st.sales_type_name
  );
END;
$$;

DROP FUNCTION IF EXISTS public.submit_synckerja_order_create_qris(text, text, text, jsonb, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_synckerja_order_create_qris(
  p_code text,
  p_table_name text,
  p_guest_name text,
  p_cart jsonb,
  p_guest_phone text DEFAULT NULL,
  p_guest_email text DEFAULT NULL,
  p_bill_note text DEFAULT NULL,
  p_fulfillment text DEFAULT 'dine_in'
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
  v_lead uuid;
  v_st record;
  v_client text;
  v_items jsonb := '[]'::jsonb;
  v_mods jsonb := '[]'::jsonb;
  v_line jsonb;
  v_mod jsonb;
  v_status uuid;
  v_hours jsonb;
  v_idx integer := 0;
  v_kind text;
  v_opt_id uuid;
  v_group_id uuid;
  v_group_name text;
  v_opt_name text;
  v_extra numeric;
  v_opt_qty numeric;
  v_line_qty numeric;
  v_note text;
  v_phone text;
  v_email text;
  v_bill text;
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
  IF COALESCE((v_totals ->> 'grandTotal')::numeric, 0) < 1500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pos_qris_amount_too_low');
  END IF;
  v_actor := public._synckerja_order_org_actor(v_out.organization_id);
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_not_ready');
  END IF;
  v_client := COALESCE(NULLIF(btrim(p_guest_name), ''), 'Walk-in');
  v_phone := NULLIF(left(btrim(COALESCE(p_guest_phone, '')), 32), '');
  v_email := NULLIF(left(btrim(COALESCE(p_guest_email, '')), 120), '');
  v_bill := NULLIF(left(btrim(COALESCE(p_bill_note, '')), 500), '');
  SELECT * INTO v_st
  FROM public._synckerja_order_resolve_sales_type(v_out.organization_id, p_fulfillment);
  SELECT id INTO v_status FROM public.lead_statuses
  WHERE organization_id = v_out.organization_id OR organization_id IS NULL
  ORDER BY sort_order ASC LIMIT 1;

  v_lead := public._synckerja_order_ensure_lead(
    v_out.organization_id,
    v_actor,
    v_status,
    v_client,
    v_phone,
    v_email
  );

  IF v_tbl.join_state = 'join' AND v_tbl.open_session_id IS NOT NULL THEN
    v_session := v_tbl.open_session_id;
    UPDATE public.pos_table_sessions
    SET pax = pax + 1,
        customer_name = COALESCE(NULLIF(btrim(customer_name), ''), NULLIF(v_client, 'Walk-in')),
        customer_phone = COALESCE(NULLIF(btrim(customer_phone), ''), v_phone),
        guest_note = COALESCE(v_bill, guest_note)
    WHERE id = v_session AND status = 'open';
  ELSE
    INSERT INTO public.pos_table_sessions (
      organization_id, outlet_id, group_id, pos_table_id, table_name, pax,
      status, cart_snapshot, customer_name, customer_phone, guest_note
    ) VALUES (
      v_out.organization_id, v_out.outlet_id, v_tbl.group_id, v_tbl.table_id, v_tbl.table_name, 1,
      'open', '[]'::jsonb, NULLIF(v_client, 'Walk-in'), v_phone, v_bill
    ) RETURNING id INTO v_session;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_cart)
  LOOP
    v_kind := COALESCE(NULLIF(v_line ->> 'kind', ''), 'product');
    v_line_qty := COALESCE((v_line ->> 'quantity')::numeric, 1);
    v_note := public._synckerja_order_sanitize_kitchen_note(
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
      'notes', to_jsonb(v_note),
      'item_kind', v_kind,
      'inventory_sku_id', v_line -> 'inventorySkuId',
      'track_stock', COALESCE((v_line ->> 'trackStock')::boolean, false),
      'catalog_product_id', CASE WHEN v_kind = 'bundle' THEN NULL ELSE v_line ->> 'catalogId' END,
      'catalog_variant_id', v_line -> 'variantId',
      'catalog_bundle_id', CASE WHEN v_kind = 'bundle' THEN v_line ->> 'catalogId' ELSE NULL END,
      'catalog_sales_type_id', v_st.sales_type_id,
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
      IF v_opt_id IS NULL THEN
        CONTINUE;
      END IF;
      BEGIN
        v_opt_qty := GREATEST(1, floor(COALESCE((v_mod ->> 'quantity')::numeric, 1)));
      EXCEPTION WHEN others THEN
        v_opt_qty := 1;
      END;
      SELECT o.group_id, g.name, o.name, COALESCE(o.extra_price, 0)
      INTO v_group_id, v_group_name, v_opt_name, v_extra
      FROM public.catalog_modifier_options o
      JOIN public.catalog_modifier_groups g ON g.id = o.group_id
      WHERE o.id = v_opt_id
      LIMIT 1;
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
    'fulfillmentMode', v_st.fulfillment,
    'salesTypeLabel', v_st.sales_type_name,
    'activity', jsonb_build_object(
      'lead_id', v_lead,
      'client_name', v_client,
      'client_phone', v_phone,
      'date', CURRENT_DATE,
      'created_by', v_actor,
      'total_amount', (v_totals ->> 'grandTotal')::numeric,
      'table_number', v_tbl.table_name,
      'pos_table_id', v_tbl.table_id,
      'catalog_sales_type_id', v_st.sales_type_id,
      'checkout_subtotal', (v_totals ->> 'subtotal')::numeric,
      'checkout_tax_amount', (v_totals ->> 'taxTotal')::numeric,
      'checkout_gratuity_amount', (v_totals ->> 'gratuityTotal')::numeric,
      'checkout_application_method', v_totals ->> 'applicationMethod',
      'checkout_discount_amount', 0,
      'description', CASE
        WHEN v_bill IS NULL THEN 'Synckerja Order'
        ELSE 'Synckerja Order: ' || v_bill
      END
    ),
    'items', v_items,
    'modifiers', v_mods,
    'discounts', '[]'::jsonb,
    'catalogStockLines', '[]'::jsonb,
    'checkoutTotals', v_totals,
    'cart', v_cart,
    'leadId', v_lead,
    'sessionId', v_session,
    'keepSessionOpen', true,
    'remainderCartLines', '[]'::jsonb
  );

  INSERT INTO public.pos_pending_checkouts (
    organization_id, pos_outlet_id, status, payload, lead_id, session_id,
    keep_session_open, expires_at, created_by
  ) VALUES (
    v_out.organization_id, v_out.outlet_id, 'pending', v_payload, v_lead, v_session,
    true, now() + interval '90 seconds', v_actor
  ) RETURNING id INTO v_pending;

  RETURN jsonb_build_object(
    'ok', true,
    'pending_checkout_id', v_pending,
    'session_id', v_session,
    'fulfillment', v_st.fulfillment,
    'sales_type_label', v_st.sales_type_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public._synckerja_order_resolve_sales_type(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_synckerja_order_pay_at_cashier(text, text, text, jsonb, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_synckerja_order_pay_at_cashier(text, text, text, jsonb, text, text, text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb, text, text, text, text) TO anon, authenticated;
