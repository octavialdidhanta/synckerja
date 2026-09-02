-- Synckerja Order: per-outlet weekly hours + store_closed gate on guest checkout.

CREATE OR REPLACE FUNCTION public._synckerja_order_default_weekly_hours()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('dow', 1, 'closed', false, 'open', '11:00', 'close', '22:00'),
    jsonb_build_object('dow', 2, 'closed', false, 'open', '11:00', 'close', '22:00'),
    jsonb_build_object('dow', 3, 'closed', false, 'open', '11:00', 'close', '22:00'),
    jsonb_build_object('dow', 4, 'closed', false, 'open', '11:00', 'close', '22:00'),
    jsonb_build_object('dow', 5, 'closed', false, 'open', '11:00', 'close', '22:00'),
    jsonb_build_object('dow', 6, 'closed', false, 'open', '11:00', 'close', '22:00'),
    jsonb_build_object('dow', 7, 'closed', false, 'open', '11:00', 'close', '22:00')
  );
$$;

ALTER TABLE public.synckerja_order_outlet_settings
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Jakarta';

ALTER TABLE public.synckerja_order_outlet_settings
  ADD COLUMN IF NOT EXISTS force_closed boolean NOT NULL DEFAULT false;

ALTER TABLE public.synckerja_order_outlet_settings
  ADD COLUMN IF NOT EXISTS weekly_hours jsonb NOT NULL DEFAULT public._synckerja_order_default_weekly_hours();

UPDATE public.synckerja_order_outlet_settings
SET weekly_hours = public._synckerja_order_default_weekly_hours()
WHERE weekly_hours IS NULL OR jsonb_typeof(weekly_hours) <> 'array' OR jsonb_array_length(weekly_hours) = 0;

CREATE OR REPLACE FUNCTION public._synckerja_order_hhmm_minutes(p_value text)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_h int;
  v_m int;
BEGIN
  IF p_value IS NULL OR p_value !~ '^\d{1,2}:\d{2}$' THEN
    RETURN 0;
  END IF;
  v_h := GREATEST(0, LEAST(23, split_part(p_value, ':', 1)::int));
  v_m := GREATEST(0, LEAST(59, split_part(p_value, ':', 2)::int));
  RETURN v_h * 60 + v_m;
END;
$$;

CREATE OR REPLACE FUNCTION public._synckerja_order_hour_rule(p_hours jsonb, p_dow int)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT elem
      FROM jsonb_array_elements(COALESCE(p_hours, public._synckerja_order_default_weekly_hours())) elem
      WHERE (elem ->> 'dow')::int = p_dow
      LIMIT 1
    ),
    jsonb_build_object('dow', p_dow, 'closed', false, 'open', '11:00', 'close', '22:00')
  );
$$;

