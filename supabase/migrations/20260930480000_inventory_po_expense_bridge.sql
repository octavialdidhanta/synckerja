-- Bridge catalog purchase orders to purchase_requests (approvals → payment → expenses).
-- New POs only; legacy POs without a linked request keep previous fulfill/cancel behavior.

ALTER TABLE public.catalog_suppliers
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_account_holder text;

ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS catalog_purchase_order_id uuid
    REFERENCES public.catalog_purchase_orders (id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_requests_catalog_po_unique'
  ) THEN
    ALTER TABLE public.purchase_requests
      ADD CONSTRAINT purchase_requests_catalog_po_unique UNIQUE (catalog_purchase_order_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_requests_org_catalog_po
  ON public.purchase_requests (organization_id, catalog_purchase_order_id)
  WHERE catalog_purchase_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.catalog_po_format_qty(p_qty numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
BEGIN
  s := COALESCE(p_qty, 0)::text;
  IF s LIKE '%.%' THEN
    s := rtrim(rtrim(s, '0'), '.');
  END IF;
  RETURN COALESCE(NULLIF(s, ''), '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_po_format_idr(p_amount numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'Rp ' || replace(trim(to_char(ROUND(COALESCE(p_amount, 0), 0), 'FM999,999,999,990')), ',', '.');
$$;

CREATE OR REPLACE FUNCTION public.catalog_po_is_paid(p_status text, p_payment_status text, p_paid_at timestamptz)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_paid_at, NULL) IS NOT NULL
    OR lower(COALESCE(p_payment_status, '')) = 'paid';
$$;

CREATE OR REPLACE FUNCTION public.resolve_inventory_po_expense_classification(
  p_organization_id uuid,
  p_item_kind text
)
RETURNS TABLE(expense_type_id uuid, expense_category_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type_id uuid;
  v_cat_id uuid;
  v_cat_name text;
BEGIN
  v_cat_name := CASE WHEN p_item_kind = 'product' THEN 'Item Library' ELSE 'Ingredients' END;

  SELECT et.id
    INTO v_type_id
  FROM public.expense_types et
  WHERE et.is_active IS TRUE
    AND lower(btrim(et.name)) <> 'internal bank transfer'
    AND (
      lower(et.name) LIKE '%cogs%'
      OR lower(et.name) LIKE '%harga pokok%'
      OR lower(et.name) LIKE '%inventory%'
      OR lower(et.name) LIKE '%bahan baku%'
    )
    AND (et.organization_id = p_organization_id OR et.organization_id IS NULL)
  ORDER BY
    CASE WHEN et.organization_id = p_organization_id THEN 0 ELSE 1 END,
    et.created_at NULLS LAST
  LIMIT 1;

  IF v_type_id IS NULL THEN
    INSERT INTO public.expense_types (
      name, description, organization_id, is_active, is_default
    ) VALUES (
      'COGS / Inventory',
      'Auto-created for inventory purchase orders',
      p_organization_id,
      true,
      false
    )
    RETURNING id INTO v_type_id;
  END IF;

  SELECT ec.id
    INTO v_cat_id
  FROM public.expense_categories ec
  WHERE ec.expense_type_id = v_type_id
    AND ec.is_active IS TRUE
    AND lower(btrim(ec.name)) = lower(v_cat_name)
    AND (ec.organization_id = p_organization_id OR ec.organization_id IS NULL)
  ORDER BY
    CASE WHEN ec.organization_id = p_organization_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_cat_id IS NULL THEN
    INSERT INTO public.expense_categories (
      name, description, expense_type_id, organization_id, is_active, is_default
    ) VALUES (
      v_cat_name,
      'Auto-created for inventory purchase orders',
      v_type_id,
      p_organization_id,
      true,
      false
    )
    RETURNING id INTO v_cat_id;
  END IF;

  expense_type_id := v_type_id;
  expense_category_id := v_cat_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_catalog_po_purchase_request(p_purchase_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po public.catalog_purchase_orders%ROWTYPE;
  v_outlet_name text;
  v_supplier_name text;
  v_bank_code text;
  v_bank_number text;
  v_bank_holder text;
  v_title text;
  v_description text;
  v_lines text;
  v_purchase_type text;
  v_class record;
  v_actor text;
  v_uid uuid;
  v_qty_sum numeric;
  v_pr_id uuid;
  v_existing public.purchase_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_po
  FROM public.catalog_purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_po_not_found';
  END IF;

  SELECT NULLIF(btrim(o.name), '') INTO v_outlet_name
  FROM public.pos_outlets o
  WHERE o.id = v_po.outlet_id;

  SELECT
    NULLIF(btrim(s.name), ''),
    NULLIF(btrim(s.bank_code), ''),
    NULLIF(btrim(s.bank_account_number), ''),
    NULLIF(btrim(s.bank_account_holder), '')
  INTO v_supplier_name, v_bank_code, v_bank_number, v_bank_holder
  FROM public.catalog_suppliers s
  WHERE s.id = v_po.supplier_id;

  SELECT string_agg(
    COALESCE(NULLIF(btrim(l.name_snapshot), ''), '—')
      || ' × '
      || COALESCE(public.catalog_po_format_qty(l.qty), l.qty::text)
      || ' @ '
      || public.catalog_po_format_idr(l.unit_cost),
    E'\n'
    ORDER BY l.created_at
  ), COALESCE(SUM(l.qty), 0)
  INTO v_lines, v_qty_sum
  FROM public.catalog_purchase_order_lines l
  WHERE l.purchase_order_id = v_po.id;

  v_title := 'PO ' || v_po.order_number || ' — ' || COALESCE(v_outlet_name, 'Outlet');
  v_description := concat_ws(
    E'\n\n',
    NULLIF(btrim(v_po.note), ''),
    'Outlet: ' || COALESCE(v_outlet_name, '—'),
    COALESCE(v_lines, '—')
  );
  v_purchase_type := CASE WHEN v_po.item_kind = 'product' THEN 'Inventory Item' ELSE 'Inventory' END;

  SELECT * INTO v_class
  FROM public.resolve_inventory_po_expense_classification(v_po.organization_id, v_po.item_kind);

  v_uid := auth.uid();
  v_actor := COALESCE(public.catalog_po_actor_name(v_po.organization_id), 'UNKNOWN');

  SELECT * INTO v_existing
  FROM public.purchase_requests
  WHERE catalog_purchase_order_id = v_po.id
  FOR UPDATE;

  IF FOUND THEN
    IF public.catalog_po_is_paid(v_existing.status, v_existing.payment_status, v_existing.paid_at) THEN
      RAISE EXCEPTION 'catalog_po_already_paid';
    END IF;
    IF v_existing.status = 'approved' THEN
      RAISE EXCEPTION 'catalog_po_already_approved';
    END IF;

    UPDATE public.purchase_requests
    SET
      request_title = v_title,
      amount_idr = v_po.total_value,
      quantity = GREATEST(1, ROUND(v_qty_sum)::integer),
      description = v_description,
      vendor_name = v_supplier_name,
      vendor_bank_code = v_bank_code,
      vendor_bank_account_number = v_bank_number,
      vendor_bank_account_holder = v_bank_holder,
      purchase_type = v_purchase_type,
      expense_type_id = v_class.expense_type_id,
      expense_category_id = v_class.expense_category_id,
      updated_at = now()
    WHERE id = v_existing.id;

    RETURN v_existing.id;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'catalog_po_forbidden';
  END IF;

  INSERT INTO public.purchase_requests (
    organization_id,
    requester_id,
    requester_name,
    department_name,
    request_type,
    purchase_type,
    request_title,
    amount_idr,
    quantity,
    is_recurring,
    description,
    company_benefit,
    vendor_name,
    vendor_bank_code,
    vendor_bank_account_number,
    vendor_bank_account_holder,
    status,
    submitted_at,
    created_by,
    expense_type_id,
    expense_category_id,
    payment_status,
    catalog_purchase_order_id
  ) VALUES (
    v_po.organization_id,
    v_uid,
    v_actor,
    NULL,
    'purchase',
    v_purchase_type,
    v_title,
    v_po.total_value,
    GREATEST(1, ROUND(v_qty_sum)::integer),
    false,
    v_description,
    'Inventory restock for ' || COALESCE(v_outlet_name, 'outlet'),
    v_supplier_name,
    v_bank_code,
    v_bank_number,
    v_bank_holder,
    'submitted',
    now(),
    v_uid,
    v_class.expense_type_id,
    v_class.expense_category_id,
    'pending',
    v_po.id
  )
  RETURNING id INTO v_pr_id;

  RETURN v_pr_id;
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
  v_pr public.purchase_requests%ROWTYPE;
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

  SELECT * INTO v_pr
  FROM public.purchase_requests
  WHERE catalog_purchase_order_id = v_po.id
  LIMIT 1;

  IF FOUND THEN
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
  v_pr public.purchase_requests%ROWTYPE;
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

  SELECT * INTO v_pr
  FROM public.purchase_requests
  WHERE catalog_purchase_order_id = v_po.id
  FOR UPDATE;

  IF FOUND AND public.catalog_po_is_paid(v_pr.status, v_pr.payment_status, v_pr.paid_at) THEN
    RAISE EXCEPTION 'catalog_po_already_paid';
  END IF;

  v_actor := public.catalog_po_actor_name(p_organization_id);

  UPDATE public.catalog_purchase_orders
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    updated_at = now()
  WHERE id = v_po.id;

  IF v_pr.id IS NOT NULL AND v_pr.status <> 'cancelled' THEN
    UPDATE public.purchase_requests
    SET
      status = 'cancelled',
      updated_at = now()
    WHERE id = v_pr.id;
  END IF;

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
  IF p_create_and_fulfill IS TRUE THEN
    RAISE EXCEPTION 'catalog_po_create_and_fulfill_disabled';
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

  PERFORM public.sync_catalog_po_purchase_request(v_po_id);

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
  v_pr public.purchase_requests%ROWTYPE;
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

  SELECT * INTO v_pr
  FROM public.purchase_requests
  WHERE catalog_purchase_order_id = v_po.id
  FOR UPDATE;

  IF FOUND THEN
    IF public.catalog_po_is_paid(v_pr.status, v_pr.payment_status, v_pr.paid_at) THEN
      RAISE EXCEPTION 'catalog_po_already_paid';
    END IF;
    IF v_pr.status = 'approved' THEN
      RAISE EXCEPTION 'catalog_po_already_approved';
    END IF;
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

  IF v_pr.id IS NOT NULL THEN
    PERFORM public.sync_catalog_po_purchase_request(v_po.id);
  END IF;

  RETURN to_jsonb((SELECT po FROM public.catalog_purchase_orders po WHERE po.id = v_po.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.resubmit_catalog_po_purchase_request(
  p_organization_id uuid,
  p_purchase_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po public.catalog_purchase_orders%ROWTYPE;
  v_pr public.purchase_requests%ROWTYPE;
  v_pr_id uuid;
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

  SELECT * INTO v_pr
  FROM public.purchase_requests
  WHERE catalog_purchase_order_id = v_po.id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_pr_id := public.sync_catalog_po_purchase_request(v_po.id);
    RETURN to_jsonb((SELECT r FROM public.purchase_requests r WHERE r.id = v_pr_id));
  END IF;

  IF v_pr.status <> 'rejected' THEN
    RAISE EXCEPTION 'catalog_po_not_rejected';
  END IF;

  v_pr_id := public.sync_catalog_po_purchase_request(v_po.id);

  UPDATE public.purchase_requests
  SET
    status = 'submitted',
    submitted_at = now(),
    rejected_at = NULL,
    rejected_by = NULL,
    rejected_by_user_id = NULL,
    rejected_by_name = NULL,
    rejection_reason = NULL,
    approval_notes = NULL,
    payment_status = 'pending',
    updated_at = now()
  WHERE id = v_pr_id;

  RETURN to_jsonb((SELECT r FROM public.purchase_requests r WHERE r.id = v_pr_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.catalog_po_format_qty(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_po_format_idr(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_po_is_paid(text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_inventory_po_expense_classification(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_catalog_po_purchase_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resubmit_catalog_po_purchase_request(uuid, uuid) TO authenticated;
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
