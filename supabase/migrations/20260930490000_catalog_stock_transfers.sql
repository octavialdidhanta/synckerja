-- Catalog stock transfers between outlets (Item Library + Ingredients).
-- Stock moves immediately on create: source -qty, destination +qty, both movement_type = transfer.

CREATE TABLE IF NOT EXISTS public.catalog_stock_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  from_outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE RESTRICT,
  to_outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE RESTRICT,
  item_kind text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'completed',
  order_number text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT catalog_stock_transfers_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_stock_transfers_kind_check CHECK (item_kind IN ('product', 'ingredient')),
  CONSTRAINT catalog_stock_transfers_status_check CHECK (status IN ('completed')),
  CONSTRAINT catalog_stock_transfers_outlets_distinct CHECK (from_outlet_id <> to_outlet_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_stock_transfers_org_number
  ON public.catalog_stock_transfers (organization_id, order_number);

CREATE INDEX IF NOT EXISTS idx_catalog_stock_transfers_org_time
  ON public.catalog_stock_transfers (organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_stock_transfers_from_outlet
  ON public.catalog_stock_transfers (organization_id, from_outlet_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_stock_transfers_to_outlet
  ON public.catalog_stock_transfers (organization_id, to_outlet_id, occurred_at DESC);

ALTER TABLE public.catalog_stock_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_stock_transfers_org_select" ON public.catalog_stock_transfers;
CREATE POLICY "catalog_stock_transfers_org_select"
  ON public.catalog_stock_transfers FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_stock_transfers_updated_at ON public.catalog_stock_transfers;
CREATE TRIGGER update_catalog_stock_transfers_updated_at
  BEFORE UPDATE ON public.catalog_stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.catalog_stock_transfer_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.catalog_stock_transfers (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.default_prices (id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.catalog_product_variants (id) ON DELETE SET NULL,
  ingredient_id uuid REFERENCES public.catalog_ingredients (id) ON DELETE SET NULL,
  qty numeric(14, 3) NOT NULL,
  unit_snapshot text,
  name_snapshot text NOT NULL,
  in_stock_from_snapshot numeric(14, 3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_stock_transfer_lines_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_stock_transfer_lines_qty_check CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_catalog_stock_transfer_lines_transfer
  ON public.catalog_stock_transfer_lines (transfer_id);

ALTER TABLE public.catalog_stock_transfer_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_stock_transfer_lines_org_select" ON public.catalog_stock_transfer_lines;
CREATE POLICY "catalog_stock_transfer_lines_org_select"
  ON public.catalog_stock_transfer_lines FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE OR REPLACE FUNCTION public.catalog_transfer_read_source_stock(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_item_kind text,
  p_product_id uuid,
  p_variant_id uuid,
  p_ingredient_id uuid,
  OUT o_qty numeric,
  OUT o_avg_cost numeric,
  OUT o_track_cogs boolean,
  OUT o_variant_id uuid
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  o_qty := 0;
  o_avg_cost := 0;
  o_track_cogs := false;
  o_variant_id := p_variant_id;

  IF p_item_kind = 'product' THEN
    IF o_variant_id IS NULL THEN
      SELECT v.id
        INTO o_variant_id
      FROM public.catalog_product_variants v
      WHERE v.product_id = p_product_id
      ORDER BY v.sort_order, v.created_at
      LIMIT 1;
    END IF;

    IF o_variant_id IS NOT NULL THEN
      SELECT vo.in_stock, vo.avg_cost, vo.track_cogs
        INTO o_qty, o_avg_cost, o_track_cogs
      FROM public.catalog_product_variant_outlets vo
      WHERE vo.variant_id = o_variant_id AND vo.outlet_id = p_outlet_id;
    ELSE
      SELECT po.in_stock, po.avg_cost, po.track_cogs
        INTO o_qty, o_avg_cost, o_track_cogs
      FROM public.catalog_product_outlets po
      WHERE po.product_id = p_product_id AND po.outlet_id = p_outlet_id;
    END IF;
  ELSE
    SELECT io.in_stock, io.avg_cost, io.track_cogs
      INTO o_qty, o_avg_cost, o_track_cogs
    FROM public.catalog_ingredient_outlets io
    WHERE io.ingredient_id = p_ingredient_id AND io.outlet_id = p_outlet_id;
  END IF;

  o_qty := COALESCE(o_qty, 0);
  o_avg_cost := COALESCE(o_avg_cost, 0);
  o_track_cogs := COALESCE(o_track_cogs, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_transfer_ensure_dest_row(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_item_kind text,
  p_product_id uuid,
  p_variant_id uuid,
  p_ingredient_id uuid,
  p_track_cogs boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_item_kind = 'product' AND p_variant_id IS NOT NULL THEN
    INSERT INTO public.catalog_product_variant_outlets (
      variant_id, outlet_id, organization_id, in_stock, track_cogs
    ) VALUES (
      p_variant_id, p_outlet_id, p_organization_id, 0, COALESCE(p_track_cogs, false)
    )
    ON CONFLICT (variant_id, outlet_id) DO NOTHING;
  ELSIF p_item_kind = 'product' THEN
    INSERT INTO public.catalog_product_outlets (
      product_id, outlet_id, organization_id, in_stock, track_cogs
    ) VALUES (
      p_product_id, p_outlet_id, p_organization_id, 0, COALESCE(p_track_cogs, false)
    )
    ON CONFLICT (product_id, outlet_id) DO NOTHING;
  ELSE
    INSERT INTO public.catalog_ingredient_outlets (
      ingredient_id, outlet_id, organization_id, in_stock, track_cogs
    ) VALUES (
      p_ingredient_id, p_outlet_id, p_organization_id, 0, COALESCE(p_track_cogs, false)
    )
    ON CONFLICT (ingredient_id, outlet_id) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_catalog_stock_transfer(
  p_organization_id uuid,
  p_from_outlet_id uuid,
  p_to_outlet_id uuid,
  p_item_kind text,
  p_note text,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_id uuid;
  v_order_number text;
  v_line jsonb;
  v_qty numeric;
  v_name text;
  v_unit text;
  v_product_id uuid;
  v_variant_id uuid;
  v_ingredient_id uuid;
  v_line_id uuid;
  v_src_qty numeric;
  v_src_avg numeric;
  v_src_cogs boolean;
  v_resolved_variant uuid;
  v_from_ok boolean;
  v_to_ok boolean;
  v_has_line boolean := false;
  v_transfer public.catalog_stock_transfers%ROWTYPE;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_transfer_forbidden';
  END IF;
  IF p_from_outlet_id IS NULL OR p_to_outlet_id IS NULL THEN
    RAISE EXCEPTION 'catalog_transfer_outlet_required';
  END IF;
  IF p_from_outlet_id = p_to_outlet_id THEN
    RAISE EXCEPTION 'catalog_transfer_same_outlet';
  END IF;
  IF p_item_kind NOT IN ('product', 'ingredient') THEN
    RAISE EXCEPTION 'catalog_transfer_kind_invalid';
  END IF;
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'catalog_transfer_lines_required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.pos_outlets
    WHERE id = p_from_outlet_id AND organization_id = p_organization_id
  ) INTO v_from_ok;
  SELECT EXISTS (
    SELECT 1 FROM public.pos_outlets
    WHERE id = p_to_outlet_id AND organization_id = p_organization_id
  ) INTO v_to_ok;
  IF NOT v_from_ok OR NOT v_to_ok THEN
    RAISE EXCEPTION 'catalog_transfer_outlet_required';
  END IF;

  v_order_number := '#' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  INSERT INTO public.catalog_stock_transfers (
    organization_id,
    from_outlet_id,
    to_outlet_id,
    item_kind,
    note,
    status,
    order_number,
    occurred_at,
    created_by
  ) VALUES (
    p_organization_id,
    p_from_outlet_id,
    p_to_outlet_id,
    p_item_kind,
    NULLIF(btrim(p_note), ''),
    'completed',
    v_order_number,
    now(),
    auth.uid()
  )
  RETURNING id INTO v_transfer_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_qty := COALESCE((v_line ->> 'qty')::numeric, 0);
    v_name := COALESCE(NULLIF(btrim(v_line ->> 'name_snapshot'), ''), '—');
    v_unit := NULLIF(btrim(v_line ->> 'unit_snapshot'), '');
    v_product_id := NULLIF(v_line ->> 'product_id', '')::uuid;
    v_variant_id := NULLIF(v_line ->> 'variant_id', '')::uuid;
    v_ingredient_id := NULLIF(v_line ->> 'ingredient_id', '')::uuid;

    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF p_item_kind = 'product' THEN
      v_ingredient_id := NULL;
      IF v_product_id IS NULL THEN
        RAISE EXCEPTION 'catalog_transfer_lines_required';
      END IF;
    ELSE
      v_product_id := NULL;
      v_variant_id := NULL;
      IF v_ingredient_id IS NULL THEN
        RAISE EXCEPTION 'catalog_transfer_lines_required';
      END IF;
      IF v_unit IS NULL THEN
        SELECT NULLIF(btrim(i.unit_code), '') INTO v_unit
        FROM public.catalog_ingredients i
        WHERE i.id = v_ingredient_id;
      END IF;
    END IF;

    SELECT
      o_qty, o_avg_cost, o_track_cogs, o_variant_id
      INTO v_src_qty, v_src_avg, v_src_cogs, v_resolved_variant
    FROM public.catalog_transfer_read_source_stock(
      p_organization_id,
      p_from_outlet_id,
      p_item_kind,
      v_product_id,
      v_variant_id,
      v_ingredient_id
    );

    IF p_item_kind = 'product' THEN
      v_variant_id := v_resolved_variant;
    END IF;

    IF v_qty > v_src_qty THEN
      RAISE EXCEPTION 'catalog_stock_insufficient';
    END IF;

    INSERT INTO public.catalog_stock_transfer_lines (
      transfer_id,
      organization_id,
      product_id,
      variant_id,
      ingredient_id,
      qty,
      unit_snapshot,
      name_snapshot,
      in_stock_from_snapshot
    ) VALUES (
      v_transfer_id,
      p_organization_id,
      CASE WHEN p_item_kind = 'product' THEN v_product_id ELSE NULL END,
      CASE WHEN p_item_kind = 'product' THEN v_variant_id ELSE NULL END,
      CASE WHEN p_item_kind = 'ingredient' THEN v_ingredient_id ELSE NULL END,
      v_qty,
      v_unit,
      v_name,
      v_src_qty
    )
    RETURNING id INTO v_line_id;

    PERFORM public.apply_catalog_stock_movement(
      p_organization_id,
      p_from_outlet_id,
      p_item_kind,
      v_product_id,
      v_variant_id,
      v_ingredient_id,
      'transfer',
      -v_qty,
      'inventory_transfer',
      v_transfer_id::text || ':' || v_line_id::text || ':from',
      NULLIF(btrim(p_note), '')
    );

    PERFORM public.catalog_transfer_ensure_dest_row(
      p_organization_id,
      p_to_outlet_id,
      p_item_kind,
      v_product_id,
      v_variant_id,
      v_ingredient_id,
      v_src_cogs
    );

    PERFORM public.catalog_po_update_avg_cost(
      p_organization_id,
      p_to_outlet_id,
      p_item_kind,
      v_product_id,
      v_variant_id,
      v_ingredient_id,
      v_qty,
      v_src_avg
    );

    PERFORM public.apply_catalog_stock_movement(
      p_organization_id,
      p_to_outlet_id,
      p_item_kind,
      v_product_id,
      v_variant_id,
      v_ingredient_id,
      'transfer',
      v_qty,
      'inventory_transfer',
      v_transfer_id::text || ':' || v_line_id::text || ':to',
      NULLIF(btrim(p_note), '')
    );

    v_has_line := true;
  END LOOP;

  IF NOT v_has_line THEN
    DELETE FROM public.catalog_stock_transfers WHERE id = v_transfer_id;
    RAISE EXCEPTION 'catalog_transfer_lines_required';
  END IF;

  SELECT * INTO v_transfer FROM public.catalog_stock_transfers WHERE id = v_transfer_id;
  RETURN to_jsonb(v_transfer);
END;
$$;

GRANT EXECUTE ON FUNCTION public.catalog_transfer_read_source_stock(
  uuid, uuid, text, uuid, uuid, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_transfer_ensure_dest_row(
  uuid, uuid, text, uuid, uuid, uuid, boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_catalog_stock_transfer(
  uuid, uuid, uuid, text, text, jsonb
) TO authenticated;
