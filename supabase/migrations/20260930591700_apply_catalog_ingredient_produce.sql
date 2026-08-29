-- Semi-finished produce: movement_type 'production' + apply_catalog_ingredient_produce RPC.

ALTER TABLE public.catalog_stock_movements
  DROP CONSTRAINT IF EXISTS catalog_stock_movements_type_check;

ALTER TABLE public.catalog_stock_movements
  ADD CONSTRAINT catalog_stock_movements_type_check CHECK (
    movement_type IN (
      'opening',
      'purchase_order',
      'sale',
      'transfer',
      'adjustment',
      'recipe_consume',
      'production'
    )
  );

CREATE OR REPLACE FUNCTION public.apply_catalog_ingredient_produce(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_output_ingredient_id uuid,
  p_produce_qty numeric,
  p_activity_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipe_id uuid;
  v_yield numeric;
  v_scale numeric;
  v_line record;
  v_stock numeric;
  v_batch_cost numeric := 0;
  v_unit_cost numeric := 0;
  v_cost_qty numeric := 0;
  v_line_cost numeric;
  v_avg numeric;
  v_track_cogs boolean;
  v_output_track boolean;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;
  IF p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'catalog_stock_outlet_required';
  END IF;
  IF p_output_ingredient_id IS NULL THEN
    RAISE EXCEPTION 'catalog_produce_output_required';
  END IF;
  IF p_produce_qty IS NULL OR p_produce_qty <= 0 THEN
    RAISE EXCEPTION 'catalog_produce_qty_required';
  END IF;
  IF p_activity_id IS NULL OR btrim(p_activity_id) = '' THEN
    RAISE EXCEPTION 'catalog_produce_activity_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.catalog_stock_movements
    WHERE organization_id = p_organization_id
      AND reference_type = 'ingredient_produce'
      AND reference_id LIKE p_activity_id || ':%'
  ) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'duplicate');
  END IF;

  SELECT track_inventory INTO v_output_track
  FROM public.catalog_ingredients
  WHERE id = p_output_ingredient_id
    AND organization_id = p_organization_id
    AND is_deleted = false
    AND kind = 'semi_finished';
  IF v_output_track IS NOT TRUE THEN
    RAISE EXCEPTION 'catalog_produce_output_invalid';
  END IF;

  SELECT r.id, r.yield_qty
    INTO v_recipe_id, v_yield
  FROM public.catalog_ingredient_recipes r
  WHERE r.output_ingredient_id = p_output_ingredient_id
    AND r.organization_id = p_organization_id;
  IF v_recipe_id IS NULL OR v_yield IS NULL OR v_yield <= 0 THEN
    RAISE EXCEPTION 'catalog_produce_recipe_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.catalog_ingredient_recipe_lines l
    WHERE l.recipe_id = v_recipe_id AND l.quantity > 0
  ) THEN
    RAISE EXCEPTION 'catalog_produce_recipe_required';
  END IF;

  v_scale := p_produce_qty / v_yield;

  -- Pre-check raw stock (tracked ingredients only)
  FOR v_line IN
    SELECT l.ingredient_id, l.quantity
    FROM public.catalog_ingredient_recipe_lines l
    JOIN public.catalog_ingredients i ON i.id = l.ingredient_id
    WHERE l.recipe_id = v_recipe_id
      AND l.quantity > 0
      AND i.track_inventory = true
      AND i.is_deleted = false
  LOOP
    SELECT io.in_stock INTO v_stock
    FROM public.catalog_ingredient_outlets io
    WHERE io.ingredient_id = v_line.ingredient_id
      AND io.outlet_id = p_outlet_id;
    v_stock := COALESCE(v_stock, 0);
    IF v_stock < (v_line.quantity * v_scale) THEN
      RAISE EXCEPTION 'catalog_stock_insufficient';
    END IF;
  END LOOP;

  -- Consume raw ingredients + accumulate batch cost for COGS
  FOR v_line IN
    SELECT l.ingredient_id, l.quantity
    FROM public.catalog_ingredient_recipe_lines l
    JOIN public.catalog_ingredients i ON i.id = l.ingredient_id
    WHERE l.recipe_id = v_recipe_id
      AND l.quantity > 0
      AND i.track_inventory = true
      AND i.is_deleted = false
  LOOP
    PERFORM public.apply_catalog_stock_movement(
      p_organization_id,
      p_outlet_id,
      'ingredient',
      NULL,
      NULL,
      v_line.ingredient_id,
      'recipe_consume',
      -(v_line.quantity * v_scale),
      'ingredient_produce',
      p_activity_id || ':raw:' || v_line.ingredient_id::text,
      'Produce recipe consume'
    );

    SELECT io.avg_cost, io.track_cogs
      INTO v_avg, v_track_cogs
    FROM public.catalog_ingredient_outlets io
    WHERE io.ingredient_id = v_line.ingredient_id
      AND io.outlet_id = p_outlet_id;
    IF v_track_cogs IS TRUE THEN
      v_line_cost := COALESCE(v_avg, 0) * (v_line.quantity * v_scale);
      v_batch_cost := v_batch_cost + v_line_cost;
      v_cost_qty := v_cost_qty + (v_line.quantity * v_scale);
    END IF;
  END LOOP;

  IF p_produce_qty > 0 AND v_batch_cost > 0 THEN
    v_unit_cost := v_batch_cost / p_produce_qty;
  ELSE
    v_unit_cost := 0;
  END IF;

  -- Weighted avg on output before inbound (same order as PO)
  PERFORM public.catalog_po_update_avg_cost(
    p_organization_id,
    p_outlet_id,
    'ingredient',
    NULL,
    NULL,
    p_output_ingredient_id,
    p_produce_qty,
    v_unit_cost
  );

  PERFORM public.apply_catalog_stock_movement(
    p_organization_id,
    p_outlet_id,
    'ingredient',
    NULL,
    NULL,
    p_output_ingredient_id,
    'production',
    p_produce_qty,
    'ingredient_produce',
    p_activity_id || ':out:' || p_output_ingredient_id::text,
    'Produce semi-finished'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'outlet_id', p_outlet_id,
    'scale', v_scale,
    'unit_cost', v_unit_cost,
    'batch_cost', v_batch_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_catalog_ingredient_produce(
  uuid, uuid, uuid, numeric, text
) TO authenticated;

COMMENT ON FUNCTION public.apply_catalog_ingredient_produce(uuid, uuid, uuid, numeric, text) IS
  'Produce semi-finished stock: consume raw recipe lines, update weighted avg cost, add production inbound.';
