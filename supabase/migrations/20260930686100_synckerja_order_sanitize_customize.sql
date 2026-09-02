-- Reprice variant + modifiers on public cart; kitchen text; QRIS modifier payload.

CREATE OR REPLACE FUNCTION public._synckerja_order_sanitize_cart(
  p_org uuid,
  p_outlet uuid,
  p_cart jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line jsonb;
  v_out jsonb := '[]'::jsonb;
  v_item public.default_prices%ROWTYPE;
  v_bundle public.catalog_bundles%ROWTYPE;
  v_qty numeric;
  v_price numeric;
  v_name text;
  v_kind text;
  v_id uuid;
  v_variant_id uuid;
  v_variant_name text;
  v_variant_count int;
  v_skip boolean;
  v_mod jsonb;
  v_opt_id uuid;
  v_selected uuid[];
  v_group record;
  v_count int;
  v_min int;
  v_max int;
  v_extras numeric;
  v_resolved jsonb;
  v_opt_name text;
  v_opt_extra numeric;
  v_group_name text;
  v_unknown boolean;
BEGIN
  IF p_cart IS NULL OR jsonb_typeof(p_cart) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_cart)
  LOOP
    v_qty := GREATEST(1, floor(COALESCE((v_line ->> 'quantity')::numeric, 1)));
    v_kind := COALESCE(NULLIF(v_line ->> 'kind', ''), 'product');
    BEGIN
      v_id := NULLIF(v_line ->> 'catalogId', '')::uuid;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
    IF v_id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_kind = 'bundle' THEN
      SELECT cb.* INTO v_bundle
      FROM public.catalog_bundles cb
      JOIN public.synckerja_order_catalog_items ci
        ON ci.bundle_id = cb.id
       AND ci.outlet_id = p_outlet
       AND ci.organization_id = p_org
      JOIN public.catalog_bundle_outlets cbo
        ON cbo.bundle_id = cb.id
       AND cbo.outlet_id = p_outlet
      WHERE cb.id = v_id
        AND cb.organization_id = p_org
        AND cb.is_active
        AND COALESCE(cb.is_deleted, false) = false
      LIMIT 1;
      IF NOT FOUND THEN
        CONTINUE;
      END IF;
      v_out := v_out || jsonb_build_array(
        jsonb_build_object(
          'lineKey', COALESCE(NULLIF(v_line ->> 'lineKey', ''), 'plain:' || v_bundle.id::text),
          'catalogId', v_bundle.id,
          'kind', 'bundle',
          'serviceId', NULL,
          'subServiceId', NULL,
          'serviceName', COALESCE(NULLIF(v_bundle.name, ''), COALESCE(v_line ->> 'serviceName', 'Bundle')),
          'subServiceName', NULL,
          'quantity', v_qty,
          'unitPrice', COALESCE(v_bundle.bundle_price, 0),
          'trackStock', false,
          'inventorySkuId', NULL,
          'availableQty', NULL,
          'productCategoryId', NULL,
          'variantId', NULL,
          'variantName', NULL,
          'modifiers', '[]'::jsonb
        )
      );
      CONTINUE;
    END IF;

    SELECT dp.* INTO v_item
    FROM public.default_prices dp
    JOIN public.synckerja_order_catalog_items ci
      ON ci.catalog_item_id = dp.id
     AND ci.outlet_id = p_outlet
     AND ci.organization_id = p_org
    JOIN public.catalog_product_outlets cpo
      ON cpo.product_id = dp.id
     AND cpo.outlet_id = p_outlet
     AND cpo.organization_id = p_org
    WHERE dp.id = v_id
      AND dp.organization_id = p_org
      AND COALESCE(cpo.pos_status, dp.pos_status, 'available') <> 'hidden'
    LIMIT 1;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT count(*)::int INTO v_variant_count
    FROM public.catalog_product_variants v
    WHERE v.product_id = v_item.id;

    v_variant_id := NULL;
    v_variant_name := NULL;
    v_price := COALESCE(v_item.unit_price, 0);
    BEGIN
      v_variant_id := NULLIF(v_line ->> 'variantId', '')::uuid;
    EXCEPTION WHEN others THEN
      v_variant_id := NULL;
    END;

    IF v_variant_count > 0 THEN
      IF v_variant_id IS NOT NULL THEN
        SELECT v.name, v.price INTO v_variant_name, v_price
        FROM public.catalog_product_variants v
        WHERE v.product_id = v_item.id AND v.id = v_variant_id
        LIMIT 1;
        IF NOT FOUND THEN
          CONTINUE;
        END IF;
      ELSIF v_variant_count = 1 THEN
        SELECT v.id, v.name, v.price INTO v_variant_id, v_variant_name, v_price
        FROM public.catalog_product_variants v
        WHERE v.product_id = v_item.id
        ORDER BY v.sort_order
        LIMIT 1;
      ELSE
        CONTINUE;
      END IF;
    ELSE
      v_variant_id := NULL;
      v_variant_name := NULL;
    END IF;

    v_selected := ARRAY[]::uuid[];
    v_skip := false;
    FOR v_mod IN SELECT value FROM jsonb_array_elements(COALESCE(v_line -> 'modifiers', '[]'::jsonb))
    LOOP
      BEGIN
        v_opt_id := COALESCE(NULLIF(v_mod ->> 'optionId', ''), NULLIF(v_mod ->> 'option_id', ''))::uuid;
      EXCEPTION WHEN others THEN
        v_skip := true;
        EXIT;
      END;
      IF v_opt_id IS NULL THEN
        CONTINUE;
      END IF;
      v_selected := array_append(v_selected, v_opt_id);
    END LOOP;
    IF v_skip THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM unnest(v_selected) AS oid
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.catalog_product_modifiers cpm
        JOIN public.catalog_modifier_options o
          ON o.group_id = cpm.group_id
         AND o.id = oid
         AND o.is_active
        JOIN public.catalog_modifier_groups g ON g.id = cpm.group_id AND g.is_active
        WHERE cpm.product_id = v_item.id
          AND (
            NOT EXISTS (SELECT 1 FROM public.catalog_modifier_outlets mo WHERE mo.group_id = g.id)
            OR EXISTS (
              SELECT 1 FROM public.catalog_modifier_outlets mo
              WHERE mo.group_id = g.id AND mo.outlet_id = p_outlet
            )
          )
      )
    ) INTO v_unknown;
    IF COALESCE(v_unknown, false) THEN
      CONTINUE;
    END IF;

    v_resolved := '[]'::jsonb;
    v_extras := 0;
    v_skip := false;
    FOR v_group IN
      SELECT
        g.id,
        g.name,
        g.limit_enabled,
        g.is_required,
        g.min_selected,
        g.max_selected,
        (
          SELECT count(*)::int
          FROM public.catalog_modifier_options o
          WHERE o.group_id = g.id AND o.is_active
        ) AS option_count
      FROM public.catalog_product_modifiers cpm
      JOIN public.catalog_modifier_groups g ON g.id = cpm.group_id
      WHERE cpm.product_id = v_item.id
        AND g.is_active
        AND (
          NOT EXISTS (SELECT 1 FROM public.catalog_modifier_outlets mo WHERE mo.group_id = g.id)
          OR EXISTS (
            SELECT 1 FROM public.catalog_modifier_outlets mo
            WHERE mo.group_id = g.id AND mo.outlet_id = p_outlet
          )
        )
    LOOP
      IF v_group.limit_enabled THEN
        v_max := GREATEST(1, COALESCE(v_group.max_selected, 1));
        IF v_group.is_required THEN
          v_min := LEAST(v_max, GREATEST(1, COALESCE(v_group.min_selected, 1)));
        ELSE
          v_min := 0;
        END IF;
      ELSE
        v_min := 0;
        v_max := GREATEST(1, COALESCE(v_group.option_count, 1));
      END IF;
      SELECT count(*)::int INTO v_count
      FROM public.catalog_modifier_options o
      WHERE o.group_id = v_group.id
        AND o.is_active
        AND o.id = ANY (v_selected);
      IF v_count < v_min OR v_count > v_max THEN
        v_skip := true;
        EXIT;
      END IF;
      FOR v_opt_id IN
        SELECT o.id
        FROM public.catalog_modifier_options o
        WHERE o.group_id = v_group.id
          AND o.is_active
          AND o.id = ANY (v_selected)
        ORDER BY o.sort_order, o.name
      LOOP
        IF public._synckerja_order_modifier_option_oos(p_outlet, v_group.id, v_opt_id) THEN
          v_skip := true;
          EXIT;
        END IF;
        SELECT o.name, COALESCE(o.extra_price, 0)
        INTO v_opt_name, v_opt_extra
        FROM public.catalog_modifier_options o
        WHERE o.id = v_opt_id;
        v_extras := v_extras + COALESCE(v_opt_extra, 0);
        v_group_name := v_group.name;
        v_resolved := v_resolved || jsonb_build_array(
          jsonb_build_object(
            'optionId', v_opt_id,
            'name', v_opt_name,
            'extraPrice', v_opt_extra,
            'groupName', v_group_name
          )
        );
      END LOOP;
      EXIT WHEN v_skip;
    END LOOP;
    IF v_skip THEN
      CONTINUE;
    END IF;

    v_price := GREATEST(0, COALESCE(v_price, 0) + COALESCE(v_extras, 0));
    v_name := COALESCE(NULLIF(v_item.name, ''), COALESCE(v_line ->> 'serviceName', 'Item'));
    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'lineKey', COALESCE(NULLIF(v_line ->> 'lineKey', ''), 'plain:' || v_item.id::text),
        'catalogId', v_item.id,
        'kind', COALESCE(NULLIF(v_item.kind, ''), 'product'),
        'serviceId', v_item.service_id,
        'subServiceId', v_item.sub_service_id,
        'serviceName', v_name,
        'subServiceName', v_line -> 'subServiceName',
        'quantity', v_qty,
        'unitPrice', v_price,
        'trackStock', COALESCE(v_item.track_stock, false),
        'inventorySkuId', v_item.inventory_sku_id,
        'availableQty', NULL,
        'productCategoryId', v_item.product_category_id,
        'variantId', v_variant_id,
        'variantName', v_variant_name,
        'modifiers', v_resolved
      )
    );
  END LOOP;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public._synckerja_order_fire_kitchen(
  p_org uuid,
  p_outlet uuid,
  p_session uuid,
  p_table_id uuid,
  p_table_name text,
  p_customer_name text,
  p_cart jsonb,
  p_event text,
  p_sales_type_label text,
  p_sales_type_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy text;
  v_should boolean := false;
  v_had boolean := false;
  v_ticket uuid;
  v_line jsonb;
  v_sort int := 0;
BEGIN
  SELECT COALESCE(kitchen_fire_by_sales_type ->> 'dine_in', 'save_bill')
  INTO v_policy
  FROM public.pos_kitchen_outlet_settings
  WHERE organization_id = p_org AND outlet_id = p_outlet
  LIMIT 1;
  v_policy := COALESCE(v_policy, 'save_bill');

  SELECT EXISTS (
    SELECT 1 FROM public.pos_kitchen_tickets t
    WHERE t.session_id = p_session AND t.status IN ('new', 'in_progress', 'ready', 'done')
  ) INTO v_had;

  IF p_event = 'save_bill' THEN
    v_should := (v_policy = 'save_bill');
  ELSIF p_event = 'on_pay' THEN
    v_should := (v_policy = 'on_pay') OR (v_policy = 'save_bill' AND NOT v_had);
  END IF;
  IF NOT v_should THEN
    RETURN;
  END IF;
  IF jsonb_array_length(COALESCE(p_cart, '[]'::jsonb)) < 1 THEN
    RETURN;
  END IF;

  INSERT INTO public.pos_kitchen_tickets (
    organization_id, outlet_id, session_id, pos_table_id, table_name,
    customer_name, sales_type_id, sales_type_label, status
  ) VALUES (
    p_org, p_outlet, p_session, p_table_id, COALESCE(NULLIF(btrim(p_table_name), ''), 'Walk-in'),
    NULLIF(btrim(COALESCE(p_customer_name, '')), ''), p_sales_type_id, p_sales_type_label, 'new'
  ) RETURNING id INTO v_ticket;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_cart)
  LOOP
    IF COALESCE(v_line ->> 'kind', 'product') <> 'product' THEN
      CONTINUE;
    END IF;
    v_sort := v_sort + 1;
    INSERT INTO public.pos_kitchen_ticket_lines (
      ticket_id, line_fingerprint, display_name, modifiers_text, quantity, sort_index
    ) VALUES (
      v_ticket,
      COALESCE(NULLIF(v_line ->> 'lineKey', ''), 'plain:' || COALESCE(v_line ->> 'catalogId', '')),
      COALESCE(NULLIF(v_line ->> 'serviceName', ''), 'Item'),
      public._synckerja_order_line_modifiers_text(v_line),
      GREATEST(1, floor(COALESCE((v_line ->> 'quantity')::numeric, 1))::int),
      v_sort
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._synckerja_order_sanitize_cart(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_fire_kitchen(uuid, uuid, uuid, uuid, text, text, jsonb, text, text, uuid) FROM PUBLIC;
