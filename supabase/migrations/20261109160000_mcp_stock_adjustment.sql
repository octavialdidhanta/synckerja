-- Stock adjustment lewat chat (MCP) + helper hak akses. Hanya fungsi baru untuk service_role; app tidak berubah.
--
-- Chat: inventory.adjustment.preview / inventory.adjustment.create memakai pola preview → ya → simpan,
-- menulis lewat app_apply_catalog_stock_movement dengan reference_type 'inventory_adjustment'
-- sehingga muncul di tab Adjustment. Hanya Owner, Admin organisasi, atau Admin omnichannel; wajib alasan.

-- Owner, Admin organisasi, atau Admin omnichannel (sama dengan yang melihat tombol Adjustment).
CREATE OR REPLACE FUNCTION public.catalog_can_adjust_stock(p_user_id uuid, p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT p_user_id IS NOT NULL AND p_organization_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id
        AND ur.organization_id = p_organization_id
        AND ur.role::text IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_omnichannel_staff staff
      JOIN public.employees employee ON employee.id = staff.employee_id AND employee.user_id = p_user_id
      WHERE staff.organization_id = p_organization_id
        AND staff.role = 'admin'::text
    )
  );
$fn$;

REVOKE ALL ON FUNCTION public.catalog_can_adjust_stock(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_can_adjust_stock(uuid, uuid) TO service_role;

-- Cari satu item yang di-track stoknya di outlet, dengan nama persis (bahan, produk tanpa varian, atau varian).
CREATE OR REPLACE FUNCTION public.mcp_adjustment_resolve_item(p_organization_id uuid, p_outlet_id uuid, p_search text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_search text := btrim(COALESCE(p_search, ''));
  v_count integer := 0;
  v_labels text[] := ARRAY[]::text[];
  v_found jsonb;
  r record;
BEGIN
  IF v_search = '' OR char_length(v_search) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  FOR r IN
    SELECT * FROM (
      SELECT 'ingredient'::text AS kind, NULL::uuid AS product_id, NULL::uuid AS variant_id, i.id AS ingredient_id,
             i.name AS label, io.in_stock AS qty_before
      FROM public.catalog_ingredients i
      JOIN public.catalog_ingredient_outlets io ON io.ingredient_id = i.id AND io.outlet_id = p_outlet_id
      WHERE i.organization_id = p_organization_id AND NOT COALESCE(i.is_deleted, false)
        AND i.track_inventory = true AND lower(btrim(i.name)) = lower(v_search)
      UNION ALL
      SELECT 'product', dp.id, NULL, NULL, dp.name, link.in_stock
      FROM public.default_prices dp
      JOIN public.catalog_product_outlets link ON link.product_id = dp.id AND link.outlet_id = p_outlet_id
      WHERE dp.organization_id = p_organization_id AND dp.kind = 'product' AND dp.track_stock = true
        AND lower(btrim(dp.name)) = lower(v_search)
        AND NOT EXISTS (SELECT 1 FROM public.catalog_product_variants v WHERE v.product_id = dp.id)
      UNION ALL
      SELECT 'product', dp.id, v.id, NULL, dp.name || ' / ' || v.name, COALESCE(vo.in_stock, 0)
      FROM public.default_prices dp
      JOIN public.catalog_product_outlets link ON link.product_id = dp.id AND link.outlet_id = p_outlet_id
      JOIN public.catalog_product_variants v ON v.product_id = dp.id
      LEFT JOIN public.catalog_product_variant_outlets vo ON vo.variant_id = v.id AND vo.outlet_id = p_outlet_id
      WHERE dp.organization_id = p_organization_id AND dp.kind = 'product' AND dp.track_stock = true
        AND (lower(btrim(v.name)) = lower(v_search) OR lower(dp.name || ' / ' || v.name) = lower(v_search))
    ) found
    ORDER BY label
  LOOP
    v_count := v_count + 1;
    v_labels := v_labels || r.label;
    v_found := jsonb_build_object(
      'kind', r.kind, 'product_id', r.product_id, 'variant_id', r.variant_id,
      'ingredient_id', r.ingredient_id, 'name', r.label, 'qty_before', COALESCE(r.qty_before, 0)
    );
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_count > 1 THEN
    RAISE EXCEPTION '%', 'ambiguous: ' || array_to_string(v_labels, ' | ') USING ERRCODE = '22023';
  END IF;
  RETURN v_found;
END;
$fn$;

-- Preview adjustment: tidak menyimpan apa pun. Isi tepat satu dari p_set_to (stok fisik) atau p_change (+/-).
CREATE OR REPLACE FUNCTION public.mcp_preview_stock_adjustment(
  p_user_id uuid,
  p_organization_id uuid,
  p_outlet_id uuid,
  p_search text,
  p_set_to numeric,
  p_change numeric,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_item jsonb;
  v_before numeric;
  v_delta numeric;
  v_outlet_name text;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id AND uo.organization_id = p_organization_id AND COALESCE(uo.is_active, true)
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
  IF NOT public.catalog_can_adjust_stock(p_user_id, p_organization_id) THEN
    RAISE EXCEPTION 'catalog_adjustment_forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'catalog_adjustment_reason_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) > 500 OR (p_set_to IS NULL) = (p_change IS NULL)
     OR (p_set_to IS NOT NULL AND p_set_to < 0) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT o.name INTO v_outlet_name
  FROM public.pos_outlets o
  WHERE o.id = p_outlet_id AND o.organization_id = p_organization_id AND NOT COALESCE(o.is_deleted, false);
  IF v_outlet_name IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  v_item := public.mcp_adjustment_resolve_item(p_organization_id, p_outlet_id, p_search);
  v_before := (v_item ->> 'qty_before')::numeric;
  v_delta := COALESCE(p_set_to - v_before, p_change);

  IF v_delta = 0 OR abs(v_delta) > 1000000000 THEN
    RAISE EXCEPTION 'catalog_adjustment_no_change' USING ERRCODE = '22023';
  END IF;

  RETURN v_item || jsonb_build_object(
    'saved', false,
    'outlet_id', p_outlet_id,
    'outlet_name', v_outlet_name,
    'qty_change', v_delta,
    'qty_after', v_before + v_delta,
    'reason', v_reason
  );
END;
$fn$;

-- Simpan adjustment yang sudah di-preview. Mencatat konfirmasi sekali pakai, lalu menulis lewat RPC app sebagai user sesi.
-- Ditolak bila stok berubah sejak preview (stock_changed), supaya yang disimpan sama dengan yang dilihat user.
CREATE OR REPLACE FUNCTION public.mcp_confirm_stock_adjustment(
  p_confirm_id uuid,
  p_user_id uuid,
  p_organization_id uuid,
  p_outlet_id uuid,
  p_item_kind text,
  p_product_id uuid,
  p_variant_id uuid,
  p_ingredient_id uuid,
  p_qty_before numeric,
  p_qty_change numeric,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_now numeric;
  v_result jsonb;
BEGIN
  IF p_confirm_id IS NULL OR p_qty_change IS NULL OR p_qty_change = 0
     OR NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id AND uo.organization_id = p_organization_id AND COALESCE(uo.is_active, true)
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
  IF NOT public.catalog_can_adjust_stock(p_user_id, p_organization_id) THEN
    RAISE EXCEPTION 'catalog_adjustment_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_item_kind = 'ingredient' THEN
    SELECT io.in_stock INTO v_now FROM public.catalog_ingredient_outlets io
    WHERE io.ingredient_id = p_ingredient_id AND io.outlet_id = p_outlet_id;
  ELSIF p_variant_id IS NOT NULL THEN
    SELECT COALESCE((SELECT vo.in_stock FROM public.catalog_product_variant_outlets vo
      WHERE vo.variant_id = p_variant_id AND vo.outlet_id = p_outlet_id), 0) INTO v_now;
  ELSE
    SELECT link.in_stock INTO v_now FROM public.catalog_product_outlets link
    WHERE link.product_id = p_product_id AND link.outlet_id = p_outlet_id;
  END IF;

  IF COALESCE(v_now, 0) IS DISTINCT FROM p_qty_before THEN
    RAISE EXCEPTION 'catalog_adjustment_stock_changed' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.mcp_tool_confirmations (id, organization_id, user_id, tool)
  VALUES (p_confirm_id, p_organization_id, p_user_id, 'inventory.adjustment.create');

  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);

  v_result := public.app_apply_catalog_stock_movement(
    p_organization_id, p_outlet_id, p_item_kind, p_product_id, p_variant_id, p_ingredient_id,
    'adjustment', p_qty_change, 'inventory_adjustment', p_confirm_id::text,
    btrim(p_reason) || ' (lewat chat)'
  );

  RETURN jsonb_build_object(
    'saved', true,
    'qty_before', p_qty_before,
    'qty_change', p_qty_change,
    'qty_after', p_qty_before + p_qty_change,
    'movement', v_result
  );
END;
$fn$;

DO $grants$
DECLARE
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.mcp_adjustment_resolve_item(uuid, uuid, text)',
    'public.mcp_preview_stock_adjustment(uuid, uuid, uuid, text, numeric, numeric, text)',
    'public.mcp_confirm_stock_adjustment(uuid, uuid, uuid, uuid, text, uuid, uuid, uuid, numeric, numeric, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
  END LOOP;
END;
$grants$;

NOTIFY pgrst, 'reload schema';
