-- PO workflow mode enforcement: simple (create_and_fulfill, skip PR) vs advanced (expense bridge + role gates).

CREATE OR REPLACE FUNCTION public.catalog_inventory_po_mode(p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.po_mode FROM public.catalog_inventory_settings s WHERE s.organization_id = p_organization_id),
    'simple'
  );
$$;

REVOKE ALL ON FUNCTION public.catalog_inventory_po_mode(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_inventory_po_mode(uuid) TO authenticated;

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
  v_pr public.purchase_requests%ROWTYPE;
  v_po_mode text;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_po_forbidden';
  END IF;

  v_po_mode := public.catalog_inventory_po_mode(p_organization_id);

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

  SELECT * INTO v_pr
  FROM public.purchase_requests
  WHERE catalog_purchase_order_id = v_po.id
  LIMIT 1;

  IF FOUND THEN
    IF v_po_mode = 'advanced'
      AND NOT public.user_has_inventory_feature_access(p_organization_id, 'po_fulfillment')
    THEN
      RAISE EXCEPTION 'catalog_inventory_feature_forbidden';
    END IF;

    IF v_pr.status <> 'approved'
      OR NOT public.catalog_po_is_paid(v_pr.status, v_pr.payment_status, v_pr.paid_at)
    THEN
      RAISE EXCEPTION 'catalog_po_payment_required';
    END IF;
  END IF;

  v_item_kind := v_po.item_kind;
  v_actor := public.catalog_po_actor_name(p_organization_id);

  FOR v_line IN
    SELECT *
    FROM public.catalog_purchase_order_lines
    WHERE purchase_order_id = v_po.id
    ORDER BY created_at
  LOOP
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
  v_po_mode text;
BEGIN
  v_po_mode := public.catalog_inventory_po_mode(p_organization_id);

  IF v_po_mode = 'advanced' THEN
    IF p_create_and_fulfill IS TRUE THEN
      RAISE EXCEPTION 'catalog_po_create_and_fulfill_disabled';
    END IF;
    IF NOT public.user_has_inventory_feature_access(p_organization_id, 'po_request') THEN
      RAISE EXCEPTION 'catalog_inventory_feature_forbidden';
    END IF;
  ELSIF p_create_and_fulfill IS NOT TRUE THEN
    RAISE EXCEPTION 'catalog_po_create_and_fulfill_required';
  END IF;

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

  IF v_po_mode = 'advanced' THEN
    PERFORM public.sync_catalog_po_purchase_request(v_po_id);
  ELSE
    PERFORM public.fulfill_catalog_purchase_order(p_organization_id, v_po_id, NULL);
  END IF;

  SELECT * INTO v_po FROM public.catalog_purchase_orders WHERE id = v_po_id;
  RETURN to_jsonb(v_po);
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_inventory_guard_pr_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.catalog_purchase_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('approved', 'rejected')
    AND public.catalog_inventory_po_mode(NEW.organization_id) = 'advanced'
    AND NOT public.user_has_inventory_feature_access(NEW.organization_id, 'po_approval')
  THEN
    RAISE EXCEPTION 'catalog_inventory_feature_forbidden';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_inventory_guard_pr_approval_trg ON public.purchase_requests;
CREATE TRIGGER catalog_inventory_guard_pr_approval_trg
  BEFORE UPDATE OF status ON public.purchase_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_inventory_guard_pr_approval();

GRANT EXECUTE ON FUNCTION public.create_catalog_purchase_order(
  uuid, uuid, uuid, text, text, jsonb, boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_catalog_purchase_order(
  uuid, uuid, text
) TO authenticated;
