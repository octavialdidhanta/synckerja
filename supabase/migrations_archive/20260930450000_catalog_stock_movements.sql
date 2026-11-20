-- Outlet-scoped catalog stock ledger for Item Library + Ingredients.
-- POS checkout and library opening/adjustment write via RPCs.

CREATE TABLE IF NOT EXISTS public.catalog_stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  item_kind text NOT NULL,
  product_id uuid REFERENCES public.default_prices (id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.catalog_product_variants (id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.catalog_ingredients (id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  qty_delta numeric(14, 3) NOT NULL,
  qty_after numeric(14, 3) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reference_type text,
  reference_id text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_stock_movements_kind_check CHECK (item_kind IN ('product', 'ingredient')),
  CONSTRAINT catalog_stock_movements_type_check CHECK (
    movement_type IN ('opening', 'purchase_order', 'sale', 'transfer', 'adjustment', 'recipe_consume')
  ),
  CONSTRAINT catalog_stock_movements_item_check CHECK (
    (
      item_kind = 'product'
      AND product_id IS NOT NULL
      AND ingredient_id IS NULL
    )
    OR (
      item_kind = 'ingredient'
      AND ingredient_id IS NOT NULL
      AND product_id IS NULL
      AND variant_id IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_stock_movements_org_outlet_time
  ON public.catalog_stock_movements (organization_id, outlet_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_stock_movements_item
  ON public.catalog_stock_movements (organization_id, outlet_id, item_kind, product_id, variant_id, ingredient_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_stock_movements_idempotent
  ON public.catalog_stock_movements (
    organization_id,
    outlet_id,
    item_kind,
    COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(ingredient_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(reference_type, ''),
    COALESCE(reference_id, '')
  )
  WHERE reference_id IS NOT NULL;

ALTER TABLE public.catalog_stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_stock_movements_org_select" ON public.catalog_stock_movements;
CREATE POLICY "catalog_stock_movements_org_select"
  ON public.catalog_stock_movements FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

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
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
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
  v_recipe record;
  v_tracked boolean;
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
    IF v_product IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT track_stock INTO v_tracked
    FROM public.default_prices
    WHERE id = v_product AND organization_id = p_organization_id;
    IF v_tracked IS NOT TRUE THEN
      CONTINUE;
    END IF;

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

    FOR v_recipe IN
      SELECT l.ingredient_id, l.quantity
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
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'outlet_id', v_outlet);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_catalog_stock_movement(
  uuid, uuid, text, uuid, uuid, uuid, text, numeric, text, text, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.apply_catalog_checkout_stock(
  uuid, uuid, text, jsonb
) TO authenticated;
