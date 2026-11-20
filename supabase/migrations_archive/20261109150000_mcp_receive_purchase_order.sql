-- Terima barang PO lewat chat (MCP): daftar PO terbuka, preview, dan confirm penerimaan.
--
-- Aturan (diputuskan owner, 9 Nov 2026):
--   - Terima penuh saja: qty dan harga sesuai PO. Selisih dikoreksi lewat Stock Adjustment.
--   - Yang boleh menerima sama seperti tombol "Mark as Fulfilled": anggota organisasi; bila PO punya
--     purchase request (mode Advanced) wajib akses po_fulfillment dan purchase request approved + paid.
-- Penerimaan memanggil fulfill_catalog_purchase_order sebagai user sesi, jadi stok, avg cost, dan
-- riwayat PO sama persis dengan tombol di app. Expense tidak disentuh (purchase request sudah ada).
-- Semua fungsi di sini hanya untuk service_role (server MCP).

-- Anggota aktif organisasi; dipakai ketiga fungsi.
CREATE OR REPLACE FUNCTION public.mcp_po_receive_member_guard(p_user_id uuid, p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
END;
$fn$;

-- Status keuangan PO seperti badge "Finance" di halaman PO.
CREATE OR REPLACE FUNCTION public.mcp_po_finance_status(p_purchase_order_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE((
    SELECT CASE
      WHEN public.catalog_po_is_paid(pr.status, pr.payment_status, pr.paid_at) THEN 'paid'
      WHEN pr.status = 'approved' THEN 'approved'
      WHEN pr.status = 'rejected' THEN 'rejected'
      WHEN pr.status = 'cancelled' THEN 'cancelled'
      ELSE 'submitted'
    END
    FROM public.purchase_requests pr
    WHERE pr.catalog_purchase_order_id = p_purchase_order_id
    LIMIT 1
  ), 'none');
$fn$;

-- Isi PO + stok saat ini per baris (read only).
CREATE OR REPLACE FUNCTION public.mcp_po_receive_snapshot(p_organization_id uuid, p_purchase_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_po public.catalog_purchase_orders%ROWTYPE;
  v_outlet_name text;
  v_supplier_name text;
  v_lines jsonb;
BEGIN
  SELECT * INTO v_po
  FROM public.catalog_purchase_orders po
  WHERE po.id = p_purchase_order_id
    AND po.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_po_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT o.name INTO v_outlet_name FROM public.pos_outlets o WHERE o.id = v_po.outlet_id;
  SELECT s.name INTO v_supplier_name FROM public.catalog_suppliers s WHERE s.id = v_po.supplier_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'name', l.name_snapshot,
      'qty', l.qty,
      'unit_cost', l.unit_cost,
      'subtotal', l.subtotal,
      'stock_now', COALESCE(stock.in_stock, 0)
    ) ORDER BY l.created_at), '[]'::jsonb)
  INTO v_lines
  FROM public.catalog_purchase_order_lines l
  LEFT JOIN LATERAL (
    SELECT CASE
      WHEN l.ingredient_id IS NOT NULL THEN (
        SELECT io.in_stock FROM public.catalog_ingredient_outlets io
        WHERE io.ingredient_id = l.ingredient_id AND io.outlet_id = v_po.outlet_id)
      WHEN l.variant_id IS NOT NULL THEN (
        SELECT vo.in_stock FROM public.catalog_product_variant_outlets vo
        WHERE vo.variant_id = l.variant_id AND vo.outlet_id = v_po.outlet_id)
      ELSE (
        SELECT po2.in_stock FROM public.catalog_product_outlets po2
        WHERE po2.product_id = l.product_id AND po2.outlet_id = v_po.outlet_id)
    END AS in_stock
  ) stock ON true
  WHERE l.purchase_order_id = v_po.id;

  RETURN jsonb_build_object(
    'purchase_order_id', v_po.id,
    'order_number', v_po.order_number,
    'status', v_po.status,
    'kind', v_po.item_kind,
    'outlet_id', v_po.outlet_id,
    'outlet_name', COALESCE(v_outlet_name, '—'),
    'supplier_name', COALESCE(v_supplier_name, 'No Supplier'),
    'note', v_po.note,
    'occurred_at', v_po.occurred_at,
    'total_value', v_po.total_value,
    'finance_status', public.mcp_po_finance_status(v_po.id),
    'lines', v_lines
  );
END;
$fn$;

