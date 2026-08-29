DROP FUNCTION IF EXISTS public.pos_gross_profit_by_item(uuid, uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.pos_gross_profit_by_item(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
)
RETURNS TABLE (
  catalog_product_id uuid,
  catalog_variant_id uuid,
  product_name text,
  variant_name text,
  category_id uuid,
  category_name text,
  qty numeric,
  net_sales numeric,
  cogs numeric,
  gross_profit numeric,
  margin_pct numeric,
  cogs_incomplete boolean,
  cogs_estimated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
  WITH activity_gross AS (
    SELECT
      sai.sales_activity_id,
      COALESCE(SUM(COALESCE(sai.total_price, 0)), 0)::numeric AS lines_gross
    FROM public.sales_activity_items sai
    GROUP BY sai.sales_activity_id
  ),
  lines AS (
    SELECT
      sai.catalog_product_id AS product_id,
      sai.catalog_variant_id AS variant_id,
      dp.product_category_id AS cat_id,
      sai.service_name,
      sai.quantity,
      sai.total_price,
      sai.unit_cogs AS snapshot_cogs,
      sa.pos_outlet_id AS outlet_id,
      CASE
        WHEN ag.lines_gross > 0 AND sa.checkout_subtotal IS NOT NULL THEN
          COALESCE(sai.total_price, 0) * (
            public.pos_sales_activity_exclusive_net(
              sa.checkout_subtotal,
              sa.checkout_tax_amount,
              sa.checkout_gratuity_amount,
              COALESCE(sa.total_paid_amount, sa.total_amount, 0),
              sa.checkout_application_method
            ) / ag.lines_gross
          )
        ELSE COALESCE(sai.total_price, 0)
      END AS net_line_sales,
      CASE
        WHEN sai.unit_cogs IS NOT NULL THEN sai.unit_cogs
        WHEN sai.catalog_product_id IS NOT NULL AND sa.pos_outlet_id IS NOT NULL THEN
          public.pos_estimate_line_unit_cogs(
            p_organization_id,
            sa.pos_outlet_id,
            sai.catalog_product_id,
            sai.catalog_variant_id
          )
        ELSE NULL
      END AS resolved_unit_cogs,
      (sai.unit_cogs IS NULL) AS used_estimate_path
    FROM public.sales_activities sa
    JOIN public.sales_activity_items sai ON sai.sales_activity_id = sa.id
    JOIN activity_gross ag ON ag.sales_activity_id = sa.id
    LEFT JOIN public.default_prices dp ON dp.id = sai.catalog_product_id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
      AND sai.item_kind = 'product'
      AND (p_category_id IS NULL OR dp.product_category_id = p_category_id)
  ),
  grouped AS (
    SELECT
      l.product_id,
      l.variant_id,
      l.cat_id,
      COALESCE(
        NULLIF(MAX(dp.name), ''),
        NULLIF(MAX(l.service_name), ''),
        'Unlinked'
      )::text AS product_name,
      NULLIF(MAX(cv.name), '')::text AS variant_name,
      NULLIF(MAX(cat.name), '')::text AS category_name,
      COALESCE(SUM(COALESCE(l.quantity, 0)), 0)::numeric AS qty,
      COALESCE(SUM(COALESCE(l.net_line_sales, 0)), 0)::numeric AS net_sales,
      COALESCE(SUM(COALESCE(l.resolved_unit_cogs, 0) * COALESCE(l.quantity, 0)), 0)::numeric AS cogs,
      COALESCE(BOOL_OR(l.resolved_unit_cogs IS NULL), false) AS cogs_incomplete,
      COALESCE(
        BOOL_OR(l.used_estimate_path AND l.resolved_unit_cogs IS NOT NULL),
        false
      ) AS cogs_estimated
    FROM lines l
    LEFT JOIN public.default_prices dp ON dp.id = l.product_id
    LEFT JOIN public.catalog_product_variants cv ON cv.id = l.variant_id
    LEFT JOIN public.catalog_product_categories cat ON cat.id = l.cat_id
    GROUP BY l.product_id, l.variant_id, l.cat_id
  )
  SELECT
    g.product_id AS catalog_product_id,
    g.variant_id AS catalog_variant_id,
    g.product_name,
    g.variant_name,
    g.cat_id AS category_id,
    g.category_name,
    g.qty,
    g.net_sales,
    g.cogs,
    (g.net_sales - g.cogs)::numeric AS gross_profit,
    CASE
      WHEN g.net_sales > 0 THEN ROUND(((g.net_sales - g.cogs) / g.net_sales) * 100, 2)
      ELSE 0::numeric
    END AS margin_pct,
    g.cogs_incomplete,
    g.cogs_estimated
  FROM grouped g
  ORDER BY (g.net_sales - g.cogs) DESC, g.net_sales DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_gross_profit_by_item(uuid, uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_gross_profit_by_item(uuid, uuid, timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_gross_profit_by_item(uuid, uuid, timestamptz, timestamptz, uuid) TO service_role;
