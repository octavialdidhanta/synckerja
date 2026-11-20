-- Pending Pay-at-Cashier tickets (awaiting_cashier_claim) must not block the guest menu
-- or mark the table full/occupied on POS — only real seated bills count toward pax.

CREATE OR REPLACE FUNCTION public._synckerja_order_table_state(
  p_org uuid,
  p_outlet uuid,
  p_table_name text
)
RETURNS TABLE (
  table_id uuid,
  table_name text,
  group_id uuid,
  table_pax int,
  occupied_pax int,
  remaining_pax int,
  open_session_id uuid,
  join_state text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table public.pos_tables%ROWTYPE;
  v_occ int := 0;
  v_session uuid;
BEGIN
  IF p_table_name IS NULL OR btrim(p_table_name) = '' THEN
    RETURN;
  END IF;
  SELECT t.* INTO v_table
  FROM public.pos_tables t
  WHERE t.organization_id = p_org
    AND t.outlet_id = p_outlet
    AND t.is_deleted = false
    AND lower(btrim(t.name)) = lower(btrim(p_table_name))
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT COALESCE(SUM(s.pax), 0) INTO v_occ
  FROM public.pos_table_sessions s
  WHERE s.organization_id = p_org
    AND s.outlet_id = p_outlet
    AND s.pos_table_id = v_table.id
    AND s.status = 'open'
    AND COALESCE(s.awaiting_cashier_claim, false) = false;
  SELECT s.id INTO v_session
  FROM public.pos_table_sessions s
  WHERE s.organization_id = p_org
    AND s.outlet_id = p_outlet
    AND s.pos_table_id = v_table.id
    AND s.status = 'open'
    AND COALESCE(s.awaiting_cashier_claim, false) = false
    AND s.sales_activity_id IS NULL
  ORDER BY s.created_at DESC
  LIMIT 1;
  IF v_session IS NULL THEN
    SELECT s.id INTO v_session
    FROM public.pos_table_sessions s
    WHERE s.organization_id = p_org
      AND s.outlet_id = p_outlet
      AND s.pos_table_id = v_table.id
      AND s.status = 'open'
      AND COALESCE(s.awaiting_cashier_claim, false) = false
    ORDER BY s.created_at DESC
    LIMIT 1;
  END IF;
  table_id := v_table.id;
  table_name := v_table.name;
  group_id := v_table.group_id;
  table_pax := v_table.pax;
  occupied_pax := v_occ;
  remaining_pax := GREATEST(0, v_table.pax - v_occ);
  open_session_id := v_session;
  IF v_occ <= 0 THEN
    join_state := 'empty';
  ELSIF remaining_pax >= 1 THEN
    join_state := 'join';
  ELSE
    join_state := 'full';
  END IF;
  RETURN NEXT;
END;
$$;

-- Replace pending cashier ticket on same table (join_state may be 'empty' after fix above).
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
    UPDATE public.pos_pending_checkouts
    SET status = 'cancelled', cancelled_at = now()
    WHERE session_id = v_session
      AND checkout_channel = 'synckerja_cashier'
      AND status = 'pending';
  ELSIF v_tbl.join_state = 'join' AND v_tbl.open_session_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'table_busy');
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
