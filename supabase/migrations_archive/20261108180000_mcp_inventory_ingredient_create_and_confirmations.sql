-- MCP inventory writes with a preview → confirm step.
--
-- 1. mcp_tool_confirmations: one row per confirmed write. The confirm token's jti is the
--    primary key, so the same confirmation can never be saved twice.
-- 2. mcp_inventory_manager_guard: same role rule as the Purchase Order wrapper
--    (owner, or omnichannel roster admin).
-- 3. mcp_write_catalog_ingredient: add one raw ingredient to one outlet, mirroring the
--    Ingredient page (category find-or-create + outlet link, outlet row, opening stock
--    through apply_catalog_stock_movement). p_confirm_id NULL = preview only, no writes.
-- 4. mcp_preview_inventory_purchase_order: read-only preview for the existing PO wrapper.
-- 5. mcp_confirm_inventory_purchase_order: records the confirmation, then calls the
--    existing mcp_create_inventory_purchase_order in the same transaction.

CREATE TABLE IF NOT EXISTS public.mcp_tool_confirmations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tool text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_confirmations_org
  ON public.mcp_tool_confirmations (organization_id, created_at DESC);

ALTER TABLE public.mcp_tool_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_tool_confirmations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mcp_tool_confirmations TO service_role;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_inventory_manager_guard(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
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
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_inventory_manager_guard(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_inventory_manager_guard(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_write_catalog_ingredient(
  p_user_id uuid,
  p_organization_id uuid,
  p_outlet_id uuid,
  p_name text,
  p_unit_code text,
  p_category_name text,
  p_opening_stock numeric,
  p_unit_cost numeric,
  p_alert_at numeric,
  p_confirm_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_units constant text[] := ARRAY[
    'pcs','box','bks','btr','cm','c','ekr','fl oz','gal','g','grs','ikt','in','jar','klg',
    'kds','ktn','krg','kg','crt','kw','lbr','l','lsn','m','mg','ml','ons','oz','pck','pt',
    'prs','ptg','lb','q','sct','tbsp','tsp','tn','whole'
  ];
  v_name text;
  v_unit text;
  v_category_name text;
  v_outlet_name text;
  v_category_id uuid;
  v_category_label text;
  v_category_is_new boolean := false;
  v_track_cogs boolean;
  v_ingredient_id uuid;
  v_stock_after numeric := 0;
BEGIN
  PERFORM public.mcp_inventory_manager_guard(p_user_id, p_organization_id);

  IF p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_name := btrim(COALESCE(p_name, ''));
  IF v_name = '' OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_unit := btrim(COALESCE(p_unit_code, ''));
  IF NOT (v_unit = ANY (v_units)) THEN
    RAISE EXCEPTION 'ingredient_unit_invalid' USING ERRCODE = '22023';
  END IF;

  v_category_name := NULLIF(btrim(COALESCE(p_category_name, '')), '');
  IF v_category_name IS NOT NULL AND char_length(v_category_name) > 80 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_opening_stock IS NULL
    OR p_opening_stock < 0
    OR p_opening_stock > 99999999999.999
    OR scale(p_opening_stock) > 3
    OR p_unit_cost IS NULL
    OR p_unit_cost < 0
    OR p_unit_cost > 999999999999.99
    OR (p_alert_at IS NOT NULL AND (p_alert_at < 0 OR p_alert_at > 99999999999.999))
  THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  -- Stock without a price would put zero-cost stock into HPP.
  IF p_opening_stock > 0 AND p_unit_cost = 0 THEN
    RAISE EXCEPTION 'ingredient_cost_required' USING ERRCODE = '22023';
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

  IF EXISTS (
    SELECT 1
    FROM public.catalog_ingredients i
    WHERE i.organization_id = p_organization_id
      AND i.is_deleted = false
      AND lower(btrim(i.name)) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'ingredient_duplicate' USING ERRCODE = '23505';
  END IF;

  IF v_category_name IS NOT NULL THEN
    SELECT c.id, c.name
      INTO v_category_id, v_category_label
    FROM public.catalog_ingredient_categories c
    WHERE c.organization_id = p_organization_id
      AND lower(btrim(c.name)) = lower(v_category_name);
    IF v_category_id IS NULL THEN
      v_category_is_new := true;
      v_category_label := v_category_name;
    END IF;
  END IF;

  v_track_cogs := p_unit_cost > 0;

  -- Preview: everything above is validated, nothing is written.
  IF p_confirm_id IS NULL THEN
    RETURN jsonb_build_object(
      'saved', false,
      'outlet_id', p_outlet_id,
      'outlet_name', v_outlet_name,
      'name', v_name,
      'kind', 'raw',
      'unit_code', v_unit,
      'category_name', v_category_label,
      'category_is_new', v_category_is_new,
      'opening_stock', p_opening_stock,
      'unit_cost', p_unit_cost,
      'opening_value', round(p_opening_stock * p_unit_cost, 2),
      'track_cogs', v_track_cogs,
      'alert_at', p_alert_at
    );
  END IF;

  INSERT INTO public.mcp_tool_confirmations (id, organization_id, user_id, tool)
  VALUES (p_confirm_id, p_organization_id, p_user_id, 'inventory.ingredient.create');

  IF v_category_name IS NOT NULL AND v_category_id IS NULL THEN
    INSERT INTO public.catalog_ingredient_categories (organization_id, name, sort_order)
    VALUES (
      p_organization_id,
      v_category_name,
      (SELECT count(*) + 1 FROM public.catalog_ingredient_categories c WHERE c.organization_id = p_organization_id)
    )
    RETURNING id INTO v_category_id;
  END IF;

  IF v_category_id IS NOT NULL THEN
    -- The Ingredient page lists only categories linked to the selected outlet.
    INSERT INTO public.catalog_ingredient_category_outlets (category_id, outlet_id, organization_id)
    VALUES (v_category_id, p_outlet_id, p_organization_id)
    ON CONFLICT (category_id, outlet_id) DO NOTHING;
  END IF;

  INSERT INTO public.catalog_ingredients (
    organization_id, name, kind, category_id, unit_code, track_inventory, sort_order, is_deleted
  )
  VALUES (
    p_organization_id,
    v_name,
    'raw',
    v_category_id,
    v_unit,
    true,
    (SELECT count(*) + 1 FROM public.catalog_ingredients i
      WHERE i.organization_id = p_organization_id AND i.is_deleted = false),
    false
  )
  RETURNING id INTO v_ingredient_id;

  INSERT INTO public.catalog_ingredient_outlets (
    ingredient_id, outlet_id, organization_id, in_stock, alert_enabled, alert_at, track_cogs, avg_cost
  )
  VALUES (
    v_ingredient_id,
    p_outlet_id,
    p_organization_id,
    0,
    p_alert_at IS NOT NULL,
    p_alert_at,
    v_track_cogs,
    CASE WHEN v_track_cogs THEN p_unit_cost ELSE 0 END
  );

  IF p_opening_stock > 0 THEN
    -- Same ledger path as the page: an 'opening' movement, attributed to the session user.
    PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config(
      'request.jwt.claims',
      json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
      true
    );
    PERFORM public.apply_catalog_stock_movement(
      p_organization_id,
      p_outlet_id,
      'ingredient',
      NULL,
      NULL,
      v_ingredient_id,
      'opening',
      p_opening_stock,
      'mcp_confirmation',
      p_confirm_id::text,
      'Opening stock (Claude)'
    );
  END IF;

  SELECT io.in_stock
    INTO v_stock_after
  FROM public.catalog_ingredient_outlets io
  WHERE io.ingredient_id = v_ingredient_id
    AND io.outlet_id = p_outlet_id;

  RETURN jsonb_build_object(
    'saved', true,
    'ingredient_id', v_ingredient_id,
    'outlet_id', p_outlet_id,
    'outlet_name', v_outlet_name,
    'name', v_name,
    'kind', 'raw',
    'unit_code', v_unit,
    'category_name', v_category_label,
    'category_is_new', v_category_is_new,
    'opening_stock', p_opening_stock,
    'unit_cost', p_unit_cost,
    'opening_value', round(p_opening_stock * p_unit_cost, 2),
    'track_cogs', v_track_cogs,
    'alert_at', p_alert_at,
    'in_stock', COALESCE(v_stock_after, 0)
  );
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_write_catalog_ingredient(uuid, uuid, uuid, text, text, text, numeric, numeric, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_write_catalog_ingredient(uuid, uuid, uuid, text, text, text, numeric, numeric, numeric, uuid) TO service_role;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_preview_inventory_purchase_order(
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_search text;
  v_note text;
  v_outlet_name text;
  v_supplier_name text;
  v_po_mode text;
  v_count integer := 0;
  v_labels text[] := ARRAY[]::text[];
  v_match record;
  v_kind text;
  v_name text;
  v_variant_name text;
  v_unit_code text;
  v_qty_before numeric;
  v_receive_now boolean;
BEGIN
  PERFORM public.mcp_inventory_manager_guard(p_user_id, p_organization_id);

  IF p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
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

  IF p_supplier_id IS NOT NULL THEN
    SELECT supplier.name
      INTO v_supplier_name
    FROM public.catalog_suppliers supplier
    WHERE supplier.id = p_supplier_id
      AND supplier.organization_id = p_organization_id
      AND supplier.is_deleted = false;
    IF v_supplier_name IS NULL THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Same matching rule as mcp_create_inventory_purchase_order.
  FOR v_match IN
    SELECT found.kind, found.name, found.variant_name, found.unit_code, found.qty_before, found.label
    FROM (
      SELECT
        'ingredient'::text AS kind,
        i.name,
        NULL::text AS variant_name,
        i.unit_code AS unit_code,
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
        NULL::text,
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
        NULL::text,
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
    v_unit_code := v_match.unit_code;
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

  v_receive_now := v_po_mode IS DISTINCT FROM 'advanced';

  RETURN jsonb_build_object(
    'saved', false,
    'outlet_id', p_outlet_id,
    'outlet_name', v_outlet_name,
    'kind', v_kind,
    'name', v_name,
    'variant_name', v_variant_name,
    'unit_code', v_unit_code,
    'qty', p_qty,
    'unit_cost', p_unit_cost,
    'subtotal', round(p_qty * p_unit_cost, 2),
    'supplier_id', p_supplier_id,
    'supplier_name', v_supplier_name,
    'note', v_note,
    'po_mode', v_po_mode,
    'stock_received_on_confirm', v_receive_now,
    'qty_before', COALESCE(v_qty_before, 0),
    'qty_after_expected', CASE WHEN v_receive_now THEN COALESCE(v_qty_before, 0) + p_qty ELSE COALESCE(v_qty_before, 0) END
  );
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_preview_inventory_purchase_order(uuid, uuid, uuid, text, numeric, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_preview_inventory_purchase_order(uuid, uuid, uuid, text, numeric, numeric, uuid, text) TO service_role;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mcp_confirm_inventory_purchase_order(
  p_confirm_id uuid,
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
BEGIN
  IF p_confirm_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  PERFORM public.mcp_inventory_manager_guard(p_user_id, p_organization_id);

  INSERT INTO public.mcp_tool_confirmations (id, organization_id, user_id, tool)
  VALUES (p_confirm_id, p_organization_id, p_user_id, 'inventory.purchase_order.create');

  RETURN public.mcp_create_inventory_purchase_order(
    p_user_id,
    p_organization_id,
    p_outlet_id,
    p_search,
    p_qty,
    p_unit_cost,
    p_supplier_id,
    p_note
  );
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_confirm_inventory_purchase_order(uuid, uuid, uuid, uuid, text, numeric, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_confirm_inventory_purchase_order(uuid, uuid, uuid, uuid, text, numeric, numeric, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
