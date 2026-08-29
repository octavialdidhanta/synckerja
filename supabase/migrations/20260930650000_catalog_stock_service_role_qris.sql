-- Allow catalog stock deduction during QRIS finalize (service_role webhook / sandbox simulate).
-- Cashier checkout still uses auth.uid() membership via user_organization_ids().

CREATE OR REPLACE FUNCTION public.apply_catalog_stock_movement(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_item_kind text,
  p_product_id uuid,
  p_variant_id uuid,
  p_ingredient_id uuid,
  p_movement_type text,
  p_qty_delta numeric,
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current numeric(14, 3);
  v_next numeric(14, 3);
  v_variant uuid;
  v_row public.catalog_stock_movements%ROWTYPE;
  v_is_service boolean := (auth.role() = 'service_role');
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;

  IF v_is_service THEN
    IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_organization_id) THEN
      RAISE EXCEPTION 'catalog_stock_forbidden';
    END IF;
  ELSIF p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;

  IF p_qty_delta IS NULL OR p_qty_delta = 0 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'zero_delta');
  END IF;

  v_variant := p_variant_id;

  IF p_item_kind = 'product' THEN
    IF v_variant IS NULL THEN
      SELECT v.id
        INTO v_variant
      FROM public.catalog_product_variants v
      WHERE v.product_id = p_product_id
      ORDER BY v.sort_order, v.created_at
      LIMIT 1;
    END IF;

    IF v_variant IS NOT NULL THEN
      SELECT vo.in_stock INTO v_current
      FROM public.catalog_product_variant_outlets vo
      WHERE vo.variant_id = v_variant AND vo.outlet_id = p_outlet_id
      FOR UPDATE;
      IF v_current IS NULL THEN
        INSERT INTO public.catalog_product_variant_outlets (
          variant_id, outlet_id, organization_id, in_stock
        ) VALUES (v_variant, p_outlet_id, p_organization_id, 0)
        ON CONFLICT (variant_id, outlet_id) DO NOTHING;
        SELECT vo.in_stock INTO v_current
        FROM public.catalog_product_variant_outlets vo
        WHERE vo.variant_id = v_variant AND vo.outlet_id = p_outlet_id
        FOR UPDATE;
      END IF;
    ELSE
      SELECT po.in_stock INTO v_current
      FROM public.catalog_product_outlets po
      WHERE po.product_id = p_product_id AND po.outlet_id = p_outlet_id
      FOR UPDATE;
      IF v_current IS NULL THEN
        INSERT INTO public.catalog_product_outlets (
          product_id, outlet_id, organization_id, in_stock
        ) VALUES (p_product_id, p_outlet_id, p_organization_id, 0)
        ON CONFLICT (product_id, outlet_id) DO NOTHING;
        SELECT po.in_stock INTO v_current
        FROM public.catalog_product_outlets po
        WHERE po.product_id = p_product_id AND po.outlet_id = p_outlet_id
        FOR UPDATE;
      END IF;
    END IF;
  ELSIF p_item_kind = 'ingredient' THEN
    SELECT io.in_stock INTO v_current
    FROM public.catalog_ingredient_outlets io
    WHERE io.ingredient_id = p_ingredient_id AND io.outlet_id = p_outlet_id
    FOR UPDATE;
    IF v_current IS NULL THEN
      INSERT INTO public.catalog_ingredient_outlets (
        ingredient_id, outlet_id, organization_id, in_stock
      ) VALUES (p_ingredient_id, p_outlet_id, p_organization_id, 0)
      ON CONFLICT (ingredient_id, outlet_id) DO NOTHING;
      SELECT io.in_stock INTO v_current
      FROM public.catalog_ingredient_outlets io
      WHERE io.ingredient_id = p_ingredient_id AND io.outlet_id = p_outlet_id
      FOR UPDATE;
    END IF;
  ELSE
    RAISE EXCEPTION 'catalog_stock_kind_invalid';
  END IF;

  v_current := COALESCE(v_current, 0);
  v_next := v_current + p_qty_delta;
  IF v_next < 0 AND p_movement_type <> 'adjustment' THEN
    RAISE EXCEPTION 'catalog_stock_insufficient';
  END IF;
  IF v_next < 0 THEN
    v_next := 0;
  END IF;

  IF p_item_kind = 'product' AND v_variant IS NOT NULL THEN
    UPDATE public.catalog_product_variant_outlets
    SET in_stock = v_next
    WHERE variant_id = v_variant AND outlet_id = p_outlet_id;
  ELSIF p_item_kind = 'product' THEN
    UPDATE public.catalog_product_outlets
    SET in_stock = v_next
    WHERE product_id = p_product_id AND outlet_id = p_outlet_id;
  ELSE
    UPDATE public.catalog_ingredient_outlets
    SET in_stock = v_next
    WHERE ingredient_id = p_ingredient_id AND outlet_id = p_outlet_id;
  END IF;

  INSERT INTO public.catalog_stock_movements (
    organization_id,
    outlet_id,
    item_kind,
    product_id,
    variant_id,
    ingredient_id,
    movement_type,
    qty_delta,
    qty_after,
    reference_type,
    reference_id,
    note,
    created_by
  )
  VALUES (
    p_organization_id,
    p_outlet_id,
    p_item_kind,
    CASE WHEN p_item_kind = 'product' THEN p_product_id ELSE NULL END,
    CASE WHEN p_item_kind = 'product' THEN v_variant ELSE NULL END,
    CASE WHEN p_item_kind = 'ingredient' THEN p_ingredient_id ELSE NULL END,
    p_movement_type,
    p_qty_delta,
    v_next,
    p_reference_type,
    p_reference_id,
    p_note,
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;
