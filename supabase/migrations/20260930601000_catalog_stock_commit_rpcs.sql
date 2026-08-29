-- Shared catalog stock line processor + kitchen commit / reverse / fulfillment / reserve RPCs.

CREATE OR REPLACE FUNCTION public._apply_catalog_stock_lines(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_reference_type text,
  p_reference_prefix text,
  p_lines jsonb,
  p_scope text DEFAULT 'full'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line jsonb;
  v_product uuid;
  v_qty numeric;
  v_variant uuid;
  v_mod_ids uuid[];
  v_recipe record;
  v_tracked boolean;
  v_option_mapped uuid[];
  v_line_key text;
  v_ref_base text;
BEGIN
  IF p_scope NOT IN ('full', 'recipe_only', 'finished_goods_only') THEN
    RAISE EXCEPTION 'catalog_stock_scope_invalid';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_product := NULLIF(v_line ->> 'product_id', '')::uuid;
    v_qty := COALESCE((v_line ->> 'qty')::numeric, 0);
    v_variant := NULLIF(v_line ->> 'variant_id', '')::uuid;
    v_line_key := COALESCE(NULLIF(btrim(v_line ->> 'line_key'), ''), 'L1');

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

    v_ref_base := p_reference_prefix || ':' || v_line_key || ':' || v_product::text;

    IF p_scope IN ('full', 'finished_goods_only') THEN
      SELECT track_stock INTO v_tracked
      FROM public.default_prices
      WHERE id = v_product AND organization_id = p_organization_id;

      IF v_tracked IS TRUE THEN
        PERFORM public.apply_catalog_stock_movement(
          p_organization_id,
          p_outlet_id,
          'product',
          v_product,
          v_variant,
          NULL,
          'sale',
          -v_qty,
          p_reference_type,
          v_ref_base,
          'Product sale'
        );
      END IF;
    END IF;

    IF p_scope IN ('full', 'recipe_only') THEN
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
          p_outlet_id,
          'ingredient',
          NULL,
          NULL,
          v_recipe.ingredient_id,
          'recipe_consume',
          -(v_recipe.quantity * v_qty),
          p_reference_type,
          v_ref_base || ':ing:' || v_recipe.ingredient_id::text,
          'Recipe consume'
        );
      END LOOP;

      IF cardinality(v_mod_ids) > 0 THEN
        v_option_mapped := ARRAY[]::uuid[];

        FOR v_recipe IN
          SELECT moi.ingredient_id, moi.quantity, moi.option_id AS modifier_option_id
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
            p_outlet_id,
            'ingredient',
            NULL,
            NULL,
            v_recipe.ingredient_id,
            'recipe_consume',
            -(v_recipe.quantity * v_qty),
            p_reference_type,
            v_ref_base || ':mod:' || v_recipe.modifier_option_id::text || ':ing:' || v_recipe.ingredient_id::text,
            'modifier option ingredient consume'
          );
        END LOOP;

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
            p_outlet_id,
            'ingredient',
            NULL,
            NULL,
            v_recipe.ingredient_id,
            'recipe_consume',
            -(v_recipe.quantity * v_qty),
            p_reference_type,
            v_ref_base || ':mod:' || v_recipe.modifier_option_id::text || ':ing:' || v_recipe.ingredient_id::text,
            'modifier recipe consume'
          );
        END LOOP;
      END IF;
    END IF;
  END LOOP;
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
  v_line_idx integer := 0;
  v_line_key text;
  v_norm_lines jsonb := '[]'::jsonb;
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
    v_line_idx := v_line_idx + 1;
    v_line_key := COALESCE(NULLIF(btrim(v_line ->> 'line_key'), ''), 'L' || v_line_idx::text);
    v_norm_lines := v_norm_lines || jsonb_build_array(v_line || jsonb_build_object('line_key', v_line_key));
  END LOOP;

  PERFORM public._apply_catalog_stock_lines(
    p_organization_id,
    v_outlet,
    'store_checkout',
    p_activity_id,
    v_norm_lines,
    'full'
  );

  RETURN jsonb_build_object('ok', true, 'outlet_id', v_outlet);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_catalog_kitchen_commit_stock(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_session_id uuid,
  p_lines jsonb,
  p_commit_batch_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet uuid;
  v_line jsonb;
  v_batch text;
  v_line_fingerprint text;
  v_line_index integer;
  v_qty numeric;
  v_ref_prefix text;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'catalog_stock_session_required';
  END IF;

  v_outlet := p_outlet_id;
  IF v_outlet IS NULL THEN
    SELECT outlet_id INTO v_outlet
    FROM public.pos_table_sessions
    WHERE id = p_session_id AND organization_id = p_organization_id;
  END IF;
  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'catalog_stock_outlet_required';
  END IF;

  v_batch := COALESCE(NULLIF(btrim(p_commit_batch_id), ''), gen_random_uuid()::text);
  v_ref_prefix := p_session_id::text || ':' || v_batch;

  PERFORM public._apply_catalog_stock_lines(
    p_organization_id,
    v_outlet,
    'pos_kitchen_commit',
    v_ref_prefix,
    p_lines,
    'recipe_only'
  );

  FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_line_fingerprint := NULLIF(btrim(v_line ->> 'line_fingerprint'), '');
    v_line_index := GREATEST(1, COALESCE((v_line ->> 'line_index')::integer, 1));
    v_qty := COALESCE((v_line ->> 'qty')::numeric, 0);
    IF v_line_fingerprint IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.pos_session_stock_commits (
      organization_id,
      outlet_id,
      session_id,
      line_fingerprint,
      line_index,
      committed_qty,
      last_reference_id
    ) VALUES (
      p_organization_id,
      v_outlet,
      p_session_id,
      v_line_fingerprint,
      v_line_index,
      v_qty,
      v_ref_prefix
    )
    ON CONFLICT (session_id, line_fingerprint) DO UPDATE SET
      committed_qty = public.pos_session_stock_commits.committed_qty + EXCLUDED.committed_qty,
      line_index = EXCLUDED.line_index,
      last_reference_id = EXCLUDED.last_reference_id,
      last_committed_at = now(),
      updated_at = now();
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'outlet_id', v_outlet, 'batch_id', v_batch);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_catalog_kitchen_commit(
  p_organization_id uuid,
  p_session_id uuid,
  p_reverse_id text,
  p_lines jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet uuid;
  v_ref_prefix text;
  v_line jsonb;
  v_fp text;
  v_qty numeric;
  v_reverse_qty numeric;
  v_committed numeric;
  v_ratio numeric;
  v_mov record;
  v_reverse_ref text;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;
  IF p_session_id IS NULL OR p_reverse_id IS NULL OR btrim(p_reverse_id) = '' THEN
    RAISE EXCEPTION 'catalog_stock_reverse_ref_required';
  END IF;

  v_ref_prefix := p_session_id::text || ':reverse:' || p_reverse_id;

  IF EXISTS (
    SELECT 1
    FROM public.catalog_stock_movements
    WHERE organization_id = p_organization_id
      AND reference_type = 'pos_kitchen_reverse'
      AND reference_id LIKE v_ref_prefix || ':%'
  ) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'duplicate');
  END IF;

  SELECT outlet_id INTO v_outlet
  FROM public.pos_table_sessions
  WHERE id = p_session_id AND organization_id = p_organization_id;
  IF v_outlet IS NULL THEN
    SELECT outlet_id INTO v_outlet
    FROM public.pos_session_stock_commits
    WHERE session_id = p_session_id AND organization_id = p_organization_id
    LIMIT 1;
  END IF;

  IF p_lines IS NOT NULL AND jsonb_array_length(p_lines) > 0 THEN
    FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
      v_fp := NULLIF(btrim(v_line ->> 'line_fingerprint'), '');
      v_qty := COALESCE((v_line ->> 'qty')::numeric, 0);
      IF v_fp IS NULL OR v_qty <= 0 THEN
        CONTINUE;
      END IF;

      SELECT committed_qty INTO v_committed
      FROM public.pos_session_stock_commits
      WHERE session_id = p_session_id AND line_fingerprint = v_fp
      FOR UPDATE;

      IF NOT FOUND OR v_committed <= 0 THEN
        CONTINUE;
      END IF;

      v_reverse_qty := LEAST(v_qty, v_committed);
      v_ratio := v_reverse_qty / v_committed;

      FOR v_mov IN
        SELECT m.*
        FROM public.catalog_stock_movements m
        JOIN public.pos_session_stock_commits c
          ON c.session_id = p_session_id
         AND c.line_fingerprint = v_fp
        WHERE m.organization_id = p_organization_id
          AND m.reference_type = 'pos_kitchen_commit'
          AND m.reference_id LIKE c.last_reference_id || ':%'
      LOOP
        v_reverse_ref := v_ref_prefix || ':' || v_mov.reference_id;
        PERFORM public.apply_catalog_stock_movement(
          p_organization_id,
          v_outlet,
          v_mov.item_kind,
          v_mov.product_id,
          v_mov.variant_id,
          v_mov.ingredient_id,
          'adjustment',
          ROUND(-v_mov.qty_delta * v_ratio, 3),
          'pos_kitchen_reverse',
          v_reverse_ref,
          'Kitchen commit reverse'
        );
      END LOOP;

      UPDATE public.pos_session_stock_commits
      SET
        committed_qty = GREATEST(0, committed_qty - v_reverse_qty),
        updated_at = now()
      WHERE session_id = p_session_id AND line_fingerprint = v_fp;
    END LOOP;
  ELSE
    FOR v_mov IN
      SELECT m.*
      FROM public.catalog_stock_movements m
      WHERE m.organization_id = p_organization_id
        AND m.reference_type = 'pos_kitchen_commit'
        AND m.reference_id LIKE p_session_id::text || ':%'
    LOOP
      v_reverse_ref := v_ref_prefix || ':' || v_mov.reference_id;
      PERFORM public.apply_catalog_stock_movement(
        p_organization_id,
        v_outlet,
        v_mov.item_kind,
        v_mov.product_id,
        v_mov.variant_id,
        v_mov.ingredient_id,
        'adjustment',
        -v_mov.qty_delta,
        'pos_kitchen_reverse',
        v_reverse_ref,
        'Kitchen commit reverse all'
      );
    END LOOP;

    UPDATE public.pos_session_stock_commits
    SET committed_qty = 0, updated_at = now()
    WHERE session_id = p_session_id AND organization_id = p_organization_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_catalog_fulfillment_stock(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_session_id uuid,
  p_lines jsonb,
  p_fulfillment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outlet uuid;
  v_batch text;
  v_ref_prefix text;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;

  v_outlet := p_outlet_id;
  IF v_outlet IS NULL AND p_session_id IS NOT NULL THEN
    SELECT outlet_id INTO v_outlet
    FROM public.pos_table_sessions
    WHERE id = p_session_id AND organization_id = p_organization_id;
  END IF;
  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'catalog_stock_outlet_required';
  END IF;

  v_batch := COALESCE(NULLIF(btrim(p_fulfillment_id), ''), gen_random_uuid()::text);
  v_ref_prefix := COALESCE(p_session_id::text, v_batch) || ':fulfill:' || v_batch;

  PERFORM public._apply_catalog_stock_lines(
    p_organization_id,
    v_outlet,
    'pos_fulfillment',
    v_ref_prefix,
    p_lines,
    'finished_goods_only'
  );

  RETURN jsonb_build_object('ok', true, 'outlet_id', v_outlet, 'fulfillment_id', v_batch);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_catalog_stock_reserve(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_session_id uuid,
  p_lines jsonb,
  p_reserve_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line jsonb;
  v_product uuid;
  v_variant uuid;
  v_qty numeric;
  v_reserve text;
  v_ref text;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;
  IF p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'catalog_stock_outlet_required';
  END IF;

  v_reserve := COALESCE(NULLIF(btrim(p_reserve_id), ''), gen_random_uuid()::text);
  v_ref := COALESCE(p_session_id::text, v_reserve) || ':reserve:' || v_reserve;

  FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_product := NULLIF(v_line ->> 'product_id', '')::uuid;
    v_variant := NULLIF(v_line ->> 'variant_id', '')::uuid;
    v_qty := COALESCE((v_line ->> 'qty')::numeric, 0);
    IF v_product IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF v_variant IS NOT NULL THEN
      UPDATE public.catalog_product_variant_outlets
      SET reserved_qty = reserved_qty + v_qty
      WHERE variant_id = v_variant AND outlet_id = p_outlet_id;
    ELSE
      UPDATE public.catalog_product_outlets
      SET reserved_qty = reserved_qty + v_qty
      WHERE product_id = v_product AND outlet_id = p_outlet_id;
    END IF;

    PERFORM public.apply_catalog_stock_movement(
      p_organization_id,
      p_outlet_id,
      'product',
      v_product,
      v_variant,
      NULL,
      'reserve',
      0,
      'pos_stock_reserve',
      v_ref || ':' || v_product::text,
      'Stock reserve'
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'reserve_id', v_reserve);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_catalog_stock_reserve(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_session_id uuid,
  p_lines jsonb,
  p_release_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line jsonb;
  v_product uuid;
  v_variant uuid;
  v_qty numeric;
  v_release text;
  v_ref text;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;

  v_release := COALESCE(NULLIF(btrim(p_release_id), ''), gen_random_uuid()::text);
  v_ref := COALESCE(p_session_id::text, v_release) || ':release:' || v_release;

  FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_product := NULLIF(v_line ->> 'product_id', '')::uuid;
    v_variant := NULLIF(v_line ->> 'variant_id', '')::uuid;
    v_qty := COALESCE((v_line ->> 'qty')::numeric, 0);
    IF v_product IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF v_variant IS NOT NULL THEN
      UPDATE public.catalog_product_variant_outlets
      SET reserved_qty = GREATEST(0, reserved_qty - v_qty)
      WHERE variant_id = v_variant AND outlet_id = p_outlet_id;
    ELSE
      UPDATE public.catalog_product_outlets
      SET reserved_qty = GREATEST(0, reserved_qty - v_qty)
      WHERE product_id = v_product AND outlet_id = p_outlet_id;
    END IF;

    PERFORM public.apply_catalog_stock_movement(
      p_organization_id,
      p_outlet_id,
      'product',
      v_product,
      v_variant,
      NULL,
      'release',
      0,
      'pos_stock_reserve',
      v_ref || ':' || v_product::text,
      'Stock reserve release'
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'release_id', v_release);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_store_checkout_stock(
  p_organization_id uuid,
  p_activity_id text,
  p_reverse_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov record;
  v_ref_prefix text;
  v_reverse_ref text;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;
  IF p_activity_id IS NULL OR btrim(p_activity_id) = '' THEN
    RAISE EXCEPTION 'catalog_stock_activity_required';
  END IF;

  v_ref_prefix := p_activity_id || ':reverse:' || COALESCE(NULLIF(btrim(p_reverse_id), ''), gen_random_uuid()::text);

  IF EXISTS (
    SELECT 1
    FROM public.catalog_stock_movements
    WHERE organization_id = p_organization_id
      AND reference_type = 'store_checkout_reverse'
      AND reference_id LIKE v_ref_prefix || ':%'
  ) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'duplicate');
  END IF;

  FOR v_mov IN
    SELECT *
    FROM public.catalog_stock_movements
    WHERE organization_id = p_organization_id
      AND reference_type = 'store_checkout'
      AND reference_id LIKE p_activity_id || ':%'
  LOOP
    v_reverse_ref := v_ref_prefix || ':' || v_mov.reference_id;
    PERFORM public.apply_catalog_stock_movement(
      p_organization_id,
      v_mov.outlet_id,
      v_mov.item_kind,
      v_mov.product_id,
      v_mov.variant_id,
      v_mov.ingredient_id,
      'adjustment',
      -v_mov.qty_delta,
      'store_checkout_reverse',
      v_reverse_ref,
      'Checkout stock rollback'
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_catalog_kitchen_commit_stock(
  uuid, uuid, uuid, jsonb, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.reverse_catalog_kitchen_commit(
  uuid, uuid, text, jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.apply_catalog_fulfillment_stock(
  uuid, uuid, uuid, jsonb, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.apply_catalog_stock_reserve(
  uuid, uuid, uuid, jsonb, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.release_catalog_stock_reserve(
  uuid, uuid, uuid, jsonb, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.reverse_store_checkout_stock(
  uuid, text, text
) TO authenticated;

COMMENT ON FUNCTION public.apply_catalog_kitchen_commit_stock IS
  'Kitchen print: deduct recipe ingredients (delta). Updates pos_session_stock_commits.';

COMMENT ON FUNCTION public.reverse_catalog_kitchen_commit IS
  'Reverse kitchen commits for void/cancel. Partial via p_lines [{line_fingerprint, qty, product_id...}].';
