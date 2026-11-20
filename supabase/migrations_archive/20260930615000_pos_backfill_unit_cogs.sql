-- One-shot / on-demand backfill of legacy sales_activity_items.unit_cogs via estimate.

CREATE OR REPLACE FUNCTION public.pos_backfill_sales_item_unit_cogs(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL
)
RETURNS TABLE (
  updated_count bigint,
  skipped_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated bigint := 0;
  v_skipped bigint := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
      RAISE EXCEPTION 'not_authenticated';
    END IF;
  ELSIF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  WITH candidates AS (
    SELECT
      sai.id,
      sa.pos_outlet_id AS outlet_id,
      sai.catalog_product_id,
      sai.catalog_variant_id
    FROM public.sales_activity_items sai
    JOIN public.sales_activities sa ON sa.id = sai.sales_activity_id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND sai.item_kind = 'product'
      AND sai.unit_cogs IS NULL
      AND sai.catalog_product_id IS NOT NULL
      AND sa.pos_outlet_id IS NOT NULL
  ),
  priced AS (
    SELECT
      c.id,
      public.pos_estimate_line_unit_cogs(
        p_organization_id,
        c.outlet_id,
        c.catalog_product_id,
        c.catalog_variant_id
      ) AS estimated_cogs
    FROM candidates c
  ),
  updated AS (
    UPDATE public.sales_activity_items sai
    SET
      unit_cogs = p.estimated_cogs,
      cogs_source = 'estimated'
    FROM priced p
    WHERE sai.id = p.id
      AND p.estimated_cogs IS NOT NULL
    RETURNING sai.id
  )
  SELECT COUNT(*) INTO v_updated FROM updated;

  SELECT COUNT(*)::bigint INTO v_skipped
  FROM public.sales_activity_items sai
  JOIN public.sales_activities sa ON sa.id = sai.sales_activity_id
  WHERE sa.organization_id = p_organization_id
    AND sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
    AND sai.item_kind = 'product'
    AND sai.unit_cogs IS NULL;

  RETURN QUERY SELECT v_updated, v_skipped;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_backfill_sales_item_unit_cogs(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_backfill_sales_item_unit_cogs(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_backfill_sales_item_unit_cogs(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.pos_backfill_sales_item_unit_cogs(uuid, uuid) IS
  'Fill null unit_cogs on product lines from pos_estimate_line_unit_cogs; sets cogs_source=estimated. Does not overwrite snapshots.';
