-- MCP: read-only HPP (cost of goods) per menu item for one outlet.
--
-- Mirrors the POS checkout snapshot (src/5-2-customer-visits/checkout/lib/
-- resolveCheckoutLineUnitCogs.ts):
--   1. finished-goods avg_cost when the product (or variant) tracks COGS,
--   2. else the base recipe (modifier_option_id IS NULL): sum(quantity × ingredient avg_cost)
--      counting only ingredients that track COGS at this outlet,
--   3. if that sum is 0, POS records no HPP (cogs_source = 'none').
-- Selling price mirrors effectiveUnitPrice: outlet override, else default price.
--
-- p_cost_overrides is a what-if: [{ "ingredient": "<exact name>", "unit_cost": <number> }].
-- It changes only this calculation; nothing is written.

CREATE OR REPLACE FUNCTION public.mcp_list_recipe_costs(
  p_user_id uuid,
  p_organization_id uuid,
  p_outlet_id uuid,
  p_search text,
  p_cost_overrides jsonb,
  p_only text,
  p_max_margin_pct numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_outlet uuid;
  v_outlet_name text;
  v_search text;
  v_like text;
  v_only text := COALESCE(NULLIF(btrim(COALESCE(p_only, '')), ''), 'all');
  v_overrides jsonb := COALESCE(p_cost_overrides, '[]'::jsonb);
  v_override record;
  v_cost numeric;
  v_ing_id uuid;
  v_ing_name text;
  v_prev numeric;
  v_map jsonb := '{}'::jsonb;
  v_applied jsonb := '[]'::jsonb;
  v_not_found jsonb := '[]'::jsonb;
  v_result jsonb;
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

  IF v_only NOT IN ('all', 'with_recipe', 'without_recipe', 'incomplete') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF p_max_margin_pct IS NOT NULL AND (p_max_margin_pct < -1000 OR p_max_margin_pct > 100) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_overrides) <> 'array' OR jsonb_array_length(v_overrides) > 30 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
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

  -- What-if overrides by exact ingredient name → {ingredient_id: unit_cost}.
  FOR v_override IN
    SELECT btrim(COALESCE(elem ->> 'ingredient', '')) AS name, elem -> 'unit_cost' AS cost
    FROM jsonb_array_elements(v_overrides) elem
  LOOP
    IF v_override.name = '' OR char_length(v_override.name) > 120
      OR v_override.cost IS NULL OR jsonb_typeof(v_override.cost) <> 'number' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    v_cost := (v_override.cost)::text::numeric;
    IF v_cost < 0 OR v_cost > 999999999999.99 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    v_ing_id := NULL;
    SELECT i.id, i.name,
           CASE WHEN COALESCE(io.track_cogs, false) THEN COALESCE(io.avg_cost, 0) ELSE 0 END
      INTO v_ing_id, v_ing_name, v_prev
    FROM public.catalog_ingredients i
    LEFT JOIN public.catalog_ingredient_outlets io
      ON io.ingredient_id = i.id AND io.outlet_id = v_outlet AND io.organization_id = p_organization_id
    WHERE i.organization_id = p_organization_id
      AND i.is_deleted = false
      AND lower(btrim(i.name)) = lower(v_override.name)
    LIMIT 1;

    IF v_ing_id IS NULL THEN
      v_not_found := v_not_found || to_jsonb(v_override.name);
    ELSE
      v_map := v_map || jsonb_build_object(v_ing_id::text, v_cost);
      v_applied := v_applied || jsonb_build_object(
        'ingredient', v_ing_name, 'unit_cost', v_cost, 'previous_unit_cost', v_prev
      );
    END IF;
  END LOOP;

  WITH ing AS (
    -- Ingredient cost at this outlet exactly as POS reads it, plus what-if overrides.
    SELECT
      i.id AS ingredient_id,
      i.name,
      i.kind,
      i.unit_code,
      (ov.cost IS NOT NULL OR COALESCE(io.track_cogs, false)) AS track_cogs,
      COALESCE(ov.cost, CASE WHEN COALESCE(io.track_cogs, false) THEN COALESCE(io.avg_cost, 0) ELSE 0 END) AS unit_cost,
      (ov.cost IS NOT NULL) AS overridden
    FROM public.catalog_ingredients i
    LEFT JOIN public.catalog_ingredient_outlets io
      ON io.ingredient_id = i.id AND io.outlet_id = v_outlet AND io.organization_id = p_organization_id
    LEFT JOIN LATERAL (SELECT (v_map ->> i.id::text)::numeric AS cost) ov ON true
    WHERE i.organization_id = p_organization_id
  ),
  products AS (
    SELECT
      dp.id,
      dp.name,
      cat.name AS category,
      COALESCE(link.unit_price, dp.unit_price) AS selling_price,
      CASE WHEN link.unit_price IS NOT NULL THEN 'outlet' ELSE 'default' END AS price_source,
      COALESCE(dp.use_sales_type_prices, false) AS uses_sales_type_prices,
      COALESCE(link.track_cogs, false) AS fg_track,
      COALESCE(link.avg_cost, 0) AS fg_cost,
      COALESCE(link.pos_status, dp.pos_status) AS pos_status
    FROM public.default_prices dp
    JOIN public.catalog_product_outlets link
      ON link.product_id = dp.id
     AND link.outlet_id = v_outlet
     AND link.organization_id = p_organization_id
    LEFT JOIN public.catalog_product_categories cat ON cat.id = dp.product_category_id
    WHERE dp.organization_id = p_organization_id
      AND dp.kind = 'product'
      AND (v_search = '' OR dp.name ILIKE v_like)
  ),
  base_lines AS (
    SELECT
      r.product_id,
      rl.sort_order,
      c.name AS ingredient,
      c.kind AS ingredient_kind,
      c.unit_code,
      rl.quantity,
      c.unit_cost,
      (c.track_cogs AND c.unit_cost > 0) AS has_cost,
      CASE WHEN c.track_cogs THEN rl.quantity * c.unit_cost ELSE 0 END AS line_cost,
      c.overridden
    FROM public.catalog_product_recipes r
    JOIN public.catalog_product_recipe_lines rl ON rl.recipe_id = r.id
    JOIN ing c ON c.ingredient_id = rl.ingredient_id
    WHERE r.organization_id = p_organization_id
      AND r.modifier_option_id IS NULL
      AND r.product_id IN (SELECT id FROM products)
  ),
  recipe_summary AS (
    SELECT
      product_id,
      SUM(line_cost) AS bom,
      count(*) AS line_count,
      COALESCE(jsonb_agg(ingredient ORDER BY ingredient) FILTER (WHERE NOT has_cost), '[]'::jsonb) AS missing,
      jsonb_agg(jsonb_build_object(
        'ingredient', ingredient,
        'ingredient_kind', ingredient_kind,
        'unit_code', unit_code,
        'quantity', quantity,
        'unit_cost', unit_cost,
        'has_cost', has_cost,
        'line_cost', round(line_cost, 2),
        'what_if', overridden
      ) ORDER BY sort_order, ingredient) AS lines
    FROM base_lines
    GROUP BY product_id
  ),
  option_lines AS (
    -- Modifier add-ons: the option's own ingredients first, else the product's recipe for that option (POS order).
    SELECT pm.product_id, opt.id AS option_id, opt.name AS option_name, grp.name AS group_name,
           COALESCE(opt.extra_price, 0) AS extra_price, src.ingredient_id, src.quantity
    FROM public.catalog_product_modifiers pm
    JOIN public.catalog_modifier_options opt
      ON opt.group_id = pm.group_id AND opt.organization_id = p_organization_id AND COALESCE(opt.is_active, true)
    LEFT JOIN public.catalog_modifier_groups grp ON grp.id = pm.group_id
    JOIN LATERAL (
      SELECT moi.ingredient_id, moi.quantity
      FROM public.catalog_modifier_option_ingredients moi
      WHERE moi.option_id = opt.id AND moi.organization_id = p_organization_id
      UNION ALL
      SELECT rl.ingredient_id, rl.quantity
      FROM public.catalog_product_recipes r
      JOIN public.catalog_product_recipe_lines rl ON rl.recipe_id = r.id
      WHERE r.product_id = pm.product_id
        AND r.modifier_option_id = opt.id
        AND r.organization_id = p_organization_id
        AND NOT EXISTS (
          SELECT 1 FROM public.catalog_modifier_option_ingredients moi2
          WHERE moi2.option_id = opt.id AND moi2.organization_id = p_organization_id
        )
    ) src ON true
    WHERE pm.organization_id = p_organization_id
      AND pm.product_id IN (SELECT id FROM products)
  ),
  add_ons AS (
    SELECT
      ol.product_id,
      jsonb_agg(jsonb_build_object(
        'option', ol.option_name,
        'group', ol.group_name,
        'extra_price', ol.extra_price,
        'extra_cost', round(ol.cost, 2),
        'missing_cost_ingredients', ol.missing
      ) ORDER BY ol.group_name, ol.option_name) AS items
    FROM (
      SELECT o.product_id, o.option_id, o.option_name, o.group_name, o.extra_price,
             SUM(CASE WHEN c.track_cogs THEN o.quantity * c.unit_cost ELSE 0 END) AS cost,
             COALESCE(jsonb_agg(c.name ORDER BY c.name) FILTER (WHERE NOT (c.track_cogs AND c.unit_cost > 0)), '[]'::jsonb) AS missing
      FROM option_lines o
      JOIN ing c ON c.ingredient_id = o.ingredient_id
      GROUP BY o.product_id, o.option_id, o.option_name, o.group_name, o.extra_price
    ) ol
    GROUP BY ol.product_id
  ),
  variants AS (
    SELECT v.product_id,
           jsonb_agg(jsonb_build_object(
             'name', v.name,
             'price', v.price,
             'finished_goods_cost', CASE WHEN COALESCE(vo.track_cogs, false) THEN round(COALESCE(vo.avg_cost, 0), 2) END
           ) ORDER BY v.sort_order, v.name) AS items
    FROM public.catalog_product_variants v
    LEFT JOIN public.catalog_product_variant_outlets vo
      ON vo.variant_id = v.id AND vo.outlet_id = v_outlet AND vo.organization_id = p_organization_id
    WHERE v.organization_id = p_organization_id
      AND v.product_id IN (SELECT id FROM products)
    GROUP BY v.product_id
  ),
  priced AS (
    SELECT
      p.*,
      rs.bom,
      COALESCE(rs.line_count, 0) AS line_count,
      COALESCE(rs.missing, '[]'::jsonb) AS missing,
      COALESCE(rs.lines, '[]'::jsonb) AS lines,
      COALESCE(a.items, '[]'::jsonb) AS add_ons,
      COALESCE(v.items, '[]'::jsonb) AS variants,
      CASE
        WHEN p.fg_track THEN 'finished_goods'
        WHEN COALESCE(rs.bom, 0) > 0 THEN 'recipe_bom'
        ELSE 'none'
      END AS cogs_source
    FROM products p
    LEFT JOIN recipe_summary rs ON rs.product_id = p.id
    LEFT JOIN add_ons a ON a.product_id = p.id
    LEFT JOIN variants v ON v.product_id = p.id
  ),
  shaped AS (
    SELECT
      x.*,
      CASE WHEN x.hpp IS NOT NULL THEN round(x.selling_price - x.hpp, 2) END AS margin,
      CASE WHEN x.hpp IS NOT NULL AND x.selling_price > 0
           THEN round((x.selling_price - x.hpp) / x.selling_price * 100, 1) END AS margin_pct,
      CASE WHEN x.hpp IS NOT NULL AND x.selling_price > 0
           THEN round(x.hpp / x.selling_price * 100, 1) END AS hpp_pct
    FROM (
      SELECT
        pr.*,
        CASE
          WHEN pr.cogs_source = 'finished_goods' THEN round(pr.fg_cost, 2)
          WHEN pr.cogs_source = 'recipe_bom' THEN round(pr.bom, 2)
        END AS hpp,
        (pr.line_count > 0) AS has_recipe,
        (pr.line_count > 0 AND jsonb_array_length(pr.missing) > 0) AS incomplete
      FROM priced pr
    ) x
  ),
  filtered AS (
    SELECT * FROM shaped s
    WHERE (v_only = 'all'
        OR (v_only = 'with_recipe' AND s.has_recipe)
        OR (v_only = 'without_recipe' AND NOT s.has_recipe AND s.cogs_source <> 'finished_goods')
        OR (v_only = 'incomplete' AND s.incomplete))
      AND (p_max_margin_pct IS NULL OR (s.margin_pct IS NOT NULL AND s.margin_pct <= p_max_margin_pct))
  ),
  page AS (
    SELECT * FROM filtered
    ORDER BY
      CASE WHEN p_max_margin_pct IS NOT NULL THEN margin_pct END ASC NULLS LAST,
      lower(name)
    LIMIT 100
  )
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'menu_items', count(*),
        'with_recipe', count(*) FILTER (WHERE has_recipe),
        'without_recipe', count(*) FILTER (WHERE NOT has_recipe AND cogs_source <> 'finished_goods'),
        'finished_goods_costed', count(*) FILTER (WHERE cogs_source = 'finished_goods'),
        'incomplete_recipes', count(*) FILTER (WHERE incomplete),
        'no_hpp_in_pos', count(*) FILTER (WHERE cogs_source = 'none')
      ) FROM shaped
    ),
    'matched', (SELECT count(*) FROM filtered),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', pg.name,
        'category', pg.category,
        'selling_price', pg.selling_price,
        'price_source', pg.price_source,
        'uses_sales_type_prices', pg.uses_sales_type_prices,
        'pos_status', pg.pos_status,
        'cogs_source', pg.cogs_source,
        'hpp', pg.hpp,
        'hpp_pct', pg.hpp_pct,
        'margin', pg.margin,
        'margin_pct', pg.margin_pct,
        'has_recipe', pg.has_recipe,
        'recipe_cost', CASE WHEN pg.has_recipe THEN round(COALESCE(pg.bom, 0), 2) END,
        'missing_cost_ingredients', pg.missing,
        'lines', pg.lines,
        'add_ons', pg.add_ons,
        'variants', pg.variants
      ) ORDER BY
        CASE WHEN p_max_margin_pct IS NOT NULL THEN pg.margin_pct END ASC NULLS LAST,
        lower(pg.name))
      FROM page pg
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result || jsonb_build_object(
    'outlet_id', v_outlet,
    'outlet_name', v_outlet_name,
    'search', NULLIF(v_search, ''),
    'only', v_only,
    'max_margin_pct', p_max_margin_pct,
    'what_if', jsonb_array_length(v_applied) > 0,
    'cost_overrides_applied', v_applied,
    'cost_overrides_not_found', v_not_found,
    'truncated', (v_result ->> 'matched')::int > 100
  );
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_list_recipe_costs(uuid, uuid, uuid, text, jsonb, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_recipe_costs(uuid, uuid, uuid, text, jsonb, text, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
