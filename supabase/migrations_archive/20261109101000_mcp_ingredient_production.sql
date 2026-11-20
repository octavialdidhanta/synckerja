-- MCP: record semi-finished production (e.g. Beras → Nasi) with a preview → confirm step.
--
-- mcp_preview_ingredient_production: read-only. Resolves the semi-finished item by name, mirrors
--   apply_catalog_ingredient_produce (only tracked recipe lines are consumed; only lines with COGS
--   tracking add to the batch cost) and shows stock before/after, shortfalls and the cost.
-- mcp_confirm_ingredient_production: records the confirmation (jti = primary key, so a token
--   works once), then runs the same RPC the Produce button uses, as the session user, with the
--   confirmation id as the activity id. No new production logic.
--
-- Same role rule as the other MCP inventory writes: owner, or omnichannel roster admin.

CREATE OR REPLACE FUNCTION public._mcp_resolve_semi_finished(
  p_organization_id uuid,
  p_search text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_search text := btrim(COALESCE(p_search, ''));
  v_id uuid;
  v_count integer;
  v_names text;
BEGIN
  IF v_search = '' OR length(v_search) > 120 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), min(i.id::text)::uuid
    INTO v_count, v_id
  FROM public.catalog_ingredients i
  WHERE i.organization_id = p_organization_id
    AND i.kind = 'semi_finished'
    AND NOT COALESCE(i.is_deleted, false)
    AND lower(i.name) = lower(v_search);
  IF v_count = 1 THEN
    RETURN v_id;
  END IF;

  SELECT count(*), min(i.id::text)::uuid, string_agg(i.name, ' | ' ORDER BY i.name)
    INTO v_count, v_id, v_names
  FROM public.catalog_ingredients i
  WHERE i.organization_id = p_organization_id
    AND i.kind = 'semi_finished'
    AND NOT COALESCE(i.is_deleted, false)
    AND i.name ILIKE '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  IF v_count = 1 THEN
    RETURN v_id;
  END IF;
  IF v_count > 1 THEN
    RAISE EXCEPTION '%', 'ambiguous: ' || v_names USING ERRCODE = '22023';
  END IF;
  RAISE EXCEPTION 'production_item_not_found' USING ERRCODE = 'P0002';
END;
$mcp$;

