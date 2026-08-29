-- Checkout stock: per-line stock_scope + idempotency per activity_id + line_key.

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
  v_scope text;
  v_applied integer := 0;
  v_skipped integer := 0;
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

  FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_line_idx := v_line_idx + 1;
    v_line_key := COALESCE(NULLIF(btrim(v_line ->> 'line_key'), ''), 'L' || v_line_idx::text);
    v_scope := COALESCE(NULLIF(btrim(v_line ->> 'stock_scope'), ''), 'full');
    IF v_scope NOT IN ('full', 'recipe_only', 'finished_goods_only') THEN
      v_scope := 'full';
    END IF;

    -- Idempotent per activity + line_key (allows mixed scopes in one checkout).
    IF EXISTS (
      SELECT 1
      FROM public.catalog_stock_movements
      WHERE organization_id = p_organization_id
        AND reference_type = 'store_checkout'
        AND reference_id LIKE p_activity_id || ':' || v_line_key || ':%'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    PERFORM public._apply_catalog_stock_lines(
      p_organization_id,
      v_outlet,
      'store_checkout',
      p_activity_id,
      jsonb_build_array(v_line || jsonb_build_object('line_key', v_line_key)),
      v_scope
    );
    v_applied := v_applied + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'outlet_id', v_outlet,
    'applied', v_applied,
    'skipped', v_skipped
  );
END;
$$;

COMMENT ON FUNCTION public.apply_catalog_checkout_stock IS
  'Checkout stock deduct. Optional per-line stock_scope (full|recipe_only|finished_goods_only). Idempotent per activity_id+line_key.';
