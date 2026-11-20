-- One-time migration: copy org-wide inventory_skus qty into default-outlet catalog stock.

CREATE OR REPLACE FUNCTION public.migrate_legacy_sku_to_catalog_stock(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet uuid;
  v_migrated integer := 0;
  v_skipped integer := 0;
  v_rec record;
  v_sku_qty numeric(14, 3);
  v_current numeric(14, 3);
  v_delta numeric(14, 3);
  v_already boolean;
  v_has_variants boolean;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;

  SELECT id
    INTO v_outlet
  FROM public.pos_outlets
  WHERE organization_id = p_organization_id
    AND is_deleted = false
    AND is_active = true
  ORDER BY is_default DESC, sort_order, created_at
  LIMIT 1;

  IF v_outlet IS NULL THEN
    RETURN jsonb_build_object('error', 'catalog_stock_outlet_required', 'migrated', 0, 'skipped', 0);
  END IF;

  FOR v_rec IN
    SELECT dp.id AS product_id, dp.inventory_sku_id
    FROM public.default_prices dp
    WHERE dp.organization_id = p_organization_id
      AND dp.kind = 'product'
      AND dp.track_stock = true
      AND dp.inventory_sku_id IS NOT NULL
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.catalog_product_variants v
      WHERE v.product_id = v_rec.product_id
    )
    INTO v_has_variants;

    IF v_has_variants THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.catalog_stock_movements m
      WHERE m.organization_id = p_organization_id
        AND m.outlet_id = v_outlet
        AND m.item_kind = 'product'
        AND m.product_id = v_rec.product_id
        AND m.reference_type = 'sku_migration'
        AND m.reference_id = v_rec.product_id::text
    )
    INTO v_already;

    IF v_already THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(l.available_qty, 0)::numeric(14, 3)
      INTO v_sku_qty
    FROM public.inventory_stock_levels l
    WHERE l.sku_id = v_rec.inventory_sku_id
      AND l.organization_id = p_organization_id;

    v_sku_qty := COALESCE(v_sku_qty, 0);

    INSERT INTO public.catalog_product_outlets (
      product_id,
      outlet_id,
      organization_id,
      in_stock
    )
    VALUES (v_rec.product_id, v_outlet, p_organization_id, 0)
    ON CONFLICT (product_id, outlet_id) DO NOTHING;

    SELECT po.in_stock
      INTO v_current
    FROM public.catalog_product_outlets po
    WHERE po.product_id = v_rec.product_id
      AND po.outlet_id = v_outlet
    FOR UPDATE;

    v_current := COALESCE(v_current, 0);
    v_delta := v_sku_qty - v_current;

    IF v_delta = 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    PERFORM public.apply_catalog_stock_movement(
      p_organization_id,
      v_outlet,
      'product',
      v_rec.product_id,
      NULL,
      NULL,
      CASE WHEN v_current = 0 THEN 'opening' ELSE 'adjustment' END,
      v_delta,
      'sku_migration',
      v_rec.product_id::text,
      'Legacy SKU pool migration'
    );

    v_migrated := v_migrated + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'migrated', v_migrated,
    'skipped', v_skipped,
    'outlet_id', v_outlet
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.migrate_legacy_sku_to_catalog_stock(uuid) TO authenticated;
