-- Advanced stock transfer workflow: pending_approval → approved → shipped → completed (+ cancelled).

ALTER TABLE public.catalog_stock_transfers
  DROP CONSTRAINT IF EXISTS catalog_stock_transfers_status_check;

ALTER TABLE public.catalog_stock_transfers
  ADD CONSTRAINT catalog_stock_transfers_status_check CHECK (
    status IN ('pending_approval', 'approved', 'shipped', 'completed', 'cancelled')
  );

ALTER TABLE public.catalog_stock_transfers
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_by uuid,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

CREATE TABLE IF NOT EXISTS public.catalog_stock_transfer_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.catalog_stock_transfers (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_name_snapshot text NOT NULL,
  comment text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_stock_transfer_events_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_stock_transfer_events_type_check CHECK (
    event_type IN ('created', 'approved', 'shipped', 'fulfilled', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_stock_transfer_events_transfer_time
  ON public.catalog_stock_transfer_events (transfer_id, occurred_at DESC);

ALTER TABLE public.catalog_stock_transfer_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_stock_transfer_events_org_select" ON public.catalog_stock_transfer_events;
CREATE POLICY "catalog_stock_transfer_events_org_select"
  ON public.catalog_stock_transfer_events FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE OR REPLACE FUNCTION public.catalog_inventory_transfer_mode(p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.transfer_mode FROM public.catalog_inventory_settings s WHERE s.organization_id = p_organization_id),
    'simple'
  );
$$;

REVOKE ALL ON FUNCTION public.catalog_inventory_transfer_mode(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_inventory_transfer_mode(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.catalog_transfer_actor_name(p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.catalog_po_actor_name(p_organization_id);
$$;

CREATE OR REPLACE FUNCTION public.catalog_transfer_insert_event(
  p_transfer_id uuid,
  p_organization_id uuid,
  p_event_type text,
  p_comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.catalog_stock_transfer_events (
    transfer_id,
    organization_id,
    event_type,
    actor_user_id,
    actor_name_snapshot,
    comment
  ) VALUES (
    p_transfer_id,
    p_organization_id,
    p_event_type,
    auth.uid(),
    public.catalog_transfer_actor_name(p_organization_id),
    NULLIF(btrim(p_comment), '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_transfer_ship_line(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_from_outlet_id uuid,
  p_item_kind text,
  p_note text,
  p_line record
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src_qty numeric;
  v_src_avg numeric;
  v_src_cogs boolean;
  v_resolved_variant uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_ingredient_id uuid;
  v_qty numeric;
BEGIN
  v_qty := p_line.qty;
  v_product_id := p_line.product_id;
  v_variant_id := p_line.variant_id;
  v_ingredient_id := p_line.ingredient_id;

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
    p_transfer_id::text || ':' || p_line.id::text || ':from',
    NULLIF(btrim(p_note), '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_transfer_fulfill_line(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_to_outlet_id uuid,
  p_item_kind text,
  p_note text,
  p_line record
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src_avg numeric;
  v_src_cogs boolean;
  v_resolved_variant uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_ingredient_id uuid;
  v_qty numeric;
BEGIN
  v_qty := p_line.qty;
  v_product_id := p_line.product_id;
  v_variant_id := p_line.variant_id;
  v_ingredient_id := p_line.ingredient_id;

  SELECT
    o_avg_cost, o_track_cogs, o_variant_id
    INTO v_src_avg, v_src_cogs, v_resolved_variant
  FROM public.catalog_transfer_read_source_stock(
    p_organization_id,
    p_to_outlet_id,
    p_item_kind,
    v_product_id,
    v_variant_id,
    v_ingredient_id
  );

  IF p_item_kind = 'product' THEN
    v_variant_id := v_resolved_variant;
  END IF;

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
    p_transfer_id::text || ':' || p_line.id::text || ':to',
    NULLIF(btrim(p_note), '')
  );
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
  v_transfer_mode text;
  v_initial_status text;
BEGIN
  v_transfer_mode := public.catalog_inventory_transfer_mode(p_organization_id);

  IF v_transfer_mode = 'advanced' THEN
    IF NOT public.user_has_inventory_feature_access(p_organization_id, 'transfer_request') THEN
      RAISE EXCEPTION 'catalog_inventory_feature_forbidden';
    END IF;
    v_initial_status := 'pending_approval';
  ELSE
    v_initial_status := 'completed';
  END IF;

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
    created_by,
    completed_at,
    completed_by
  ) VALUES (
    p_organization_id,
    p_from_outlet_id,
    p_to_outlet_id,
    p_item_kind,
    NULLIF(btrim(p_note), ''),
    v_initial_status,
    v_order_number,
    now(),
    auth.uid(),
    CASE WHEN v_initial_status = 'completed' THEN now() ELSE NULL END,
    CASE WHEN v_initial_status = 'completed' THEN auth.uid() ELSE NULL END
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

    IF v_transfer_mode = 'simple' AND v_qty > v_src_qty THEN
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

    IF v_transfer_mode = 'simple' THEN
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
    END IF;

    v_has_line := true;
  END LOOP;

  IF NOT v_has_line THEN
    DELETE FROM public.catalog_stock_transfers WHERE id = v_transfer_id;
    RAISE EXCEPTION 'catalog_transfer_lines_required';
  END IF;

  PERFORM public.catalog_transfer_insert_event(
    v_transfer_id,
    p_organization_id,
    'created',
    p_note
  );

  SELECT * INTO v_transfer FROM public.catalog_stock_transfers WHERE id = v_transfer_id;
  RETURN to_jsonb(v_transfer);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_catalog_stock_transfer(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer public.catalog_stock_transfers%ROWTYPE;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_transfer_forbidden';
  END IF;
  IF NOT public.user_has_inventory_feature_access(p_organization_id, 'transfer_approval') THEN
    RAISE EXCEPTION 'catalog_inventory_feature_forbidden';
  END IF;

  SELECT * INTO v_transfer
  FROM public.catalog_stock_transfers
  WHERE id = p_transfer_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_transfer_not_found';
  END IF;
  IF v_transfer.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'catalog_transfer_invalid_status';
  END IF;

  UPDATE public.catalog_stock_transfers
  SET
    status = 'approved',
    approved_at = now(),
    approved_by = auth.uid(),
    updated_at = now()
  WHERE id = v_transfer.id;

  PERFORM public.catalog_transfer_insert_event(v_transfer.id, p_organization_id, 'approved', p_comment);

  RETURN to_jsonb((SELECT t FROM public.catalog_stock_transfers t WHERE t.id = v_transfer.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.ship_catalog_stock_transfer(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer public.catalog_stock_transfers%ROWTYPE;
  v_line record;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_transfer_forbidden';
  END IF;
  IF NOT public.user_has_inventory_feature_access(p_organization_id, 'transfer_shipment') THEN
    RAISE EXCEPTION 'catalog_inventory_feature_forbidden';
  END IF;

  SELECT * INTO v_transfer
  FROM public.catalog_stock_transfers
  WHERE id = p_transfer_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_transfer_not_found';
  END IF;
  IF v_transfer.status <> 'approved' THEN
    RAISE EXCEPTION 'catalog_transfer_invalid_status';
  END IF;

  FOR v_line IN
    SELECT *
    FROM public.catalog_stock_transfer_lines
    WHERE transfer_id = v_transfer.id
    ORDER BY created_at
  LOOP
    PERFORM public.catalog_transfer_ship_line(
      p_organization_id,
      v_transfer.id,
      v_transfer.from_outlet_id,
      v_transfer.item_kind,
      COALESCE(p_comment, v_transfer.note),
      v_line
    );
  END LOOP;

  UPDATE public.catalog_stock_transfers
  SET
    status = 'shipped',
    shipped_at = now(),
    shipped_by = auth.uid(),
    updated_at = now()
  WHERE id = v_transfer.id;

  PERFORM public.catalog_transfer_insert_event(v_transfer.id, p_organization_id, 'shipped', p_comment);

  RETURN to_jsonb((SELECT t FROM public.catalog_stock_transfers t WHERE t.id = v_transfer.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_catalog_stock_transfer(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer public.catalog_stock_transfers%ROWTYPE;
  v_line record;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_transfer_forbidden';
  END IF;
  IF NOT public.user_has_inventory_feature_access(p_organization_id, 'transfer_fulfillment') THEN
    RAISE EXCEPTION 'catalog_inventory_feature_forbidden';
  END IF;

  SELECT * INTO v_transfer
  FROM public.catalog_stock_transfers
  WHERE id = p_transfer_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_transfer_not_found';
  END IF;
  IF v_transfer.status <> 'shipped' THEN
    RAISE EXCEPTION 'catalog_transfer_invalid_status';
  END IF;

  FOR v_line IN
    SELECT *
    FROM public.catalog_stock_transfer_lines
    WHERE transfer_id = v_transfer.id
    ORDER BY created_at
  LOOP
    PERFORM public.catalog_transfer_fulfill_line(
      p_organization_id,
      v_transfer.id,
      v_transfer.to_outlet_id,
      v_transfer.item_kind,
      COALESCE(p_comment, v_transfer.note),
      v_line
    );
  END LOOP;

  UPDATE public.catalog_stock_transfers
  SET
    status = 'completed',
    completed_at = now(),
    completed_by = auth.uid(),
    updated_at = now()
  WHERE id = v_transfer.id;

  PERFORM public.catalog_transfer_insert_event(v_transfer.id, p_organization_id, 'fulfilled', p_comment);

  RETURN to_jsonb((SELECT t FROM public.catalog_stock_transfers t WHERE t.id = v_transfer.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_catalog_stock_transfer(
  p_organization_id uuid,
  p_transfer_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer public.catalog_stock_transfers%ROWTYPE;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_transfer_forbidden';
  END IF;

  SELECT * INTO v_transfer
  FROM public.catalog_stock_transfers
  WHERE id = p_transfer_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_transfer_not_found';
  END IF;
  IF v_transfer.status NOT IN ('pending_approval', 'approved') THEN
    RAISE EXCEPTION 'catalog_transfer_invalid_status';
  END IF;

  UPDATE public.catalog_stock_transfers
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    updated_at = now()
  WHERE id = v_transfer.id;

  PERFORM public.catalog_transfer_insert_event(v_transfer.id, p_organization_id, 'cancelled', p_comment);

  RETURN to_jsonb((SELECT t FROM public.catalog_stock_transfers t WHERE t.id = v_transfer.id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_catalog_stock_transfer(
  uuid, uuid, uuid, text, text, jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_catalog_stock_transfer(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ship_catalog_stock_transfer(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_catalog_stock_transfer(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_catalog_stock_transfer(uuid, uuid, text) TO authenticated;