-- Daftar PO yang menunggu diterima (status waiting), terbaru dulu, maksimal 30.
CREATE OR REPLACE FUNCTION public.mcp_list_open_purchase_orders(
  p_user_id uuid,
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_rows jsonb;
BEGIN
  PERFORM public.mcp_po_receive_member_guard(p_user_id, p_organization_id);

  SELECT COALESCE(jsonb_agg(row_data ORDER BY occurred_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      po.occurred_at,
      jsonb_build_object(
        'purchase_order_id', po.id,
        'order_number', po.order_number,
        'outlet_name', COALESCE(o.name, '—'),
        'supplier_name', COALESCE(s.name, 'No Supplier'),
        'kind', po.item_kind,
        'occurred_at', po.occurred_at,
        'total_value', po.total_value,
        'items', (
          SELECT string_agg(l.name_snapshot || ' × ' || l.qty::text, ', ' ORDER BY l.created_at)
          FROM public.catalog_purchase_order_lines l
          WHERE l.purchase_order_id = po.id
        ),
        'finance_status', public.mcp_po_finance_status(po.id),
        'ready_to_receive', public.mcp_po_finance_status(po.id) IN ('none', 'paid')
      ) AS row_data
    FROM public.catalog_purchase_orders po
    LEFT JOIN public.pos_outlets o ON o.id = po.outlet_id
    LEFT JOIN public.catalog_suppliers s ON s.id = po.supplier_id
    WHERE po.organization_id = p_organization_id
      AND po.status = 'waiting'
      AND (p_outlet_id IS NULL OR po.outlet_id = p_outlet_id)
    ORDER BY po.occurred_at DESC
    LIMIT 30
  ) t;

  RETURN jsonb_build_object('purchase_orders', v_rows);
END;
$fn$;

-- Preview penerimaan satu PO. Tidak menyimpan apa pun. Cari lewat id atau nomor PO.
CREATE OR REPLACE FUNCTION public.mcp_preview_receive_purchase_order(
  p_user_id uuid,
  p_organization_id uuid,
  p_purchase_order_id uuid DEFAULT NULL,
  p_order_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_po_id uuid;
  v_number text;
  v_snapshot jsonb;
  v_po_mode text;
  v_finance text;
  v_blocked text := NULL;
BEGIN
  PERFORM public.mcp_po_receive_member_guard(p_user_id, p_organization_id);

  IF p_purchase_order_id IS NOT NULL THEN
    v_po_id := p_purchase_order_id;
  ELSE
    v_number := btrim(COALESCE(p_order_number, ''));
    IF v_number = '' OR char_length(v_number) > 40 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
    IF left(v_number, 1) <> '#' THEN
      v_number := '#' || v_number;
    END IF;
    SELECT po.id INTO v_po_id
    FROM public.catalog_purchase_orders po
    WHERE po.organization_id = p_organization_id
      AND po.order_number = v_number
    LIMIT 1;
    IF v_po_id IS NULL THEN
      RAISE EXCEPTION 'catalog_po_not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_snapshot := public.mcp_po_receive_snapshot(p_organization_id, v_po_id);
  v_po_mode := public.catalog_inventory_po_mode(p_organization_id);
  v_finance := v_snapshot ->> 'finance_status';

  -- Akses dicek sebagai user sesi, sama seperti tombol di app.
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);

  IF v_snapshot ->> 'status' <> 'waiting' THEN
    v_blocked := 'catalog_po_not_waiting';
  ELSIF v_finance <> 'none' THEN
    IF v_po_mode = 'advanced'
      AND NOT public.user_has_inventory_feature_access(p_organization_id, 'po_fulfillment') THEN
      v_blocked := 'catalog_inventory_feature_forbidden';
    ELSIF v_finance <> 'paid' THEN
      v_blocked := 'catalog_po_payment_required';
    END IF;
  END IF;

  RETURN v_snapshot || jsonb_build_object(
    'saved', false,
    'po_mode', v_po_mode,
    'can_receive', v_blocked IS NULL,
    'blocked_reason', v_blocked,
    'lines', (
      SELECT COALESCE(jsonb_agg(line || jsonb_build_object(
        'stock_after_expected', (line ->> 'stock_now')::numeric + (line ->> 'qty')::numeric
      )), '[]'::jsonb)
      FROM jsonb_array_elements(v_snapshot -> 'lines') line
    )
  );
END;
$fn$;

-- Terima PO yang sudah di-preview. Mencatat konfirmasi sekali pakai, lalu menjalankan fulfill sebagai user sesi.
CREATE OR REPLACE FUNCTION public.mcp_confirm_receive_purchase_order(
  p_confirm_id uuid,
  p_user_id uuid,
  p_organization_id uuid,
  p_purchase_order_id uuid,
  p_expected_total numeric,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_comment text;
  v_total numeric;
BEGIN
  IF p_confirm_id IS NULL OR p_purchase_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  PERFORM public.mcp_po_receive_member_guard(p_user_id, p_organization_id);

  v_comment := NULLIF(btrim(COALESCE(p_comment, '')), '');
  IF v_comment IS NOT NULL AND char_length(v_comment) > 500 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT po.total_value INTO v_total
  FROM public.catalog_purchase_orders po
  WHERE po.id = p_purchase_order_id
    AND po.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_po_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- PO diubah setelah preview: user harus melihat preview baru.
  IF p_expected_total IS NULL OR v_total IS DISTINCT FROM p_expected_total THEN
    RAISE EXCEPTION 'catalog_po_changed' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.mcp_tool_confirmations (id, organization_id, user_id, tool)
  VALUES (p_confirm_id, p_organization_id, p_user_id, 'inventory.purchase_order.receive');

  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);

  PERFORM public.fulfill_catalog_purchase_order(
    p_organization_id,
    p_purchase_order_id,
    COALESCE(v_comment, 'Diterima lewat chat')
  );

  RETURN public.mcp_po_receive_snapshot(p_organization_id, p_purchase_order_id)
    || jsonb_build_object('saved', true, 'stock_received', true);
END;
$fn$;

DO $grants$
DECLARE
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.mcp_po_receive_member_guard(uuid, uuid)',
    'public.mcp_po_finance_status(uuid)',
    'public.mcp_po_receive_snapshot(uuid, uuid)',
    'public.mcp_list_open_purchase_orders(uuid, uuid, uuid)',
    'public.mcp_preview_receive_purchase_order(uuid, uuid, uuid, text)',
    'public.mcp_confirm_receive_purchase_order(uuid, uuid, uuid, uuid, numeric, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
  END LOOP;
END;
$grants$;

NOTIFY pgrst, 'reload schema';
