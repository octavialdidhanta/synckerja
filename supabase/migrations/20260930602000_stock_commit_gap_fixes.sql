-- Gap fixes: multi-batch kitchen reverse, session reserve ledger, delta reserve/release.

-- ---------------------------------------------------------------------------
-- Session reserve ledger (fulfillment delta tracking)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pos_session_stock_reserves (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.pos_table_sessions (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.default_prices (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  reserved_qty numeric(14, 3) NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  last_reference_id text NOT NULL DEFAULT '',
  last_reserved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_session_stock_reserves_pkey PRIMARY KEY (id),
  CONSTRAINT pos_session_stock_reserves_session_product_uniq
    UNIQUE (session_id, product_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_session_stock_reserves_session
  ON public.pos_session_stock_reserves (session_id);

CREATE INDEX IF NOT EXISTS idx_pos_session_stock_reserves_org_outlet
  ON public.pos_session_stock_reserves (organization_id, outlet_id);

ALTER TABLE public.pos_session_stock_reserves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_session_stock_reserves_org_select" ON public.pos_session_stock_reserves;
CREATE POLICY "pos_session_stock_reserves_org_select"
  ON public.pos_session_stock_reserves FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_session_stock_reserves_org_insert" ON public.pos_session_stock_reserves;
CREATE POLICY "pos_session_stock_reserves_org_insert"
  ON public.pos_session_stock_reserves FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_session_stock_reserves_org_update" ON public.pos_session_stock_reserves;
CREATE POLICY "pos_session_stock_reserves_org_update"
  ON public.pos_session_stock_reserves FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_session_stock_reserves_org_delete" ON public.pos_session_stock_reserves;
CREATE POLICY "pos_session_stock_reserves_org_delete"
  ON public.pos_session_stock_reserves FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_pos_session_stock_reserves_updated_at ON public.pos_session_stock_reserves;
CREATE TRIGGER update_pos_session_stock_reserves_updated_at
  BEFORE UPDATE ON public.pos_session_stock_reserves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.pos_session_stock_reserves IS
  'Fulfillment reserve delta ledger per open bill product+variant.';

-- ---------------------------------------------------------------------------
-- Fix partial kitchen reverse: all batches for session+line_key+product
-- ---------------------------------------------------------------------------

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
  v_line_key text;
  v_product uuid;
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
      v_line_key := COALESCE(NULLIF(btrim(v_line ->> 'line_key'), ''), 'L1');
      v_product := NULLIF(v_line ->> 'product_id', '')::uuid;
      IF v_fp IS NULL OR v_qty <= 0 OR v_product IS NULL THEN
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
        WHERE m.organization_id = p_organization_id
          AND m.reference_type = 'pos_kitchen_commit'
          AND m.reference_id LIKE p_session_id::text || ':%'
          AND m.reference_id LIKE '%:' || v_line_key || ':' || v_product::text || '%'
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

-- ---------------------------------------------------------------------------
-- Delta reserve: upsert ledger, reserve/release only qty change
-- ---------------------------------------------------------------------------

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
  v_variant_key uuid;
  v_target_qty numeric;
  v_current_qty numeric;
  v_delta numeric;
  v_reserve text;
  v_ref text;
  v_outlet uuid;
  v_null_variant constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden';
  END IF;
  IF p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'catalog_stock_outlet_required';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'catalog_stock_session_required';
  END IF;

  v_outlet := p_outlet_id;
  v_reserve := COALESCE(NULLIF(btrim(p_reserve_id), ''), gen_random_uuid()::text);
  v_ref := p_session_id::text || ':reserve:' || v_reserve;

  FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_product := NULLIF(v_line ->> 'product_id', '')::uuid;
    v_variant := NULLIF(v_line ->> 'variant_id', '')::uuid;
    v_variant_key := COALESCE(v_variant, v_null_variant);
    v_target_qty := COALESCE((v_line ->> 'qty')::numeric, 0);
    IF v_product IS NULL OR v_target_qty < 0 THEN
      CONTINUE;
    END IF;

    SELECT reserved_qty INTO v_current_qty
    FROM public.pos_session_stock_reserves
    WHERE session_id = p_session_id
      AND product_id = v_product
      AND variant_id = v_variant_key
    FOR UPDATE;

    v_current_qty := COALESCE(v_current_qty, 0);
    v_delta := v_target_qty - v_current_qty;

    IF v_delta = 0 THEN
      CONTINUE;
    END IF;

    IF v_delta > 0 THEN
      IF v_variant IS NOT NULL THEN
        UPDATE public.catalog_product_variant_outlets
        SET reserved_qty = reserved_qty + v_delta
        WHERE variant_id = v_variant AND outlet_id = v_outlet;
      ELSE
        UPDATE public.catalog_product_outlets
        SET reserved_qty = reserved_qty + v_delta
        WHERE product_id = v_product AND outlet_id = v_outlet;
      END IF;

      PERFORM public.apply_catalog_stock_movement(
        p_organization_id,
        v_outlet,
        'product',
        v_product,
        v_variant,
        NULL,
        'reserve',
        0,
        'pos_stock_reserve',
        v_ref || ':' || v_product::text || ':+' || v_delta::text,
        'Stock reserve delta'
      );
    ELSE
      IF v_variant IS NOT NULL THEN
        UPDATE public.catalog_product_variant_outlets
        SET reserved_qty = GREATEST(0, reserved_qty + v_delta)
        WHERE variant_id = v_variant AND outlet_id = v_outlet;
      ELSE
        UPDATE public.catalog_product_outlets
        SET reserved_qty = GREATEST(0, reserved_qty + v_delta)
        WHERE product_id = v_product AND outlet_id = v_outlet;
      END IF;

      PERFORM public.apply_catalog_stock_movement(
        p_organization_id,
        v_outlet,
        'product',
        v_product,
        v_variant,
        NULL,
        'release',
        0,
        'pos_stock_reserve',
        v_ref || ':' || v_product::text || ':-' || ABS(v_delta)::text,
        'Stock reserve release delta'
      );
    END IF;

    INSERT INTO public.pos_session_stock_reserves (
      organization_id,
      outlet_id,
      session_id,
      product_id,
      variant_id,
      reserved_qty,
      last_reference_id
    )
    VALUES (
      p_organization_id,
      v_outlet,
      p_session_id,
      v_product,
      v_variant_key,
      v_target_qty,
      v_ref
    )
    ON CONFLICT ON CONSTRAINT pos_session_stock_reserves_session_product_uniq DO UPDATE SET
      reserved_qty = EXCLUDED.reserved_qty,
      last_reference_id = EXCLUDED.last_reference_id,
      last_reserved_at = now(),
      updated_at = now();
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'reserve_id', v_reserve);
END;
$$;

-- ---------------------------------------------------------------------------
-- Release reserve: per-line qty or full session when p_lines IS NULL
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.release_catalog_stock_reserve(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_session_id uuid,
  p_lines jsonb DEFAULT NULL,
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
  v_variant_key uuid;
  v_qty numeric;
  v_release text;
  v_ref text;
  v_outlet uuid;
  v_rec record;
  v_null_variant constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
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

  v_release := COALESCE(NULLIF(btrim(p_release_id), ''), gen_random_uuid()::text);
  v_ref := COALESCE(p_session_id::text, v_release) || ':release:' || v_release;

  IF p_lines IS NULL OR jsonb_array_length(COALESCE(p_lines, '[]'::jsonb)) = 0 THEN
    IF p_session_id IS NULL THEN
      RETURN jsonb_build_object('ok', true, 'released', 0);
    END IF;

    FOR v_rec IN
      SELECT product_id, variant_id, reserved_qty
      FROM public.pos_session_stock_reserves
      WHERE session_id = p_session_id
        AND organization_id = p_organization_id
        AND reserved_qty > 0
      FOR UPDATE
    LOOP
      IF v_rec.variant_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000000'::uuid THEN
        UPDATE public.catalog_product_variant_outlets
        SET reserved_qty = GREATEST(0, reserved_qty - v_rec.reserved_qty)
        WHERE variant_id = v_rec.variant_id AND outlet_id = v_outlet;
      ELSE
        UPDATE public.catalog_product_outlets
        SET reserved_qty = GREATEST(0, reserved_qty - v_rec.reserved_qty)
        WHERE product_id = v_rec.product_id AND outlet_id = v_outlet;
      END IF;

      PERFORM public.apply_catalog_stock_movement(
        p_organization_id,
        v_outlet,
        'product',
        v_rec.product_id,
        CASE
          WHEN v_rec.variant_id = '00000000-0000-0000-0000-000000000000'::uuid THEN NULL
          ELSE v_rec.variant_id
        END,
        NULL,
        'release',
        0,
        'pos_stock_reserve',
        v_ref || ':' || v_rec.product_id::text || ':full',
        'Stock reserve release full session'
      );
    END LOOP;

    UPDATE public.pos_session_stock_reserves
    SET reserved_qty = 0, updated_at = now()
    WHERE session_id = p_session_id AND organization_id = p_organization_id;

    RETURN jsonb_build_object('ok', true, 'release_id', v_release, 'full_session', true);
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
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
      WHERE variant_id = v_variant AND outlet_id = v_outlet;
    ELSE
      UPDATE public.catalog_product_outlets
      SET reserved_qty = GREATEST(0, reserved_qty - v_qty)
      WHERE product_id = v_product AND outlet_id = v_outlet;
    END IF;

    PERFORM public.apply_catalog_stock_movement(
      p_organization_id,
      v_outlet,
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

    v_variant_key := COALESCE(v_variant, v_null_variant);

    UPDATE public.pos_session_stock_reserves
    SET
      reserved_qty = GREATEST(0, reserved_qty - v_qty),
      updated_at = now()
    WHERE session_id = p_session_id
      AND product_id = v_product
      AND variant_id = v_variant_key;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'release_id', v_release);
END;
$$;

COMMENT ON FUNCTION public.reverse_catalog_kitchen_commit IS
  'Reverse kitchen stock commits. Partial reverse spans ALL batches for session+line_key+product.';

COMMENT ON FUNCTION public.apply_catalog_stock_reserve IS
  'Delta reserve: p_lines qty is target cart qty; only reserve/release the difference vs ledger.';

COMMENT ON FUNCTION public.release_catalog_stock_reserve IS
  'Release reserved stock. p_lines NULL releases full session ledger.';
