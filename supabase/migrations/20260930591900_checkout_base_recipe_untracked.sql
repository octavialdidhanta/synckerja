-- Base product recipe consume on checkout even when track_stock = false (menu/F&B).
-- Finished-goods product sale still only when track_stock = true.

CREATE OR REPLACE FUNCTION public.apply_catalog_checkout_stock(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_activity_id text,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet uuid;
  v_line jsonb;
  v_product uuid;
  v_qty numeric;
  v_variant uuid;
  v_mod_ids uuid[];
  v_recipe record;
  v_tracked boolean;
  v_option_mapped uuid[];
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;
  IF p_activity_id IS NULL OR btrim(p_activity_id) = '' THEN
    RAISE EXCEPTION 'catalog_stock_activity_required';
  END IF;

  v_outlet := p_outlet_id;
  IF v_outlet IS NULL THEN
    SELECT id INTO v_outlet
    FROM public.pos_outlets
    WHERE organization_id = p_organization_id
    ORDER BY is_default DESC, sort_order, created_at
    LIMIT 1;
  END IF;
  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'catalog_stock_outlet_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.catalog_stock_movements
    WHERE organization_id = p_organization_id
      AND reference_type = 'store_checkout'
      AND reference_id LIKE p_activity_id || ':%'
  ) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'duplicate');
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_product := NULLIF(v_line ->> 'product_id', '')::uuid;
    v_qty := COALESCE((v_line ->> 'qty')::numeric, 0);
    v_variant := NULLIF(v_line ->> 'variant_id', '')::uuid;
    SELECT COALESCE(array_agg(DISTINCT x.opt_id), ARRAY[]::uuid[])
      INTO v_mod_ids
    FROM (
      SELECT NULLIF(elem #>> '{}', '')::uuid AS opt_id
      FROM jsonb_array_elements(COALESCE(v_line -> 'modifier_option_ids', '[]'::jsonb)) AS elem
    ) x
    WHERE x.opt_id IS NOT NULL;

    IF v_product IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT track_stock INTO v_tracked
    FROM public.default_prices
    WHERE id = v_product AND organization_id = p_organization_id;

    -- Finished goods: only when product inventory is tracked
    IF v_tracked IS TRUE THEN
      PERFORM public.apply_catalog_stock_movement(
        p_organization_id,
        v_outlet,
        'product',
        v_product,
        v_variant,
        NULL,
        'sale',
        -v_qty,
        'store_checkout',
        p_activity_id || ':' || v_product::text,
        'POS sale'
      );
    END IF;

    -- Base recipe ingredients: retail and menu (independent of track_stock)
    FOR v_recipe IN
      SELECT l.ingredient_id, l.quantity, NULL::uuid AS modifier_option_id
      FROM public.catalog_product_recipes r
      JOIN public.catalog_product_recipe_lines l ON l.recipe_id = r.id
      JOIN public.catalog_ingredients i ON i.id = l.ingredient_id
      WHERE r.product_id = v_product
        AND r.modifier_option_id IS NULL
        AND i.track_inventory = true
        AND i.is_deleted = false
    LOOP
      PERFORM public.apply_catalog_stock_movement(
        p_organization_id,
        v_outlet,
        'ingredient',
        NULL,
        NULL,
        v_recipe.ingredient_id,
        'recipe_consume',
        -(v_recipe.quantity * v_qty),
        'store_checkout',
        p_activity_id || ':' || v_product::text || ':ing:' || v_recipe.ingredient_id::text,
        'Recipe consume'
      );
    END LOOP;

    -- Modifier option BOM (stock_enabled groups only)
    IF cardinality(v_mod_ids) > 0 THEN
      v_option_mapped := ARRAY[]::uuid[];

      FOR v_recipe IN
        SELECT
          moi.ingredient_id,
          moi.quantity,
          moi.option_id AS modifier_option_id
        FROM public.catalog_modifier_option_ingredients moi
        JOIN public.catalog_modifier_options o ON o.id = moi.option_id
        JOIN public.catalog_modifier_groups g ON g.id = o.group_id
        JOIN public.catalog_ingredients i ON i.id = moi.ingredient_id
        WHERE moi.option_id = ANY (v_mod_ids)
          AND g.stock_enabled IS TRUE
          AND g.organization_id = p_organization_id
          AND i.track_inventory = true
          AND i.is_deleted = false
      LOOP
        v_option_mapped := array_append(v_option_mapped, v_recipe.modifier_option_id);
        PERFORM public.apply_catalog_stock_movement(
          p_organization_id,
          v_outlet,
          'ingredient',
          NULL,
          NULL,
          v_recipe.ingredient_id,
          'recipe_consume',
          -(v_recipe.quantity * v_qty),
          'store_checkout',
          p_activity_id
            || ':' || v_product::text
            || ':mod:' || v_recipe.modifier_option_id::text
            || ':ing:' || v_recipe.ingredient_id::text,
          'Modifier option ingredient consume'
        );
      END LOOP;

      -- Legacy fallback: product+modifier recipes for options without option-level BOM
      FOR v_recipe IN
        SELECT l.ingredient_id, l.quantity, r.modifier_option_id
        FROM public.catalog_product_recipes r
        JOIN public.catalog_product_recipe_lines l ON l.recipe_id = r.id
        JOIN public.catalog_ingredients i ON i.id = l.ingredient_id
        JOIN public.catalog_modifier_options o ON o.id = r.modifier_option_id
        JOIN public.catalog_modifier_groups g ON g.id = o.group_id
        WHERE r.product_id = v_product
          AND r.modifier_option_id = ANY (v_mod_ids)
          AND g.stock_enabled IS TRUE
          AND NOT (r.modifier_option_id = ANY (v_option_mapped))
          AND i.track_inventory = true
          AND i.is_deleted = false
      LOOP
        PERFORM public.apply_catalog_stock_movement(
          p_organization_id,
          v_outlet,
          'ingredient',
          NULL,
          NULL,
          v_recipe.ingredient_id,
          'recipe_consume',
          -(v_recipe.quantity * v_qty),
          'store_checkout',
          p_activity_id
            || ':' || v_product::text
            || ':mod:' || v_recipe.modifier_option_id::text
            || ':ing:' || v_recipe.ingredient_id::text,
          'Modifier recipe consume'
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'outlet_id', v_outlet);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_catalog_checkout_stock(
  uuid, uuid, text, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.apply_catalog_checkout_stock(uuid, uuid, text, jsonb) IS
  'Deduct finished goods when track_stock; always consume base recipe ingredients; plus stock_enabled modifier option BOM / product-recipe fallback.';
