-- Option qty on modifier groups + kitchen notes on Order cart lines.

ALTER TABLE public.catalog_modifier_groups
  ADD COLUMN IF NOT EXISTS option_qty_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.catalog_modifier_groups.option_qty_enabled IS
  'When true, min/max_selected apply to the sum of per-option quantities instead of distinct option count.';

CREATE OR REPLACE FUNCTION public._synckerja_order_sanitize_kitchen_note(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    left(
      btrim(
        regexp_replace(
          regexp_replace(
            regexp_replace(COALESCE(p_raw, ''), '<[^>]*>', '', 'g'),
            '[[:cntrl:]]+',
            ' ',
            'g'
          ),
          '\s+',
          ' ',
          'g'
        )
      ),
      200
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public._synckerja_order_line_modifiers_text(p_line jsonb)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    concat_ws(
      ' · ',
      NULLIF(
        concat_ws(
          ', ',
          NULLIF(btrim(COALESCE(p_line ->> 'variantName', '')), ''),
          (
            SELECT string_agg(txt, ', ' ORDER BY ord)
            FROM (
              SELECT
                CASE
                  WHEN nm IS NULL THEN NULL
                  WHEN GREATEST(1, floor(COALESCE((m ->> 'quantity')::numeric, 1))) > 1
                    THEN nm || ' ×' || GREATEST(1, floor(COALESCE((m ->> 'quantity')::numeric, 1)))::int::text
                  ELSE nm
                END AS txt,
                ord
              FROM jsonb_array_elements(COALESCE(p_line -> 'modifiers', '[]'::jsonb)) WITH ORDINALITY AS t(m, ord)
              CROSS JOIN LATERAL (
                SELECT NULLIF(btrim(COALESCE(m ->> 'name', m ->> 'option_name', '')), '') AS nm
              ) named
            ) labeled
            WHERE txt IS NOT NULL
          )
        ),
        ''
      ),
      CASE
        WHEN public._synckerja_order_sanitize_kitchen_note(
          COALESCE(p_line ->> 'kitchenNote', p_line ->> 'kitchen_note')
        ) IS NULL THEN NULL
        ELSE 'Catatan: ' || public._synckerja_order_sanitize_kitchen_note(
          COALESCE(p_line ->> 'kitchenNote', p_line ->> 'kitchen_note')
        )
      END
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_item_options(
  p_code text,
  p_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_product public.default_prices%ROWTYPE;
  v_bundle public.catalog_bundles%ROWTYPE;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT dp.* INTO v_product
  FROM public.default_prices dp
  JOIN public.synckerja_order_catalog_items ci
    ON ci.catalog_item_id = dp.id
   AND ci.outlet_id = v_out.outlet_id
   AND ci.organization_id = v_out.organization_id
  JOIN public.catalog_product_outlets cpo
    ON cpo.product_id = dp.id
   AND cpo.outlet_id = v_out.outlet_id
  WHERE dp.id = p_item_id
    AND dp.organization_id = v_out.organization_id
    AND COALESCE(cpo.pos_status, dp.pos_status, 'available') <> 'hidden'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'kind', 'product',
      'id', v_product.id,
      'name', COALESCE(v_product.name, 'Item'),
      'description', v_product.description,
      'unit_price', COALESCE(v_product.unit_price, 0),
      'photo_path', v_product.photo_path,
      'variants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', v.id,
          'name', v.name,
          'price', v.price,
          'out_of_stock', COALESCE((
            SELECT vo.in_stock <= 0
            FROM public.catalog_product_variant_outlets vo
            WHERE vo.variant_id = v.id AND vo.outlet_id = v_out.outlet_id
          ), false)
        ) ORDER BY v.sort_order)
        FROM public.catalog_product_variants v
        WHERE v.product_id = v_product.id
      ), '[]'::jsonb),
      'modifier_groups', COALESCE((
        SELECT jsonb_agg(grp.obj ORDER BY grp.sort_order)
        FROM (
          SELECT
            g.sort_order,
            jsonb_build_object(
              'id', g.id,
              'name', g.name,
              'is_required', (g.limit_enabled AND g.is_required),
              'min_selected', CASE
                WHEN g.limit_enabled AND g.is_required THEN LEAST(
                  GREATEST(1, g.max_selected),
                  GREATEST(1, COALESCE(g.min_selected, 1))
                )
                ELSE 0
              END,
              'max_selected', CASE
                WHEN g.limit_enabled THEN GREATEST(1, g.max_selected)
                ELSE GREATEST(1, (
                  SELECT count(*)::int
                  FROM public.catalog_modifier_options o
                  WHERE o.group_id = g.id AND o.is_active
                ))
              END,
              'single_select', (NOT COALESCE(g.option_qty_enabled, false))
                AND g.limit_enabled AND GREATEST(1, g.max_selected) = 1,
              'option_qty_enabled', COALESCE(g.option_qty_enabled, false),
              'options', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', o.id,
                  'name', o.name,
                  'extra_price', COALESCE(o.extra_price, 0),
                  'out_of_stock', public._synckerja_order_modifier_option_oos(v_out.outlet_id, g.id, o.id)
                ) ORDER BY o.sort_order, o.name)
                FROM public.catalog_modifier_options o
                WHERE o.group_id = g.id AND o.is_active
              ), '[]'::jsonb)
            ) AS obj
          FROM public.catalog_product_modifiers cpm
          JOIN public.catalog_modifier_groups g ON g.id = cpm.group_id
          WHERE cpm.product_id = v_product.id
            AND g.is_active
            AND (
              NOT EXISTS (SELECT 1 FROM public.catalog_modifier_outlets mo WHERE mo.group_id = g.id)
              OR EXISTS (
                SELECT 1 FROM public.catalog_modifier_outlets mo
                WHERE mo.group_id = g.id AND mo.outlet_id = v_out.outlet_id
              )
            )
        ) grp
        WHERE jsonb_array_length(COALESCE(grp.obj -> 'options', '[]'::jsonb)) > 0
      ), '[]'::jsonb),
      'included_items', '[]'::jsonb
    );
  END IF;

  SELECT cb.* INTO v_bundle
  FROM public.catalog_bundles cb
  JOIN public.synckerja_order_catalog_items ci
    ON ci.bundle_id = cb.id
   AND ci.outlet_id = v_out.outlet_id
   AND ci.organization_id = v_out.organization_id
  JOIN public.catalog_bundle_outlets cbo
    ON cbo.bundle_id = cb.id
   AND cbo.outlet_id = v_out.outlet_id
  WHERE cb.id = p_item_id
    AND cb.organization_id = v_out.organization_id
    AND cb.is_active
    AND COALESCE(cb.is_deleted, false) = false
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'kind', 'bundle',
    'id', v_bundle.id,
    'name', COALESCE(v_bundle.name, 'Bundle'),
    'description', NULL,
    'unit_price', COALESCE(v_bundle.bundle_price, 0),
    'photo_path', v_bundle.photo_path,
    'variants', '[]'::jsonb,
    'modifier_groups', '[]'::jsonb,
    'included_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', COALESCE(dp.name, 'Item'),
        'quantity', bi.quantity
      ) ORDER BY bi.sort_order)
      FROM public.catalog_bundle_items bi
      JOIN public.default_prices dp ON dp.id = bi.product_id
      WHERE bi.bundle_id = v_bundle.id
    ), '[]'::jsonb)
  );
