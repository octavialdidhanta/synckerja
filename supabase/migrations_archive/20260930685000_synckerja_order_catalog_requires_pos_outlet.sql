-- Storefront catalog and cart require POS outlet assignment + Order opt-in.
-- Hidden (master or outlet override) is excluded. sold_out still returns.

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
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
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
    'variants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price', v.price) ORDER BY v.sort_order)
      FROM public.catalog_product_variants v
      WHERE v.product_id = dp.id
    ), '[]'::jsonb)
  ) ORDER BY ci.sort_order, dp.name), '[]'::jsonb)
  INTO v_items
  FROM public.synckerja_order_catalog_items ci
  JOIN public.default_prices dp ON dp.id = ci.catalog_item_id AND dp.organization_id = v_out.organization_id
  JOIN public.catalog_product_outlets cpo
    ON cpo.product_id = dp.id
   AND cpo.outlet_id = ci.outlet_id
   AND cpo.organization_id = v_out.organization_id
  LEFT JOIN public.catalog_product_categories c ON c.id = dp.product_category_id
  WHERE ci.outlet_id = v_out.outlet_id
    AND COALESCE(cpo.pos_status, dp.pos_status, 'available') <> 'hidden';

  SELECT COALESCE(jsonb_agg(cat ORDER BY (cat->>'sort_order')::int, cat->>'name'), '[]'::jsonb)
  INTO v_cats
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'sort_order', c.sort_order,
      'layout', COALESCE(MAX(lay.layout), 'list')
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
    WHERE ci.outlet_id = v_out.outlet_id
      AND COALESCE(cpo.pos_status, dp.pos_status, 'available') <> 'hidden'
    GROUP BY c.id, c.name, c.sort_order
  ) grouped_cats;

  RETURN jsonb_build_object(
    'ok', true,
    'categories', COALESCE(v_cats, '[]'::jsonb),
    'items', v_items,
    'dine_in_sales_type_id', v_st_id,
    'dine_in_sales_type_label', COALESCE(v_st_name, 'Dine In')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_catalog(text) TO anon, authenticated;

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
  v_qty numeric;
  v_price numeric;
  v_name text;
BEGIN
  IF p_cart IS NULL OR jsonb_typeof(p_cart) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_cart)
  LOOP
    v_qty := GREATEST(1, floor(COALESCE((v_line ->> 'quantity')::numeric, 1)));
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
    WHERE dp.id = NULLIF(v_line ->> 'catalogId', '')::uuid
      AND dp.organization_id = p_org
      AND COALESCE(cpo.pos_status, dp.pos_status, 'available') <> 'hidden'
    LIMIT 1;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    v_price := COALESCE(v_item.unit_price, 0);
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
        'variantId', NULLIF(v_line ->> 'variantId', ''),
        'variantName', NULLIF(v_line ->> 'variantName', '')
      )
    );
  END LOOP;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public._synckerja_order_sanitize_cart(uuid, uuid, jsonb) FROM PUBLIC;
