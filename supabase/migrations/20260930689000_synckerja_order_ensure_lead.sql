-- Reuse existing org lead by phone for Synckerja Order QRIS (pos_checkout_phone_exists guard).

CREATE OR REPLACE FUNCTION public._synckerja_order_ensure_lead(
  p_org uuid,
  p_actor uuid,
  p_status uuid,
  p_client text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead uuid;
  v_existing_client text;
  v_phone text;
  v_email text;
  v_phone_key text;
  v_client text;
BEGIN
  v_client := COALESCE(NULLIF(btrim(p_client), ''), 'Walk-in');
  IF public.is_generic_customer_name(v_client) THEN
    v_client := 'Walk-in';
  END IF;
  v_phone := NULLIF(left(btrim(COALESCE(p_phone, '')), 32), '');
  v_email := NULLIF(left(btrim(COALESCE(p_email, '')), 120), '');
  v_phone_key := public.normalize_wa_phone_key(v_phone);

  IF v_phone_key IS NOT NULL THEN
    SELECT l.id, l.client
    INTO v_lead, v_existing_client
    FROM public.leads l
    WHERE l.organization_id = p_org
      AND l.phone_number IS NOT NULL
      AND public.normalize_wa_phone_key(l.phone_number) = v_phone_key
    ORDER BY l.updated_at DESC NULLS LAST, l.created_at DESC
    LIMIT 1;

    IF v_lead IS NOT NULL THEN
      IF public.is_generic_customer_name(v_existing_client)
         AND NOT public.is_generic_customer_name(v_client) THEN
        UPDATE public.leads SET client = v_client WHERE id = v_lead;
      END IF;
      IF v_email IS NOT NULL THEN
        UPDATE public.leads
        SET email = COALESCE(NULLIF(btrim(email), ''), v_email)
        WHERE id = v_lead;
      END IF;
      RETURN v_lead;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.leads (
      ticket_id, client, title, category, created_by, created_by_name, assignee,
      status_id, organization_id, source, followup, phone_number, email
    ) VALUES (
      'pos-walkin-' || gen_random_uuid()::text,
      v_client,
      'POS Walk-in',
      'POS',
      p_actor,
      'Synckerja Order',
      '',
      p_status,
      p_org,
      'POS',
      0,
      v_phone,
      v_email
    ) RETURNING id INTO v_lead;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%pos_checkout_phone_exists%' AND v_phone_key IS NOT NULL THEN
        SELECT l.id INTO v_lead
        FROM public.leads l
        WHERE l.organization_id = p_org
          AND l.phone_number IS NOT NULL
          AND public.normalize_wa_phone_key(l.phone_number) = v_phone_key
        ORDER BY l.updated_at DESC NULLS LAST, l.created_at DESC
        LIMIT 1;
        IF v_lead IS NULL THEN
          RAISE;
        END IF;
      ELSE
        RAISE;
      END IF;
  END;

  RETURN v_lead;
END;
$$;

COMMENT ON FUNCTION public._synckerja_order_ensure_lead(uuid, uuid, uuid, text, text, text) IS
  'Find or create a POS lead for Synckerja Order checkout; reuses phone matches instead of duplicate insert.';

CREATE OR REPLACE FUNCTION public.submit_synckerja_order_create_qris(
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
  v_lead uuid;
  v_st_id uuid;
  v_st_name text := 'Dine In';
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
  SELECT st.id, st.name INTO v_st_id, v_st_name
  FROM public.catalog_sales_types st
  WHERE st.organization_id = v_out.organization_id AND st.is_active AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order LIMIT 1;
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
    'activity', jsonb_build_object(
      'lead_id', v_lead,
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
    'session_id', v_session
  );
END;
$$;

REVOKE ALL ON FUNCTION public._synckerja_order_ensure_lead(uuid, uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._synckerja_order_ensure_lead(uuid, uuid, uuid, text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb, text, text, text) TO anon, authenticated;
