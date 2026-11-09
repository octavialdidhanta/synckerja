-- Tutup celah adjustment stok.
--
-- app_apply_catalog_stock_movement hanya mengecek keanggotaan organisasi. Tombol Adjustment di app hanya untuk
-- Owner/Admin, tapi anggota lain (mis. kasir) bisa memanggil RPC ini langsung dan mengubah stok.
-- Sekarang movement 'adjustment' hanya untuk Owner, Admin organisasi, atau Admin omnichannel
-- (public.catalog_can_adjust_stock, dari 20261109160000) dan wajib alasan (note).
-- 'opening' (stok awal saat item mulai di-track) tidak berubah.
--
-- Terapkan SETELAH frontend yang mengirim alasan dari form item/bahan sudah ter-deploy.

CREATE OR REPLACE FUNCTION public.app_apply_catalog_stock_movement(p_organization_id uuid, p_outlet_id uuid, p_item_kind text, p_product_id uuid, p_variant_id uuid, p_ingredient_id uuid, p_movement_type text, p_qty_delta numeric, p_reference_type text, p_reference_id text, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_movement_type NOT IN ('opening', 'adjustment') THEN
    RAISE EXCEPTION 'catalog_stock_movement_type_invalid' USING ERRCODE = '22023';
  END IF;

  -- Adjustment: hanya Owner/Admin, dan wajib alasan.
  IF p_movement_type = 'adjustment' THEN
    IF NOT public.catalog_can_adjust_stock(auth.uid(), p_organization_id) THEN
      RAISE EXCEPTION 'catalog_adjustment_forbidden' USING ERRCODE = '42501';
    END IF;
    IF NULLIF(btrim(COALESCE(p_note, '')), '') IS NULL THEN
      RAISE EXCEPTION 'catalog_adjustment_reason_required' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_qty_delta IS NULL OR abs(p_qty_delta) > 1000000000 THEN
    RAISE EXCEPTION 'catalog_stock_qty_invalid' USING ERRCODE = '22023';
  END IF;

  IF length(COALESCE(p_note, '')) > 1000 OR length(COALESCE(p_reference_type, '')) > 64
     OR length(COALESCE(p_reference_id, '')) > 64 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pos_outlets o
    WHERE o.id = p_outlet_id AND o.organization_id = p_organization_id AND NOT COALESCE(o.is_deleted, false)
  ) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_item_kind = 'ingredient' THEN
    IF p_product_id IS NOT NULL OR p_variant_id IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM public.catalog_ingredients i
      WHERE i.id = p_ingredient_id AND i.organization_id = p_organization_id AND NOT COALESCE(i.is_deleted, false)
    ) THEN
      RAISE EXCEPTION 'catalog_stock_forbidden' USING ERRCODE = '42501';
    END IF;
  ELSIF p_item_kind = 'product' THEN
    IF p_ingredient_id IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM public.default_prices dp
      WHERE dp.id = p_product_id AND dp.organization_id = p_organization_id
    ) THEN
      RAISE EXCEPTION 'catalog_stock_forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_variant_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.catalog_product_variants v
      WHERE v.id = p_variant_id AND v.product_id = p_product_id
    ) THEN
      RAISE EXCEPTION 'catalog_stock_forbidden' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'catalog_stock_kind_invalid' USING ERRCODE = '22023';
  END IF;

  RETURN public.apply_catalog_stock_movement(
    p_organization_id, p_outlet_id, p_item_kind, p_product_id, p_variant_id, p_ingredient_id,
    p_movement_type, p_qty_delta, p_reference_type, p_reference_id, p_note
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.app_apply_catalog_stock_movement(uuid, uuid, text, uuid, uuid, uuid, text, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_apply_catalog_stock_movement(uuid, uuid, text, uuid, uuid, uuid, text, numeric, text, text, text) TO authenticated, service_role;
