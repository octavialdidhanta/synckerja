-- Read-only Inventory Summary for MCP. Column rules match
-- src/6-0-stock-management/summary/lib/inventorySummaryMath.ts:
-- beginning/ending subtract deltas that occur after the instant,
-- purchase_order includes production, sales includes recipe_consume,
-- and adjustment includes opening. Stored qty is already clamped at zero
-- by apply_catalog_stock_movement.

CREATE OR REPLACE FUNCTION public.mcp_list_inventory_summary(
  p_user_id uuid,
  p_organization_id uuid,
  p_outlet_id uuid,
  p_kind text,
  p_date_start text,
  p_date_end text,
  p_search text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_kind text;
  v_search text;
  v_like text;
  v_start timestamptz;
  v_end timestamptz;
  v_day date;
  v_outlet uuid;
  v_outlet_name text;
  v_total bigint;
  v_rows jsonb;
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

  v_kind := lower(btrim(COALESCE(p_kind, 'both')));
  IF v_kind NOT IN ('both', 'ingredients', 'item_library') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF (p_date_start IS NULL) <> (p_date_end IS NULL) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_date_start IS NULL THEN
    v_day := (timezone('Asia/Jakarta', clock_timestamp()))::date;
  ELSE
    IF btrim(p_date_start) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      OR btrim(p_date_end) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_day := btrim(p_date_start)::date;
      IF to_char(v_day, 'YYYY-MM-DD') <> btrim(p_date_start)
        OR to_char(btrim(p_date_end)::date, 'YYYY-MM-DD') <> btrim(p_date_end) THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END;
    IF btrim(p_date_end)::date < v_day OR (btrim(p_date_end)::date - v_day) > 365 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_day := btrim(p_date_start)::date;
  END IF;

  IF p_date_start IS NULL THEN
    v_start := v_day::timestamp AT TIME ZONE 'Asia/Jakarta';
    v_end := ((v_day + 1)::timestamp AT TIME ZONE 'Asia/Jakarta') - interval '1 millisecond';
  ELSE
    v_start := btrim(p_date_start)::date::timestamp AT TIME ZONE 'Asia/Jakarta';
    v_end := ((btrim(p_date_end)::date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta') - interval '1 millisecond';
  END IF;

  v_search := left(btrim(COALESCE(p_search, '')), 80);
  v_like := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  IF p_outlet_id IS NULL THEN
    SELECT outlet.id, outlet.name
    INTO v_outlet, v_outlet_name
    FROM public.pos_outlets outlet
    WHERE outlet.organization_id = p_organization_id
      AND outlet.is_deleted = false
      AND outlet.is_active = true
    ORDER BY outlet.is_default DESC, outlet.sort_order, outlet.created_at
    LIMIT 1;
  ELSE
    SELECT outlet.id, outlet.name
    INTO v_outlet, v_outlet_name
    FROM public.pos_outlets outlet
    WHERE outlet.id = p_outlet_id
      AND outlet.organization_id = p_organization_id
      AND outlet.is_deleted = false;
  END IF;

  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  WITH items AS (
    SELECT
      'ingredient'::text AS kind,
      i.name,
      NULL::text AS variant_name,
      COALESCE(cat.name, '') AS category,
      io.in_stock AS current_qty,
      NULL::uuid AS product_id,
      NULL::uuid AS variant_id,
      i.id AS ingredient_id
    FROM public.catalog_ingredients i
    JOIN public.catalog_ingredient_outlets io
      ON io.ingredient_id = i.id
     AND io.outlet_id = v_outlet
     AND io.organization_id = p_organization_id
    LEFT JOIN public.catalog_ingredient_categories cat
      ON cat.id = i.category_id
     AND cat.organization_id = i.organization_id
    WHERE i.organization_id = p_organization_id
      AND i.is_deleted = false
      AND i.track_inventory = true
      AND v_kind IN ('both', 'ingredients')

    UNION ALL

    SELECT
      'product'::text,
      dp.name,
      NULL::text,
      COALESCE(cat.name, ''),
      link.in_stock,
      dp.id,
      NULL::uuid,
      NULL::uuid
    FROM public.default_prices dp
    JOIN public.catalog_product_outlets link
      ON link.product_id = dp.id
     AND link.outlet_id = v_outlet
     AND link.organization_id = p_organization_id
    LEFT JOIN public.catalog_product_categories cat
      ON cat.id = dp.product_category_id
    WHERE dp.organization_id = p_organization_id
      AND dp.kind = 'product'
      AND dp.track_stock = true
      AND v_kind IN ('both', 'item_library')
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
      COALESCE(cat.name, ''),
      COALESCE(stock.in_stock, 0),
      dp.id,
      variant.id,
      NULL::uuid
    FROM public.default_prices dp
    JOIN public.catalog_product_outlets link
      ON link.product_id = dp.id
     AND link.outlet_id = v_outlet
     AND link.organization_id = p_organization_id
    JOIN public.catalog_product_variants variant
      ON variant.product_id = dp.id
     AND variant.organization_id = dp.organization_id
    LEFT JOIN public.catalog_product_variant_outlets stock
      ON stock.variant_id = variant.id
     AND stock.outlet_id = v_outlet
     AND stock.organization_id = p_organization_id
    LEFT JOIN public.catalog_product_categories cat
      ON cat.id = dp.product_category_id
    WHERE dp.organization_id = p_organization_id
      AND dp.kind = 'product'
      AND dp.track_stock = true
      AND v_kind IN ('both', 'item_library')
  ),
  scored AS (
    SELECT
      item.kind,
      item.name,
      item.variant_name,
      item.category,
      item.current_qty,
      item.current_qty - COALESCE(sums.after_start, 0) AS beginning,
      COALESCE(sums.purchase_order, 0) AS purchase_order,
      COALESCE(sums.sales, 0) AS sales,
      COALESCE(sums.transfer, 0) AS transfer,
      COALESCE(sums.adjustment, 0) AS adjustment,
      item.current_qty - COALESCE(sums.after_end, 0) AS ending
    FROM items item
    LEFT JOIN LATERAL (
      SELECT
        SUM(movement.qty_delta) FILTER (WHERE movement.occurred_at > v_start) AS after_start,
        SUM(movement.qty_delta) FILTER (WHERE movement.occurred_at > v_end) AS after_end,
        SUM(movement.qty_delta) FILTER (
          WHERE movement.occurred_at >= v_start
            AND movement.occurred_at <= v_end
            AND movement.movement_type IN ('purchase_order', 'production')
        ) AS purchase_order,
        SUM(movement.qty_delta) FILTER (
          WHERE movement.occurred_at >= v_start
            AND movement.occurred_at <= v_end
            AND movement.movement_type IN ('sale', 'recipe_consume')
        ) AS sales,
        SUM(movement.qty_delta) FILTER (
          WHERE movement.occurred_at >= v_start
            AND movement.occurred_at <= v_end
            AND movement.movement_type = 'transfer'
        ) AS transfer,
        SUM(movement.qty_delta) FILTER (
          WHERE movement.occurred_at >= v_start
            AND movement.occurred_at <= v_end
            AND movement.movement_type IN ('adjustment', 'opening')
        ) AS adjustment
      FROM public.catalog_stock_movements movement
      WHERE movement.organization_id = p_organization_id
        AND movement.outlet_id = v_outlet
        AND movement.item_kind = item.kind
        AND movement.product_id IS NOT DISTINCT FROM item.product_id
        AND movement.variant_id IS NOT DISTINCT FROM item.variant_id
        AND movement.ingredient_id IS NOT DISTINCT FROM item.ingredient_id
    ) sums ON true
    WHERE v_search = ''
      OR item.name ILIKE v_like ESCAPE '\'
      OR COALESCE(item.variant_name, '') ILIKE v_like ESCAPE '\'
      OR item.category ILIKE v_like ESCAPE '\'
  ),
  ranked AS (
    SELECT
      scored.*,
      COUNT(*) OVER () AS total,
      ROW_NUMBER() OVER (
        ORDER BY lower(scored.name), lower(COALESCE(scored.variant_name, '')), scored.kind
      ) AS rn
    FROM scored
  )
  SELECT
    COALESCE(MAX(ranked.total), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'kind', ranked.kind,
          'name', ranked.name,
          'variant_name', ranked.variant_name,
          'category', ranked.category,
          'current_qty', ranked.current_qty,
          'beginning', ranked.beginning,
          'purchase_order', ranked.purchase_order,
          'sales', ranked.sales,
          'transfer', ranked.transfer,
          'adjustment', ranked.adjustment,
          'ending', ranked.ending
        )
        ORDER BY ranked.rn
      ) FILTER (WHERE ranked.rn <= 200),
      '[]'::jsonb
    )
  INTO v_total, v_rows
  FROM ranked;

  RETURN jsonb_build_object(
    'outlet_id', v_outlet,
    'outlet_name', v_outlet_name,
    'period_start', v_start,
    'period_end', v_end,
    'truncated', v_total > 200,
    'rows', v_rows
  );
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_list_inventory_summary(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_inventory_summary(uuid, uuid, uuid, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_inventory_summary(uuid, uuid, uuid, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