END;
$$;

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
  v_mod_qty jsonb;
  v_opt_qty int;
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
  v_note text;
BEGIN
  IF p_cart IS NULL OR jsonb_typeof(p_cart) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_cart)
  LOOP
    v_qty := GREATEST(1, floor(COALESCE((v_line ->> 'quantity')::numeric, 1)));
    v_kind := COALESCE(NULLIF(v_line ->> 'kind', ''), 'product');
    v_note := public._synckerja_order_sanitize_kitchen_note(
      COALESCE(v_line ->> 'kitchenNote', v_line ->> 'kitchen_note')
    );
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
          'modifiers', '[]'::jsonb,
          'kitchenNote', to_jsonb(v_note)
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

    v_mod_qty := '{}'::jsonb;
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
      BEGIN
        v_opt_qty := GREATEST(0, floor(COALESCE((v_mod ->> 'quantity')::numeric, 1))::int);
      EXCEPTION WHEN others THEN
        v_opt_qty := 1;
      END;
      IF v_opt_qty < 1 THEN
        CONTINUE;
      END IF;
      v_mod_qty := v_mod_qty || jsonb_build_object(v_opt_id::text, v_opt_qty);
    END LOOP;
    IF v_skip THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(v_mod_qty) AS oid
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.catalog_product_modifiers cpm
        JOIN public.catalog_modifier_options o
          ON o.group_id = cpm.group_id
         AND o.id::text = oid
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
        COALESCE(g.option_qty_enabled, false) AS option_qty_enabled,
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

      IF v_group.option_qty_enabled THEN
        SELECT COALESCE(SUM(GREATEST(0, (v_mod_qty ->> o.id::text)::int)), 0)::int
        INTO v_count
        FROM public.catalog_modifier_options o
        WHERE o.group_id = v_group.id AND o.is_active;
      ELSE
        SELECT count(*)::int INTO v_count
        FROM public.catalog_modifier_options o
        WHERE o.group_id = v_group.id
          AND o.is_active
          AND v_mod_qty ? o.id::text;
      END IF;

      IF v_count < v_min OR v_count > v_max THEN
        v_skip := true;
        EXIT;
      END IF;

      FOR v_opt_id IN
        SELECT o.id
        FROM public.catalog_modifier_options o
        WHERE o.group_id = v_group.id
          AND o.is_active
          AND v_mod_qty ? o.id::text
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
        IF v_group.option_qty_enabled THEN
          v_opt_qty := GREATEST(1, COALESCE((v_mod_qty ->> v_opt_id::text)::int, 1));
        ELSE
          v_opt_qty := 1;
        END IF;
        v_extras := v_extras + COALESCE(v_opt_extra, 0) * v_opt_qty;
        v_group_name := v_group.name;
        v_resolved := v_resolved || jsonb_build_array(
          jsonb_build_object(
            'optionId', v_opt_id,
            'name', v_opt_name,
            'extraPrice', v_opt_extra,
            'quantity', v_opt_qty,
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
        'modifiers', v_resolved,
        'kitchenNote', to_jsonb(v_note)
      )
    );
  END LOOP;
  RETURN v_out;
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

REVOKE ALL ON FUNCTION public._synckerja_order_sanitize_kitchen_note(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_line_modifiers_text(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_sanitize_cart(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_synckerja_order_item_options(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_item_options(text, uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_synckerja_order_create_qris(text, text, text, jsonb) TO anon, authenticated;
