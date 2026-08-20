-- Suppliers and Purchase Orders for catalog inventory (Item Library + Ingredients).

CREATE TABLE IF NOT EXISTS public.catalog_suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_suppliers_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_suppliers_name_check CHECK (btrim(name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_catalog_suppliers_org
  ON public.catalog_suppliers (organization_id)
  WHERE is_deleted = false;

ALTER TABLE public.catalog_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_suppliers_org_select" ON public.catalog_suppliers;
CREATE POLICY "catalog_suppliers_org_select"
  ON public.catalog_suppliers FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_suppliers_org_insert" ON public.catalog_suppliers;
CREATE POLICY "catalog_suppliers_org_insert"
  ON public.catalog_suppliers FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_suppliers_org_update" ON public.catalog_suppliers;
CREATE POLICY "catalog_suppliers_org_update"
  ON public.catalog_suppliers FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_suppliers_updated_at ON public.catalog_suppliers;
CREATE TRIGGER update_catalog_suppliers_updated_at
  BEFORE UPDATE ON public.catalog_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.catalog_purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.catalog_suppliers (id) ON DELETE SET NULL,
  item_kind text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'waiting',
  order_number text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  total_value numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid,
  fulfilled_by uuid,
  cancelled_by uuid,
  CONSTRAINT catalog_purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_purchase_orders_kind_check CHECK (item_kind IN ('product', 'ingredient')),
  CONSTRAINT catalog_purchase_orders_status_check CHECK (status IN ('waiting', 'completed', 'cancelled')),
  CONSTRAINT catalog_purchase_orders_total_check CHECK (total_value >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_purchase_orders_org_number
  ON public.catalog_purchase_orders (organization_id, order_number);

CREATE INDEX IF NOT EXISTS idx_catalog_purchase_orders_org_outlet_time
  ON public.catalog_purchase_orders (organization_id, outlet_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_purchase_orders_org_status
  ON public.catalog_purchase_orders (organization_id, status, occurred_at DESC);

ALTER TABLE public.catalog_purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_purchase_orders_org_select" ON public.catalog_purchase_orders;
CREATE POLICY "catalog_purchase_orders_org_select"
  ON public.catalog_purchase_orders FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_purchase_orders_org_insert" ON public.catalog_purchase_orders;
CREATE POLICY "catalog_purchase_orders_org_insert"
  ON public.catalog_purchase_orders FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_purchase_orders_org_update" ON public.catalog_purchase_orders;
CREATE POLICY "catalog_purchase_orders_org_update"
  ON public.catalog_purchase_orders FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_purchase_orders_updated_at ON public.catalog_purchase_orders;
CREATE TRIGGER update_catalog_purchase_orders_updated_at
  BEFORE UPDATE ON public.catalog_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.catalog_purchase_order_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.catalog_purchase_orders (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.default_prices (id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.catalog_product_variants (id) ON DELETE SET NULL,
  ingredient_id uuid REFERENCES public.catalog_ingredients (id) ON DELETE SET NULL,
  qty numeric(14, 3) NOT NULL,
  unit_cost numeric(14, 2) NOT NULL DEFAULT 0,
  subtotal numeric(14, 2) NOT NULL DEFAULT 0,
  name_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_purchase_order_lines_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_purchase_order_lines_qty_check CHECK (qty > 0),
  CONSTRAINT catalog_purchase_order_lines_unit_cost_check CHECK (unit_cost >= 0),
  CONSTRAINT catalog_purchase_order_lines_subtotal_check CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_catalog_purchase_order_lines_po
  ON public.catalog_purchase_order_lines (purchase_order_id);

ALTER TABLE public.catalog_purchase_order_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_purchase_order_lines_org_select" ON public.catalog_purchase_order_lines;
CREATE POLICY "catalog_purchase_order_lines_org_select"
  ON public.catalog_purchase_order_lines FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_purchase_order_lines_org_insert" ON public.catalog_purchase_order_lines;
CREATE POLICY "catalog_purchase_order_lines_org_insert"
  ON public.catalog_purchase_order_lines FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_purchase_order_lines_org_update" ON public.catalog_purchase_order_lines;
CREATE POLICY "catalog_purchase_order_lines_org_update"
  ON public.catalog_purchase_order_lines FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_purchase_order_lines_org_delete" ON public.catalog_purchase_order_lines;
CREATE POLICY "catalog_purchase_order_lines_org_delete"
  ON public.catalog_purchase_order_lines FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE TABLE IF NOT EXISTS public.catalog_purchase_order_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.catalog_purchase_orders (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_name_snapshot text NOT NULL,
  comment text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_purchase_order_events_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_purchase_order_events_type_check CHECK (
    event_type IN ('created', 'fulfilled', 'cancelled', 'edited', 'note_updated')
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_purchase_order_events_po_time
  ON public.catalog_purchase_order_events (purchase_order_id, occurred_at DESC);

ALTER TABLE public.catalog_purchase_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_purchase_order_events_org_select" ON public.catalog_purchase_order_events;
CREATE POLICY "catalog_purchase_order_events_org_select"
  ON public.catalog_purchase_order_events FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_purchase_order_events_org_insert" ON public.catalog_purchase_order_events;
CREATE POLICY "catalog_purchase_order_events_org_insert"
  ON public.catalog_purchase_order_events FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE OR REPLACE FUNCTION public.catalog_po_actor_name(p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(upper(btrim(e.full_name)), ''),
    NULLIF(btrim(p.email), ''),
    'UNKNOWN'
  )
  FROM auth.users u
  LEFT JOIN public.employees e ON e.user_id = u.id AND e.organization_id = p_organization_id
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.catalog_po_update_avg_cost(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_item_kind text,
  p_product_id uuid,
  p_variant_id uuid,
  p_ingredient_id uuid,
  p_qty numeric,
  p_unit_cost numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_qty numeric(14, 3);
  v_old_avg numeric(14, 2);
  v_track_cogs boolean;
  v_new_avg numeric(14, 2);
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN;
  END IF;

  IF p_item_kind = 'product' AND p_variant_id IS NOT NULL THEN
    SELECT vo.in_stock, vo.avg_cost, vo.track_cogs
      INTO v_old_qty, v_old_avg, v_track_cogs
    FROM public.catalog_product_variant_outlets vo
    WHERE vo.variant_id = p_variant_id AND vo.outlet_id = p_outlet_id;
    IF v_track_cogs IS NOT TRUE THEN RETURN; END IF;
    v_old_qty := COALESCE(v_old_qty, 0);
    v_old_avg := COALESCE(v_old_avg, 0);
    IF (v_old_qty + p_qty) <= 0 THEN
      v_new_avg := p_unit_cost;
    ELSE
      v_new_avg := ((v_old_qty * v_old_avg) + (p_qty * p_unit_cost)) / (v_old_qty + p_qty);
    END IF;
    UPDATE public.catalog_product_variant_outlets
    SET avg_cost = ROUND(v_new_avg, 2)
    WHERE variant_id = p_variant_id AND outlet_id = p_outlet_id;
    RETURN;
  END IF;

  IF p_item_kind = 'product' THEN
    SELECT po.in_stock, po.avg_cost, po.track_cogs
      INTO v_old_qty, v_old_avg, v_track_cogs
    FROM public.catalog_product_outlets po
    WHERE po.product_id = p_product_id AND po.outlet_id = p_outlet_id;
    IF v_track_cogs IS NOT TRUE THEN RETURN; END IF;
    v_old_qty := COALESCE(v_old_qty, 0);
    v_old_avg := COALESCE(v_old_avg, 0);
    IF (v_old_qty + p_qty) <= 0 THEN
      v_new_avg := p_unit_cost;
    ELSE
      v_new_avg := ((v_old_qty * v_old_avg) + (p_qty * p_unit_cost)) / (v_old_qty + p_qty);
    END IF;
    UPDATE public.catalog_product_outlets
    SET avg_cost = ROUND(v_new_avg, 2)
    WHERE product_id = p_product_id AND outlet_id = p_outlet_id;
    RETURN;
  END IF;

  IF p_item_kind = 'ingredient' THEN
    SELECT io.in_stock, io.avg_cost, io.track_cogs
      INTO v_old_qty, v_old_avg, v_track_cogs
    FROM public.catalog_ingredient_outlets io
    WHERE io.ingredient_id = p_ingredient_id AND io.outlet_id = p_outlet_id;
    IF v_track_cogs IS NOT TRUE THEN RETURN; END IF;
    v_old_qty := COALESCE(v_old_qty, 0);
    v_old_avg := COALESCE(v_old_avg, 0);
    IF (v_old_qty + p_qty) <= 0 THEN
      v_new_avg := p_unit_cost;
    ELSE
      v_new_avg := ((v_old_qty * v_old_avg) + (p_qty * p_unit_cost)) / (v_old_qty + p_qty);
    END IF;
    UPDATE public.catalog_ingredient_outlets
    SET avg_cost = ROUND(v_new_avg, 2)
    WHERE ingredient_id = p_ingredient_id AND outlet_id = p_outlet_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_catalog_purchase_order(
  p_organization_id uuid,
  p_purchase_order_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po public.catalog_purchase_orders%ROWTYPE;
  v_line record;
  v_item_kind text;
  v_actor text;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_po_forbidden';
  END IF;

  SELECT * INTO v_po
  FROM public.catalog_purchase_orders
  WHERE id = p_purchase_order_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_po_not_found';
  END IF;
  IF v_po.status <> 'waiting' THEN
    RAISE EXCEPTION 'catalog_po_not_waiting';
  END IF;

  v_item_kind := v_po.item_kind;
  v_actor := public.catalog_po_actor_name(p_organization_id);

  FOR v_line IN
    SELECT *
    FROM public.catalog_purchase_order_lines
    WHERE purchase_order_id = v_po.id
    ORDER BY created_at
  LOOP
    -- Weighted avg_cost must use stock BEFORE the inbound movement.
    PERFORM public.catalog_po_update_avg_cost(
      p_organization_id,
      v_po.outlet_id,
      v_item_kind,
      v_line.product_id,
      v_line.variant_id,
      v_line.ingredient_id,
      v_line.qty,
      v_line.unit_cost
    );

    PERFORM public.apply_catalog_stock_movement(
      p_organization_id,
      v_po.outlet_id,
      v_item_kind,
      v_line.product_id,
      v_line.variant_id,
      v_line.ingredient_id,
      'purchase_order',
      v_line.qty,
      'inventory_purchase_order',
      v_po.id::text || ':' || v_line.id::text,
      COALESCE(NULLIF(btrim(p_comment), ''), NULLIF(btrim(v_po.note), ''), 'Purchase order')
    );
  END LOOP;

  UPDATE public.catalog_purchase_orders
  SET
    status = 'completed',
    fulfilled_at = now(),
    fulfilled_by = auth.uid(),
    updated_at = now()
  WHERE id = v_po.id;

  INSERT INTO public.catalog_purchase_order_events (
    purchase_order_id,
    organization_id,
    event_type,
    actor_user_id,
    actor_name_snapshot,
    comment
  ) VALUES (
    v_po.id,
    p_organization_id,
    'fulfilled',
    auth.uid(),
    v_actor,
    NULLIF(btrim(p_comment), '')
  );

  RETURN to_jsonb((SELECT po FROM public.catalog_purchase_orders po WHERE po.id = v_po.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_catalog_purchase_order(
  p_organization_id uuid,
  p_purchase_order_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po public.catalog_purchase_orders%ROWTYPE;
  v_actor text;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_po_forbidden';
  END IF;

  SELECT * INTO v_po
  FROM public.catalog_purchase_orders
  WHERE id = p_purchase_order_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_po_not_found';
  END IF;
  IF v_po.status <> 'waiting' THEN
    RAISE EXCEPTION 'catalog_po_not_waiting';
  END IF;

  v_actor := public.catalog_po_actor_name(p_organization_id);

  UPDATE public.catalog_purchase_orders
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    updated_at = now()
  WHERE id = v_po.id;

  INSERT INTO public.catalog_purchase_order_events (
    purchase_order_id,
    organization_id,
    event_type,
    actor_user_id,
    actor_name_snapshot,
    comment
  ) VALUES (
    v_po.id,
    p_organization_id,
    'cancelled',
    auth.uid(),
    v_actor,
    NULLIF(btrim(p_comment), '')
  );

  RETURN to_jsonb((SELECT po FROM public.catalog_purchase_orders po WHERE po.id = v_po.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_catalog_purchase_order(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_supplier_id uuid,
  p_item_kind text,
  p_note text,
  p_lines jsonb,
  p_create_and_fulfill boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id uuid;
  v_order_number text;
  v_total numeric(14, 2) := 0;
  v_line jsonb;
  v_qty numeric;
  v_unit_cost numeric;
  v_subtotal numeric;
  v_name text;
  v_actor text;
  v_product_id uuid;
  v_variant_id uuid;
  v_ingredient_id uuid;
  v_po public.catalog_purchase_orders%ROWTYPE;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_po_forbidden';
  END IF;
  IF p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'catalog_po_outlet_required';
  END IF;
  IF p_item_kind NOT IN ('product', 'ingredient') THEN
    RAISE EXCEPTION 'catalog_po_kind_invalid';
  END IF;
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'catalog_po_lines_required';
  END IF;

  v_order_number := '#' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text;
  v_actor := public.catalog_po_actor_name(p_organization_id);

  INSERT INTO public.catalog_purchase_orders (
    organization_id,
    outlet_id,
    supplier_id,
    item_kind,
    note,
    status,
    order_number,
    occurred_at,
    total_value,
    created_by
  ) VALUES (
    p_organization_id,
    p_outlet_id,
    p_supplier_id,
    p_item_kind,
    NULLIF(btrim(p_note), ''),
    'waiting',
    v_order_number,
    now(),
    0,
    auth.uid()
  )
  RETURNING id INTO v_po_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_qty := COALESCE((v_line ->> 'qty')::numeric, 0);
    v_unit_cost := COALESCE((v_line ->> 'unit_cost')::numeric, 0);
    v_name := COALESCE(NULLIF(btrim(v_line ->> 'name_snapshot'), ''), '—');
    v_product_id := NULLIF(v_line ->> 'product_id', '')::uuid;
    v_variant_id := NULLIF(v_line ->> 'variant_id', '')::uuid;
    v_ingredient_id := NULLIF(v_line ->> 'ingredient_id', '')::uuid;

    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_subtotal := ROUND(v_qty * v_unit_cost, 2);
    v_total := v_total + v_subtotal;

    INSERT INTO public.catalog_purchase_order_lines (
      purchase_order_id,
      organization_id,
      product_id,
      variant_id,
      ingredient_id,
      qty,
      unit_cost,
      subtotal,
      name_snapshot
    ) VALUES (
      v_po_id,
      p_organization_id,
      CASE WHEN p_item_kind = 'product' THEN v_product_id ELSE NULL END,
      CASE WHEN p_item_kind = 'product' THEN v_variant_id ELSE NULL END,
      CASE WHEN p_item_kind = 'ingredient' THEN v_ingredient_id ELSE NULL END,
      v_qty,
      v_unit_cost,
      v_subtotal,
      v_name
    );
  END LOOP;

  IF v_total <= 0 THEN
    DELETE FROM public.catalog_purchase_orders WHERE id = v_po_id;
    RAISE EXCEPTION 'catalog_po_lines_required';
  END IF;

  UPDATE public.catalog_purchase_orders
  SET total_value = v_total
  WHERE id = v_po_id;

  INSERT INTO public.catalog_purchase_order_events (
    purchase_order_id,
    organization_id,
    event_type,
    actor_user_id,
    actor_name_snapshot,
    comment
  ) VALUES (
    v_po_id,
    p_organization_id,
    'created',
    auth.uid(),
    v_actor,
    NULLIF(btrim(p_note), '')
  );

  IF p_create_and_fulfill IS TRUE THEN
    PERFORM public.fulfill_catalog_purchase_order(p_organization_id, v_po_id, NULL);
  END IF;

  SELECT * INTO v_po FROM public.catalog_purchase_orders WHERE id = v_po_id;
  RETURN to_jsonb(v_po);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_catalog_purchase_order(
  p_organization_id uuid,
  p_purchase_order_id uuid,
  p_note text,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po public.catalog_purchase_orders%ROWTYPE;
  v_line jsonb;
  v_qty numeric;
  v_unit_cost numeric;
  v_subtotal numeric;
  v_name text;
  v_total numeric(14, 2) := 0;
  v_actor text;
  v_product_id uuid;
  v_variant_id uuid;
  v_ingredient_id uuid;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_po_forbidden';
  END IF;

  SELECT * INTO v_po
  FROM public.catalog_purchase_orders
  WHERE id = p_purchase_order_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_po_not_found';
  END IF;
  IF v_po.status <> 'waiting' THEN
    RAISE EXCEPTION 'catalog_po_not_waiting';
  END IF;
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'catalog_po_lines_required';
  END IF;

  v_actor := public.catalog_po_actor_name(p_organization_id);

  DELETE FROM public.catalog_purchase_order_lines WHERE purchase_order_id = v_po.id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_qty := COALESCE((v_line ->> 'qty')::numeric, 0);
    v_unit_cost := COALESCE((v_line ->> 'unit_cost')::numeric, 0);
    v_name := COALESCE(NULLIF(btrim(v_line ->> 'name_snapshot'), ''), '—');
    v_product_id := NULLIF(v_line ->> 'product_id', '')::uuid;
    v_variant_id := NULLIF(v_line ->> 'variant_id', '')::uuid;
    v_ingredient_id := NULLIF(v_line ->> 'ingredient_id', '')::uuid;

    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_subtotal := ROUND(v_qty * v_unit_cost, 2);
    v_total := v_total + v_subtotal;

    INSERT INTO public.catalog_purchase_order_lines (
      purchase_order_id,
      organization_id,
      product_id,
      variant_id,
      ingredient_id,
      qty,
      unit_cost,
      subtotal,
      name_snapshot
    ) VALUES (
      v_po.id,
      p_organization_id,
      CASE WHEN v_po.item_kind = 'product' THEN v_product_id ELSE NULL END,
      CASE WHEN v_po.item_kind = 'product' THEN v_variant_id ELSE NULL END,
      CASE WHEN v_po.item_kind = 'ingredient' THEN v_ingredient_id ELSE NULL END,
      v_qty,
      v_unit_cost,
      v_subtotal,
      v_name
    );
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'catalog_po_lines_required';
  END IF;

  UPDATE public.catalog_purchase_orders
  SET
    note = NULLIF(btrim(p_note), ''),
    total_value = v_total,
    updated_at = now()
  WHERE id = v_po.id;

  INSERT INTO public.catalog_purchase_order_events (
    purchase_order_id,
    organization_id,
    event_type,
    actor_user_id,
    actor_name_snapshot,
    comment
  ) VALUES (
    v_po.id,
    p_organization_id,
    'edited',
    auth.uid(),
    v_actor,
    NULLIF(btrim(p_note), '')
  );

  RETURN to_jsonb((SELECT po FROM public.catalog_purchase_orders po WHERE po.id = v_po.id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_catalog_purchase_order(
  uuid, uuid, uuid, text, text, jsonb, boolean
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.fulfill_catalog_purchase_order(
  uuid, uuid, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_catalog_purchase_order(
  uuid, uuid, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_catalog_purchase_order(
  uuid, uuid, text, jsonb
) TO authenticated;