CREATE OR REPLACE FUNCTION public._synckerja_order_hours_state(p_outlet uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_force boolean := false;
  v_hours jsonb := public._synckerja_order_default_weekly_hours();
  v_now timestamp;
  v_dow int;
  v_mins int;
  v_today jsonb;
  v_yest jsonb;
  v_open boolean := false;
  v_from_yest boolean := false;
  v_open_m int;
  v_close_m int;
  v_y_open_m int;
  v_y_close_m int;
  v_open_hhmm text;
  v_close_hhmm text;
  v_next_dow int;
  v_next_hhmm text;
  v_next_today boolean := false;
  v_offset int;
  v_cursor int;
  v_rule jsonb;
  v_tz text := 'Asia/Jakarta';
BEGIN
  SELECT
    COALESCE(force_closed, false),
    COALESCE(weekly_hours, public._synckerja_order_default_weekly_hours()),
    COALESCE(NULLIF(timezone, ''), 'Asia/Jakarta')
  INTO v_force, v_hours, v_tz
  FROM public.synckerja_order_outlet_settings
  WHERE outlet_id = p_outlet;

  v_now := timezone(v_tz, now());
  v_dow := EXTRACT(ISODOW FROM v_now)::int;
  v_mins := EXTRACT(HOUR FROM v_now)::int * 60 + EXTRACT(MINUTE FROM v_now)::int;
  v_today := public._synckerja_order_hour_rule(v_hours, v_dow);
  v_yest := public._synckerja_order_hour_rule(v_hours, CASE WHEN v_dow = 1 THEN 7 ELSE v_dow - 1 END);

  IF v_force THEN
    v_open := false;
  ELSE
    v_open_m := public._synckerja_order_hhmm_minutes(v_today ->> 'open');
    v_close_m := public._synckerja_order_hhmm_minutes(v_today ->> 'close');
    v_y_open_m := public._synckerja_order_hhmm_minutes(v_yest ->> 'open');
    v_y_close_m := public._synckerja_order_hhmm_minutes(v_yest ->> 'close');

    IF NOT COALESCE((v_today ->> 'closed')::boolean, false) THEN
      IF v_close_m = v_open_m THEN
        v_open := true;
      ELSIF v_close_m > v_open_m THEN
        v_open := v_mins >= v_open_m AND v_mins < v_close_m;
      ELSE
        v_open := v_mins >= v_open_m;
      END IF;
    END IF;

    IF NOT v_open
      AND NOT COALESCE((v_yest ->> 'closed')::boolean, false)
      AND v_y_close_m < v_y_open_m
      AND v_mins < v_y_close_m
    THEN
      v_open := true;
      v_from_yest := true;
    END IF;
  END IF;

  IF v_open THEN
    IF v_from_yest THEN
      v_open_hhmm := v_yest ->> 'open';
      v_close_hhmm := v_yest ->> 'close';
    ELSE
      v_open_hhmm := v_today ->> 'open';
      v_close_hhmm := v_today ->> 'close';
    END IF;
    RETURN jsonb_build_object(
      'is_open', true,
      'force_closed', v_force,
      'open_hhmm', v_open_hhmm,
      'close_hhmm', v_close_hhmm,
      'next_open_hhmm', NULL,
      'next_open_is_today', false,
      'next_open_dow', NULL,
      'next_open_at', NULL,
      'closes_at', (
        CASE
          WHEN v_from_yest THEN (date_trunc('day', v_now) + make_interval(mins => public._synckerja_order_hhmm_minutes(v_close_hhmm)))
          WHEN public._synckerja_order_hhmm_minutes(v_close_hhmm) < public._synckerja_order_hhmm_minutes(v_open_hhmm)
            THEN (date_trunc('day', v_now) + interval '1 day' + make_interval(mins => public._synckerja_order_hhmm_minutes(v_close_hhmm)))
          ELSE (date_trunc('day', v_now) + make_interval(mins => public._synckerja_order_hhmm_minutes(v_close_hhmm)))
        END
      ) AT TIME ZONE v_tz
    );
  END IF;

  IF NOT v_force AND NOT COALESCE((v_today ->> 'closed')::boolean, false)
    AND v_mins < public._synckerja_order_hhmm_minutes(v_today ->> 'open')
  THEN
    v_next_dow := v_dow;
    v_next_hhmm := v_today ->> 'open';
    v_next_today := true;
    v_offset := 0;
  ELSE
    v_next_dow := NULL;
    FOR v_offset IN 1..7 LOOP
      v_cursor := ((v_dow - 1 + v_offset) % 7) + 1;
      v_rule := public._synckerja_order_hour_rule(v_hours, v_cursor);
      IF NOT COALESCE((v_rule ->> 'closed')::boolean, false) THEN
        v_next_dow := v_cursor;
        v_next_hhmm := v_rule ->> 'open';
        EXIT;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'is_open', false,
    'force_closed', v_force,
    'open_hhmm', NULL,
    'close_hhmm', NULL,
    'next_open_hhmm', v_next_hhmm,
    'next_open_is_today', v_next_today,
    'next_open_dow', v_next_dow,
    'next_open_at', CASE
      WHEN v_next_hhmm IS NULL THEN NULL
      ELSE (
        date_trunc('day', v_now)
        + make_interval(days => COALESCE(v_offset, 0))
        + make_interval(mins => public._synckerja_order_hhmm_minutes(v_next_hhmm))
      ) AT TIME ZONE v_tz
    END,
    'closes_at', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public._synckerja_order_default_weekly_hours() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_hhmm_minutes(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_hour_rule(jsonb, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_hours_state(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_store(
  p_code text,
  p_table_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_org public.synckerja_order_org_settings%ROWTYPE;
  v_tbl record;
  v_hours jsonb;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT * INTO v_org FROM public.synckerja_order_org_settings WHERE organization_id = v_out.organization_id;
  v_hours := public._synckerja_order_hours_state(v_out.outlet_id);
  IF p_table_name IS NOT NULL AND btrim(p_table_name) <> '' THEN
    SELECT * INTO v_tbl FROM public._synckerja_order_table_state(v_out.organization_id, v_out.outlet_id, p_table_name);
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'public_code', v_out.public_code,
        'outlet_id', v_out.outlet_id,
        'outlet_name', v_out.outlet_name,
        'business_name', COALESCE(NULLIF(v_org.business_name, ''), v_out.outlet_name),
        'logo_path', v_org.logo_path,
        'cover_path', v_org.cover_path,
        'pickup_enabled', v_org.pickup_enabled,
        'is_open', COALESCE((v_hours ->> 'is_open')::boolean, false),
        'hours', v_hours,
        'table', NULL,
        'table_error', 'not_found'
      );
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'public_code', v_out.public_code,
    'outlet_id', v_out.outlet_id,
    'outlet_name', v_out.outlet_name,
    'business_name', COALESCE(NULLIF(v_org.business_name, ''), v_out.outlet_name),
    'logo_path', v_org.logo_path,
    'cover_path', v_org.cover_path,
    'pickup_enabled', v_org.pickup_enabled,
    'is_open', COALESCE((v_hours ->> 'is_open')::boolean, false),
    'hours', v_hours,
    'table', CASE WHEN v_tbl.table_id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_tbl.table_id,
      'name', v_tbl.table_name,
      'pax', v_tbl.table_pax,
      'remaining_pax', v_tbl.remaining_pax,
      'join', v_tbl.join_state,
      'session_id', v_tbl.open_session_id
    ) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_synckerja_order_pay_later(
  p_code text,
  p_table_name text,
  p_guest_name text,
  p_cart jsonb
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
  v_st_id uuid;
  v_st_name text := 'Dine In';
  v_hours jsonb;
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
  SELECT st.id, st.name INTO v_st_id, v_st_name
  FROM public.catalog_sales_types st
  WHERE st.organization_id = v_out.organization_id AND st.is_active AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order LIMIT 1;

  IF v_tbl.join_state = 'join' AND v_tbl.open_session_id IS NOT NULL THEN
    UPDATE public.pos_table_sessions
    SET
      cart_snapshot = COALESCE(cart_snapshot, '[]'::jsonb) || v_cart,
      pax = pax + 1,
      customer_name = COALESCE(NULLIF(btrim(customer_name), ''), NULLIF(btrim(COALESCE(p_guest_name, '')), ''))
    WHERE id = v_tbl.open_session_id
      AND organization_id = v_out.organization_id
      AND outlet_id = v_out.outlet_id
      AND status = 'open'
    RETURNING id INTO v_session;
  ELSE
    INSERT INTO public.pos_table_sessions (
      organization_id, outlet_id, group_id, pos_table_id, table_name, pax,
      status, cart_snapshot, customer_name
    ) VALUES (
      v_out.organization_id, v_out.outlet_id, v_tbl.group_id, v_tbl.table_id, v_tbl.table_name, 1,
      'open', v_cart, NULLIF(btrim(COALESCE(p_guest_name, '')), '')
    ) RETURNING id INTO v_session;
  END IF;

  PERFORM public._synckerja_order_fire_kitchen(
    v_out.organization_id, v_out.outlet_id, v_session, v_tbl.table_id, v_tbl.table_name,
    p_guest_name, v_cart, 'save_bill', COALESCE(v_st_name, 'Dine In'), v_st_id
  );
  RETURN jsonb_build_object('ok', true, 'session_id', v_session);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_synckerja_order_create_qris(
  p_code text,
  p_table_name text,
  p_guest_name text,
  p_cart jsonb
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
  v_line jsonb;
  v_status uuid;
  v_hours jsonb;
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
  SELECT st.id, st.name INTO v_st_id, v_st_name
  FROM public.catalog_sales_types st
  WHERE st.organization_id = v_out.organization_id AND st.is_active AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order LIMIT 1;
  SELECT id INTO v_status FROM public.lead_statuses
  WHERE organization_id = v_out.organization_id OR organization_id IS NULL
  ORDER BY sort_order ASC LIMIT 1;

  INSERT INTO public.leads (
    ticket_id, client, title, category, created_by, created_by_name, assignee,
    status_id, organization_id, source, followup
  ) VALUES (
    'pos-walkin-' || gen_random_uuid()::text,
    v_client,
    'POS Walk-in',
    'POS',
    v_actor,
    'Synckerja Order',
    '',
    v_status,
    v_out.organization_id,
    'POS',
    0
  ) RETURNING id INTO v_lead;

  IF v_tbl.join_state = 'join' AND v_tbl.open_session_id IS NOT NULL THEN
    v_session := v_tbl.open_session_id;
    UPDATE public.pos_table_sessions
    SET pax = pax + 1,
        customer_name = COALESCE(NULLIF(btrim(customer_name), ''), NULLIF(v_client, 'Walk-in'))
    WHERE id = v_session AND status = 'open';
  ELSE
    INSERT INTO public.pos_table_sessions (
      organization_id, outlet_id, group_id, pos_table_id, table_name, pax,
      status, cart_snapshot, customer_name
    ) VALUES (
      v_out.organization_id, v_out.outlet_id, v_tbl.group_id, v_tbl.table_id, v_tbl.table_name, 1,
      'open', '[]'::jsonb, NULLIF(v_client, 'Walk-in')
    ) RETURNING id INTO v_session;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_cart)
  LOOP
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'service_id', v_line -> 'serviceId',
      'sub_service_id', v_line -> 'subServiceId',
      'service_name', v_line ->> 'serviceName',
      'sub_service_name', v_line -> 'subServiceName',
      'quantity', (v_line ->> 'quantity')::numeric,
      'unit_price', (v_line ->> 'unitPrice')::numeric,
      'total_price', (v_line ->> 'quantity')::numeric * (v_line ->> 'unitPrice')::numeric,
      'notes', NULL,
      'item_kind', 'product',
      'inventory_sku_id', v_line -> 'inventorySkuId',
      'track_stock', COALESCE((v_line ->> 'trackStock')::boolean, false),
      'catalog_product_id', v_line ->> 'catalogId',
      'catalog_variant_id', v_line -> 'variantId',
      'catalog_bundle_id', NULL,
      'catalog_sales_type_id', v_st_id,
      'unit_cogs', NULL,
      'cogs_source', 'none'
    ));
  END LOOP;

  v_payload := jsonb_build_object(
    'activity', jsonb_build_object(
      'lead_id', v_lead,
      'client_name', v_client,
      'client_phone', NULL,
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
      'description', 'Synckerja Order'
    ),
    'items', v_items,
    'modifiers', '[]'::jsonb,
    'discounts', '[]'::jsonb,
    'catalogStockLines', '[]'::jsonb,
    'checkoutTotals', v_totals,
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

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_store(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_store(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_synckerja_order_pay_later(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_synckerja_order_pay_later(text, text, text, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb) TO anon, authenticated;