REVOKE ALL ON FUNCTION public._mcp_resolve_semi_finished(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._mcp_resolve_semi_finished(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_preview_ingredient_production(
  p_user_id uuid,
  p_organization_id uuid,
  p_outlet_id uuid,
  p_search text,
  p_qty numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_outlet_name text;
  v_item_id uuid;
  v_item record;
  v_recipe_id uuid;
  v_yield numeric;
  v_scale numeric;
  v_line record;
  v_lines jsonb := '[]'::jsonb;
  v_need numeric;
  v_stock numeric;
  v_line_cost numeric;
  v_batch_cost numeric := 0;
  v_unit_cost numeric;
  v_short text[] := ARRAY[]::text[];
  v_no_cost text[] := ARRAY[]::text[];
  v_out record;
  v_out_before numeric;
  v_avg_after numeric;
BEGIN
  PERFORM public.mcp_inventory_manager_guard(p_user_id, p_organization_id);

  IF p_qty IS NULL OR p_qty <= 0 OR p_qty > 1000000 OR round(p_qty, 3) <> p_qty THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.pos_outlets o
  WHERE o.id = p_outlet_id
    AND o.organization_id = p_organization_id
    AND NOT COALESCE(o.is_deleted, false);
  IF v_outlet_name IS NULL THEN
    RAISE EXCEPTION 'outlet_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_item_id := public._mcp_resolve_semi_finished(p_organization_id, p_search);

  SELECT i.id, i.name, i.unit_code, i.track_inventory
    INTO v_item
  FROM public.catalog_ingredients i
  WHERE i.id = v_item_id;
  IF v_item.track_inventory IS NOT TRUE THEN
    RAISE EXCEPTION 'production_item_not_tracked' USING ERRCODE = '22023';
  END IF;

  SELECT r.id, r.yield_qty INTO v_recipe_id, v_yield
  FROM public.catalog_ingredient_recipes r
  WHERE r.output_ingredient_id = v_item_id
    AND r.organization_id = p_organization_id;
  IF v_recipe_id IS NULL OR v_yield IS NULL OR v_yield <= 0 OR NOT EXISTS (
    SELECT 1 FROM public.catalog_ingredient_recipe_lines l WHERE l.recipe_id = v_recipe_id AND l.quantity > 0
  ) THEN
    RAISE EXCEPTION 'production_recipe_required' USING ERRCODE = '22023';
  END IF;

  v_scale := p_qty / v_yield;

  FOR v_line IN
    SELECT l.ingredient_id, l.quantity, i.name, i.unit_code, i.track_inventory,
           io.in_stock, io.avg_cost, io.track_cogs
    FROM public.catalog_ingredient_recipe_lines l
    JOIN public.catalog_ingredients i ON i.id = l.ingredient_id AND NOT COALESCE(i.is_deleted, false)
    LEFT JOIN public.catalog_ingredient_outlets io
      ON io.ingredient_id = l.ingredient_id AND io.outlet_id = p_outlet_id
    WHERE l.recipe_id = v_recipe_id AND l.quantity > 0
    ORDER BY l.sort_order, i.name
  LOOP
    v_need := round(v_line.quantity * v_scale, 3);
    v_stock := COALESCE(v_line.in_stock, 0);
    v_line_cost := CASE WHEN v_line.track_cogs IS TRUE THEN COALESCE(v_line.avg_cost, 0) * (v_line.quantity * v_scale) ELSE 0 END;
    v_batch_cost := v_batch_cost + v_line_cost;
    IF v_line.track_inventory IS TRUE AND v_stock < (v_line.quantity * v_scale) THEN
      v_short := array_append(v_short, v_line.name);
    END IF;
    IF v_line.track_cogs IS NOT TRUE OR COALESCE(v_line.avg_cost, 0) <= 0 THEN
      v_no_cost := array_append(v_no_cost, v_line.name);
    END IF;
    v_lines := v_lines || jsonb_build_object(
      'ingredient', v_line.name,
      'unit_code', v_line.unit_code,
      'per_batch', v_line.quantity,
      'need', v_need,
      'stock_tracked', v_line.track_inventory IS TRUE,
      'stock_before', CASE WHEN v_line.track_inventory IS TRUE THEN v_stock END,
      'stock_after', CASE WHEN v_line.track_inventory IS TRUE THEN round(v_stock - v_line.quantity * v_scale, 3) END,
      'enough', v_line.track_inventory IS NOT TRUE OR v_stock >= (v_line.quantity * v_scale),
      'unit_cost', CASE WHEN v_line.track_cogs IS TRUE THEN COALESCE(v_line.avg_cost, 0) ELSE 0 END,
      'cost', round(v_line_cost, 2)
    );
  END LOOP;

  v_unit_cost := CASE WHEN v_batch_cost > 0 THEN v_batch_cost / p_qty ELSE 0 END;

  SELECT io.in_stock, io.avg_cost, io.track_cogs INTO v_out
  FROM public.catalog_ingredient_outlets io
  WHERE io.ingredient_id = v_item_id AND io.outlet_id = p_outlet_id;
  v_out_before := COALESCE(v_out.in_stock, 0);
  IF v_out.track_cogs IS TRUE THEN
    v_avg_after := CASE
      WHEN (v_out_before + p_qty) <= 0 THEN v_unit_cost
      ELSE ((v_out_before * COALESCE(v_out.avg_cost, 0)) + (p_qty * v_unit_cost)) / (v_out_before + p_qty)
    END;
  END IF;

  RETURN jsonb_build_object(
    'outlet_id', p_outlet_id,
    'outlet_name', v_outlet_name,
    'item_id', v_item_id,
    'item', v_item.name,
    'unit_code', v_item.unit_code,
    'qty', p_qty,
    'recipe_yield', v_yield,
    'batches', round(v_scale, 4),
    'lines', v_lines,
    'can_produce', cardinality(v_short) = 0,
    'short_of', to_jsonb(v_short),
    'without_cost', to_jsonb(v_no_cost),
    'batch_cost', round(v_batch_cost, 2),
    'unit_cost', round(v_unit_cost, 2),
    'stock_before', v_out_before,
    'stock_after', round(v_out_before + p_qty, 3),
    'cost_tracked', v_out.track_cogs IS TRUE,
    'avg_cost_before', CASE WHEN v_out.track_cogs IS TRUE THEN COALESCE(v_out.avg_cost, 0) END,
    'avg_cost_after', CASE WHEN v_out.track_cogs IS TRUE THEN round(v_avg_after, 2) END
  );
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_preview_ingredient_production(uuid, uuid, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_ingredient_production(uuid, uuid, uuid, text, numeric) TO service_role;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_confirm_ingredient_production(
  p_confirm_id uuid,
  p_user_id uuid,
  p_organization_id uuid,
  p_outlet_id uuid,
  p_item_id uuid,
  p_qty numeric
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_result jsonb;
  v_name text;
  v_unit text;
  v_stock numeric;
  v_avg numeric;
  v_lines jsonb;
BEGIN
  IF p_confirm_id IS NULL OR p_item_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 OR p_qty > 1000000 OR round(p_qty, 3) <> p_qty THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  PERFORM public.mcp_inventory_manager_guard(p_user_id, p_organization_id);

  INSERT INTO public.mcp_tool_confirmations (id, organization_id, user_id, tool)
  VALUES (p_confirm_id, p_organization_id, p_user_id, 'inventory.production.create');

  -- Run the Produce button's RPC as the session user (membership + outlet checks, ledger attribution).
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );

  v_result := public.apply_catalog_ingredient_produce(
    p_organization_id,
    p_outlet_id,
    p_item_id,
    p_qty,
    'mcp:' || p_confirm_id::text
  );

  IF COALESCE((v_result ->> 'skipped')::boolean, false) THEN
    RAISE EXCEPTION 'confirmation_used' USING ERRCODE = '23505';
  END IF;

  SELECT i.name, i.unit_code, io.in_stock, io.avg_cost
    INTO v_name, v_unit, v_stock, v_avg
  FROM public.catalog_ingredients i
  LEFT JOIN public.catalog_ingredient_outlets io ON io.ingredient_id = i.id AND io.outlet_id = p_outlet_id
  WHERE i.id = p_item_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'ingredient', i.name,
           'unit_code', i.unit_code,
           'used', -m.qty_delta,
           'stock_after', m.qty_after
         ) ORDER BY i.name), '[]'::jsonb)
    INTO v_lines
  FROM public.catalog_stock_movements m
  JOIN public.catalog_ingredients i ON i.id = m.ingredient_id
  WHERE m.organization_id = p_organization_id
    AND m.reference_type = 'ingredient_produce'
    AND m.reference_id LIKE 'mcp:' || p_confirm_id::text || ':raw:%';

  RETURN jsonb_build_object(
    'saved', true,
    'outlet_id', p_outlet_id,
    'item_id', p_item_id,
    'item', v_name,
    'unit_code', v_unit,
    'qty', p_qty,
    'stock_after', v_stock,
    'avg_cost_after', v_avg,
    'unit_cost', round((v_result ->> 'unit_cost')::numeric, 2),
    'batch_cost', round((v_result ->> 'batch_cost')::numeric, 2),
    'used', v_lines
  );
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_confirm_ingredient_production(uuid, uuid, uuid, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_confirm_ingredient_production(uuid, uuid, uuid, uuid, uuid, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
