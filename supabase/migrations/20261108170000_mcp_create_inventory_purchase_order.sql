-- Receive one tracked catalog item through the existing Purchase Order function.
-- Simple mode fulfills immediately. Advanced mode only submits the PO.
-- The page function reads auth.uid(), so this wrapper sets the session user first.

CREATE OR REPLACE FUNCTION public.mcp_create_inventory_purchase_order(
  p_user_id uuid,
  p_organization_id uuid,
  p_outlet_id uuid,
  p_search text,
  p_qty numeric,
  p_unit_cost numeric,
  p_supplier_id uuid,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_search text;
  v_note text;
  v_outlet_name text;
  v_po_mode text;
  v_fulfill boolean;
  v_count integer := 0;
  v_labels text[] := ARRAY[]::text[];
  v_match record;
  v_kind text;
  v_name text;
  v_variant_name text;
  v_product_id uuid;
  v_variant_id uuid;
  v_ingredient_id uuid;
  v_qty_before numeric;
  v_qty_after numeric;
  v_created jsonb;
  v_status text;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = p_user_id
        AND ur.organization_id = p_organization_id
        AND ur.role = 'owner'::text
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_omnichannel_staff staff
      INNER JOIN public.employees employee
        ON employee.id = staff.employee_id
       AND employee.user_id = p_user_id
      WHERE staff.organization_id = p_organization_id
        AND staff.role = 'admin'::text
    )
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_search := btrim(COALESCE(p_search, ''));
  IF v_search = '' OR char_length(v_search) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_qty IS NULL
    OR p_qty <= 0
    OR p_qty > 99999999999.999
    OR scale(p_qty) > 3
    OR p_unit_cost IS NULL
    OR p_unit_cost <= 0
    OR p_unit_cost > 999999999999.99
    OR round(p_qty * p_unit_cost, 2) <= 0
    OR round(p_qty * p_unit_cost, 2) > 999999999999.99
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT outlet.name
    INTO v_outlet_name
  FROM public.pos_outlets outlet
  WHERE outlet.id = p_outlet_id
    AND outlet.organization_id = p_organization_id
    AND outlet.is_deleted = false;

  IF v_outlet_name IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_supplier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.catalog_suppliers supplier
    WHERE supplier.id = p_supplier_id
      AND supplier.organization_id = p_organization_id
      AND supplier.is_deleted = false
  ) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  FOR v_match IN
    SELECT found.kind, found.name, found.variant_name, found.product_id, found.variant_id,
           found.ingredient_id, found.qty_before, found.label
    FROM (
      SELECT
        'ingredient'::text AS kind,
        i.name,
        NULL::text AS variant_name,
        NULL::uuid AS product_id,
        NULL::uuid AS variant_id,
        i.id AS ingredient_id,
        io.in_stock AS qty_before,
        i.name AS label
      FROM public.catalog_ingredients i
      JOIN public.catalog_ingredient_outlets io
        ON io.ingredient_id = i.id
       AND io.outlet_id = p_outlet_id
       AND io.organization_id = p_organization_id
      WHERE i.organization_id = p_organization_id
        AND i.is_deleted = false
        AND i.track_inventory = true
        AND lower(btrim(i.name)) = lower(v_search)

      UNION ALL

      SELECT
        'product'::text,
        dp.name,
        NULL::text,
        dp.id,
        NULL::uuid,
        NULL::uuid,
        link.in_stock,
        dp.name
      FROM public.default_prices dp
      JOIN public.catalog_product_outlets link
        ON link.product_id = dp.id
       AND link.outlet_id = p_outlet_id
       AND link.organization_id = p_organization_id
      WHERE dp.organization_id = p_organization_id
        AND dp.kind = 'product'
        AND dp.track_stock = true
        AND lower(btrim(dp.name)) = lower(v_search)
        AND NOT EXISTS (
          SELECT 1
          FROM public.catalog_product_variants variant
          WHERE variant.product_id = dp.id
        )

      UNION ALL

      SELECT
        'product'::text,
        dp.name,
        variant.name,
        dp.id,
        variant.id,
        NULL::uuid,
        COALESCE(stock.in_stock, 0),
        dp.name || ' / ' || variant.name
      FROM public.default_prices dp
      JOIN public.catalog_product_outlets link
        ON link.product_id = dp.id
       AND link.outlet_id = p_outlet_id
       AND link.organization_id = p_organization_id
      JOIN public.catalog_product_variants variant
        ON variant.product_id = dp.id
       AND variant.organization_id = dp.organization_id
      LEFT JOIN public.catalog_product_variant_outlets stock
        ON stock.variant_id = variant.id
       AND stock.outlet_id = p_outlet_id
       AND stock.organization_id = p_organization_id
      WHERE dp.organization_id = p_organization_id
        AND dp.kind = 'product'
        AND dp.track_stock = true
        AND lower(btrim(variant.name)) = lower(v_search)
    ) found
    ORDER BY found.label
  LOOP
    v_count := v_count + 1;
    v_labels := v_labels || v_match.label;
    v_kind := v_match.kind;
    v_name := v_match.name;
    v_variant_name := v_match.variant_name;
    v_product_id := v_match.product_id;
    v_variant_id := v_match.variant_id;
    v_ingredient_id := v_match.ingredient_id;
    v_qty_before := v_match.qty_before;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_count > 1 THEN
    RAISE EXCEPTION '%', 'ambiguous: ' || array_to_string(v_labels, ' | ')
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    (SELECT settings.po_mode
     FROM public.catalog_inventory_settings settings
     WHERE settings.organization_id = p_organization_id),
    'simple'
  )
  INTO v_po_mode;

  v_fulfill := v_po_mode IS DISTINCT FROM 'advanced';

  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );

  v_created := public.create_catalog_purchase_order(
    p_organization_id,
    p_outlet_id,
    p_supplier_id,
    v_kind,
    v_note,
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'variant_id', v_variant_id,
      'ingredient_id', v_ingredient_id,
      'qty', p_qty,
      'unit_cost', p_unit_cost,
      'name_snapshot', v_labels[1]
    )),
    v_fulfill
  );

  v_status := v_created ->> 'status';

  IF v_kind = 'ingredient' THEN
    SELECT io.in_stock
      INTO v_qty_after
    FROM public.catalog_ingredient_outlets io
    WHERE io.ingredient_id = v_ingredient_id
      AND io.outlet_id = p_outlet_id
      AND io.organization_id = p_organization_id;
  ELSIF v_variant_id IS NOT NULL THEN
    SELECT COALESCE(stock.in_stock, 0)
      INTO v_qty_after
    FROM public.catalog_product_variants variant
    LEFT JOIN public.catalog_product_variant_outlets stock
      ON stock.variant_id = variant.id
     AND stock.outlet_id = p_outlet_id
     AND stock.organization_id = p_organization_id
    WHERE variant.id = v_variant_id;
  ELSE
    SELECT link.in_stock
      INTO v_qty_after
    FROM public.catalog_product_outlets link
    WHERE link.product_id = v_product_id
      AND link.outlet_id = p_outlet_id
      AND link.organization_id = p_organization_id;
  END IF;

  IF v_status IS DISTINCT FROM 'completed' THEN
    v_qty_after := v_qty_before;
  END IF;

  RETURN jsonb_build_object(
    'purchase_order_id', v_created ->> 'id',
    'order_number', v_created ->> 'order_number',
    'status', v_status,
    'po_mode', v_po_mode,
    'stock_received', v_status = 'completed',
    'outlet_id', p_outlet_id,
    'outlet_name', v_outlet_name,
    'kind', v_kind,
    'name', v_name,
    'variant_name', v_variant_name,
    'qty_added', p_qty,
    'unit_cost', p_unit_cost,
    'qty_before', COALESCE(v_qty_before, 0),
    'qty_after', COALESCE(v_qty_after, v_qty_before, 0)
  );
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_create_inventory_purchase_order(uuid, uuid, uuid, text, numeric, numeric, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_inventory_purchase_order(uuid, uuid, uuid, text, numeric, numeric, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_inventory_purchase_order(uuid, uuid, uuid, text, numeric, numeric, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
