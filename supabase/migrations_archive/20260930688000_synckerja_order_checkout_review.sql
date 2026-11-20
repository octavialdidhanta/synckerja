-- Synckerja Order checkout review: related-menu pairings, named tax/gratuity preview,
-- guest phone/email/bill note on pay-later + QRIS.

ALTER TABLE public.pos_table_sessions
  ADD COLUMN IF NOT EXISTS guest_note text NULL;

COMMENT ON COLUMN public.pos_table_sessions.guest_note IS
  'Optional bill-level note from Synckerja Order checkout (not per-item KDS).';

CREATE TABLE IF NOT EXISTS public.synckerja_order_cross_sell (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  from_category_id uuid NOT NULL REFERENCES public.catalog_product_categories (id) ON DELETE CASCADE,
  to_category_id uuid NOT NULL REFERENCES public.catalog_product_categories (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT synckerja_order_cross_sell_unique UNIQUE (organization_id, from_category_id),
  CONSTRAINT synckerja_order_cross_sell_not_self CHECK (from_category_id <> to_category_id)
);

CREATE INDEX IF NOT EXISTS idx_synckerja_order_cross_sell_org
  ON public.synckerja_order_cross_sell (organization_id);

DROP TRIGGER IF EXISTS update_synckerja_order_cross_sell_updated_at
  ON public.synckerja_order_cross_sell;
CREATE TRIGGER update_synckerja_order_cross_sell_updated_at
  BEFORE UPDATE ON public.synckerja_order_cross_sell
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.synckerja_order_cross_sell ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS synckerja_order_cross_sell_select ON public.synckerja_order_cross_sell;
CREATE POLICY synckerja_order_cross_sell_select
  ON public.synckerja_order_cross_sell FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS synckerja_order_cross_sell_ins ON public.synckerja_order_cross_sell;
CREATE POLICY synckerja_order_cross_sell_ins
  ON public.synckerja_order_cross_sell FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS synckerja_order_cross_sell_upd ON public.synckerja_order_cross_sell;
CREATE POLICY synckerja_order_cross_sell_upd
  ON public.synckerja_order_cross_sell FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS synckerja_order_cross_sell_del ON public.synckerja_order_cross_sell;
CREATE POLICY synckerja_order_cross_sell_del
  ON public.synckerja_order_cross_sell FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE OR REPLACE FUNCTION public._synckerja_order_checkout_totals(p_org uuid, p_subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tax numeric := 0;
  v_grat numeric := 0;
  v_tax_lines jsonb := '[]'::jsonb;
  v_grat_lines jsonb := '[]'::jsonb;
  v_settings public.catalog_checkout_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_settings
  FROM public.catalog_checkout_settings
  WHERE organization_id = p_org;
  IF COALESCE(v_settings.tax_enabled, false) THEN
    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'name', t.name,
          'amount', round(p_subtotal * t.amount_percent / 100.0),
          'amount_percent', t.amount_percent
        )
        ORDER BY t.sort_order, t.name
      ), '[]'::jsonb),
      COALESCE(SUM(round(p_subtotal * t.amount_percent / 100.0)), 0)
    INTO v_tax_lines, v_tax
    FROM public.catalog_taxes t
    WHERE t.organization_id = p_org AND t.is_active = true;
  END IF;
  IF COALESCE(v_settings.gratuity_enabled, false) THEN
    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'name', g.name,
          'amount', round(p_subtotal * g.amount_percent / 100.0),
          'amount_percent', g.amount_percent
        )
        ORDER BY g.sort_order, g.name
      ), '[]'::jsonb),
      COALESCE(SUM(round(p_subtotal * g.amount_percent / 100.0)), 0)
    INTO v_grat_lines, v_grat
    FROM public.catalog_gratuities g
    WHERE g.organization_id = p_org AND g.is_active = true;
  END IF;
  v_tax := round(COALESCE(v_tax, 0));
  v_grat := round(COALESCE(v_grat, 0));
  RETURN jsonb_build_object(
    'subtotal', p_subtotal,
    'taxBase', p_subtotal,
    'taxLines', COALESCE(v_tax_lines, '[]'::jsonb),
    'gratuityLines', COALESCE(v_grat_lines, '[]'::jsonb),
    'taxTotal', v_tax,
    'gratuityTotal', v_grat,
    'grandTotal', p_subtotal + v_tax + v_grat,
    'applicationMethod', COALESCE(v_settings.application_method, 'add')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_checkout_preview(
  p_code text,
  p_subtotal numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_totals jsonb;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  v_totals := public._synckerja_order_checkout_totals(
    v_out.organization_id,
    GREATEST(0, COALESCE(p_subtotal, 0))
  );
  RETURN jsonb_build_object('ok', true) || COALESCE(v_totals, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_checkout_preview(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_checkout_preview(text, numeric) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_catalog(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_items jsonb;
  v_cats jsonb;
  v_st_id uuid;
  v_st_name text := 'Dine In';
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'categories', '[]'::jsonb, 'items', '[]'::jsonb);
  END IF;
  SELECT st.id, st.name INTO v_st_id, v_st_name
  FROM public.catalog_sales_types st
  WHERE st.organization_id = v_out.organization_id
    AND st.is_active = true
    AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(item ORDER BY sort_order, name), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      ci.sort_order,
      dp.name,
      jsonb_build_object(
        'id', dp.id,
        'name', COALESCE(dp.name, 'Item'),
        'description', dp.description,
        'unit_price', COALESCE(dp.unit_price, 0),
        'photo_path', dp.photo_path,
        'product_category_id', dp.product_category_id,
        'product_category_name', c.name,
        'pos_status', COALESCE(cpo.pos_status, dp.pos_status, 'available'),
        'kind', COALESCE(dp.kind, 'product'),
        'service_id', dp.service_id,
        'sub_service_id', dp.sub_service_id,
        'track_stock', COALESCE(dp.track_stock, false),
        'inventory_sku_id', dp.inventory_sku_id,
        'available_qty', NULL,
        'has_modifiers', EXISTS (
          SELECT 1
          FROM public.catalog_product_modifiers cpm
          JOIN public.catalog_modifier_groups g ON g.id = cpm.group_id AND g.is_active
          WHERE cpm.product_id = dp.id
            AND (
              NOT EXISTS (SELECT 1 FROM public.catalog_modifier_outlets mo WHERE mo.group_id = g.id)
              OR EXISTS (
                SELECT 1 FROM public.catalog_modifier_outlets mo
                WHERE mo.group_id = g.id AND mo.outlet_id = ci.outlet_id
              )
            )
        ),
        'variant_count', (
          SELECT count(*)::int FROM public.catalog_product_variants v WHERE v.product_id = dp.id
        ),
        'variants', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price', v.price) ORDER BY v.sort_order)
          FROM public.catalog_product_variants v
          WHERE v.product_id = dp.id
        ), '[]'::jsonb)
      ) AS item
    FROM public.synckerja_order_catalog_items ci
    JOIN public.default_prices dp ON dp.id = ci.catalog_item_id AND dp.organization_id = v_out.organization_id
    JOIN public.catalog_product_outlets cpo
      ON cpo.product_id = dp.id
     AND cpo.outlet_id = ci.outlet_id
     AND cpo.organization_id = v_out.organization_id
    LEFT JOIN public.catalog_product_categories c ON c.id = dp.product_category_id
    WHERE ci.outlet_id = v_out.outlet_id
      AND ci.catalog_item_id IS NOT NULL
      AND COALESCE(cpo.pos_status, dp.pos_status, 'available') <> 'hidden'
    UNION ALL
    SELECT
      ci.sort_order,
      cb.name,
      jsonb_build_object(
        'id', cb.id,
        'name', COALESCE(cb.name, 'Bundle'),
        'description', NULL,
        'unit_price', COALESCE(cb.bundle_price, 0),
        'photo_path', cb.photo_path,
        'product_category_id', NULL,
        'product_category_name', NULL,
        'pos_status', 'available',
        'kind', 'bundle',
        'service_id', NULL,
        'sub_service_id', NULL,
        'track_stock', false,
        'inventory_sku_id', NULL,
        'available_qty', NULL,
        'has_modifiers', false,
        'variant_count', 0,
        'variants', '[]'::jsonb
      ) AS item
    FROM public.synckerja_order_catalog_items ci
    JOIN public.catalog_bundles cb
      ON cb.id = ci.bundle_id
     AND cb.organization_id = v_out.organization_id
     AND cb.is_active
     AND COALESCE(cb.is_deleted, false) = false
    JOIN public.catalog_bundle_outlets cbo
      ON cbo.bundle_id = cb.id
     AND cbo.outlet_id = ci.outlet_id
    WHERE ci.outlet_id = v_out.outlet_id
      AND ci.bundle_id IS NOT NULL
  ) listed;

  SELECT COALESCE(jsonb_agg(cat ORDER BY (cat->>'sort_order')::int, cat->>'name'), '[]'::jsonb)
  INTO v_cats
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'sort_order', c.sort_order,
      'layout', COALESCE(MAX(lay.layout), 'list'),
      'related_category_id', MAX(xs.to_category_id::text)
    ) AS cat
    FROM public.synckerja_order_catalog_items ci
    JOIN public.default_prices dp ON dp.id = ci.catalog_item_id
    JOIN public.catalog_product_outlets cpo
      ON cpo.product_id = dp.id
     AND cpo.outlet_id = ci.outlet_id
    JOIN public.catalog_product_categories c ON c.id = dp.product_category_id
    LEFT JOIN public.synckerja_order_category_layouts lay
      ON lay.outlet_id = ci.outlet_id
     AND lay.category_id = c.id
    LEFT JOIN public.synckerja_order_cross_sell xs
      ON xs.organization_id = v_out.organization_id
     AND xs.from_category_id = c.id
    WHERE ci.outlet_id = v_out.outlet_id
      AND ci.catalog_item_id IS NOT NULL
      AND COALESCE(cpo.pos_status, dp.pos_status, 'available') <> 'hidden'
    GROUP BY c.id, c.name, c.sort_order
  ) grouped_cats;

  RETURN jsonb_build_object(
    'ok', true,
    'categories', COALESCE(v_cats, '[]'::jsonb),
    'items', COALESCE(v_items, '[]'::jsonb),
    'dine_in_sales_type_id', v_st_id,
    'dine_in_sales_type_label', COALESCE(v_st_name, 'Dine In')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_catalog(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.submit_synckerja_order_pay_later(text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.submit_synckerja_order_create_qris(text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.submit_synckerja_order_pay_later(
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
  v_st_id uuid;
  v_st_name text := 'Dine In';
  v_hours jsonb;
  v_phone text;
  v_note text;
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
  v_phone := NULLIF(left(btrim(COALESCE(p_guest_phone, '')), 32), '');
  v_note := NULLIF(left(btrim(COALESCE(p_bill_note, '')), 500), '');
  SELECT st.id, st.name INTO v_st_id, v_st_name
  FROM public.catalog_sales_types st
  WHERE st.organization_id = v_out.organization_id AND st.is_active AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order LIMIT 1;

  IF v_tbl.join_state = 'join' AND v_tbl.open_session_id IS NOT NULL THEN
    UPDATE public.pos_table_sessions
    SET
      cart_snapshot = COALESCE(cart_snapshot, '[]'::jsonb) || v_cart,
      pax = pax + 1,
      customer_name = COALESCE(NULLIF(btrim(customer_name), ''), NULLIF(btrim(COALESCE(p_guest_name, '')), '')),
      customer_phone = COALESCE(NULLIF(btrim(customer_phone), ''), v_phone),
      guest_note = COALESCE(v_note, guest_note)
    WHERE id = v_tbl.open_session_id
      AND organization_id = v_out.organization_id
      AND outlet_id = v_out.outlet_id
      AND status = 'open'
    RETURNING id INTO v_session;
  ELSE
    INSERT INTO public.pos_table_sessions (
      organization_id, outlet_id, group_id, pos_table_id, table_name, pax,
      status, cart_snapshot, customer_name, customer_phone, guest_note
    ) VALUES (
      v_out.organization_id, v_out.outlet_id, v_tbl.group_id, v_tbl.table_id, v_tbl.table_name, 1,
      'open', v_cart, NULLIF(btrim(COALESCE(p_guest_name, '')), ''), v_phone, v_note
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

  INSERT INTO public.leads (
    ticket_id, client, title, category, created_by, created_by_name, assignee,
    status_id, organization_id, source, followup, phone_number, email
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
    0,
    v_phone,
    v_email
  ) RETURNING id INTO v_lead;

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

REVOKE ALL ON FUNCTION public.submit_synckerja_order_pay_later(text, text, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_synckerja_order_pay_later(text, text, text, jsonb, text, text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb, text, text, text) TO anon, authenticated;
