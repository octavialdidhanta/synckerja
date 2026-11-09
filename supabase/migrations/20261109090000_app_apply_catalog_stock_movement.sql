-- App-facing stock movement RPC.
--
-- apply_catalog_stock_movement was revoked from authenticated in the RPC security hardening
-- (20261102150000) because it only checks organization membership: it does not verify that the
-- outlet, ingredient or product belong to that organization, and it accepts any movement type.
-- The app still needs to record opening stock and manual adjustments, so this wrapper validates
-- ownership and limits the movement types before calling the internal function.

CREATE OR REPLACE FUNCTION public.app_apply_catalog_stock_movement(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_item_kind text,
  p_product_id uuid,
  p_variant_id uuid,
  p_ingredient_id uuid,
  p_movement_type text,
  p_qty_delta numeric,
  p_reference_type text,
  p_reference_id text,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL OR p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'catalog_stock_forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_movement_type NOT IN ('opening', 'adjustment') THEN
    RAISE EXCEPTION 'catalog_stock_movement_type_invalid' USING ERRCODE = '22023';
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
$fn$;

REVOKE ALL ON FUNCTION public.app_apply_catalog_stock_movement(uuid,uuid,text,uuid,uuid,uuid,text,numeric,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_apply_catalog_stock_movement(uuid,uuid,text,uuid,uuid,uuid,text,numeric,text,text,text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
