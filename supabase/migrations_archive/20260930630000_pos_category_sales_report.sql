-- Category Sales report: aggregate Store Checkout product lines by catalog category

CREATE OR REPLACE FUNCTION public.pos_category_sales_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  sort_order integer,
  qty_sold numeric,
  qty_refunded numeric,
  gross_sales numeric,
  net_sales numeric,
  discount_amount numeric,
  refund_amount numeric,
  cogs numeric,
  gross_profit numeric,
  margin_pct numeric,
  cogs_incomplete boolean,
  cogs_estimated boolean,
  summary_product_net_sales numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary_product_net numeric := 0;
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

  WITH activity_gross AS (
    SELECT
      sai.sales_activity_id,
      COALESCE(SUM(COALESCE(sai.total_price, 0)), 0)::numeric AS lines_gross
    FROM public.sales_activity_items sai
    GROUP BY sai.sales_activity_id
  ),
  sold_lines AS (
    SELECT
      CASE
        WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL
        ELSE dp.product_category_id
      END AS cat_id,
      sai.quantity,
      CASE
        WHEN ag.lines_gross > 0 THEN
          COALESCE(sai.total_price, 0) / ag.lines_gross * public.pos_sales_activity_exclusive_net(
            sa.checkout_subtotal,
            sa.checkout_tax_amount,
            sa.checkout_gratuity_amount,
            COALESCE(sa.total_paid_amount, sa.total_amount, 0),
            sa.checkout_application_method
          )
        ELSE COALESCE(sai.total_price, 0)
      END AS net_line_sales,
      CASE
        WHEN ag.lines_gross > 0 THEN
          COALESCE(sai.total_price, 0) / ag.lines_gross * COALESCE(sa.checkout_discount_amount, 0)
        ELSE 0::numeric
      END AS discount_line,
      CASE
        WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL
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
      (sai.unit_cogs IS NULL AND sai.catalog_bundle_id IS NULL) AS used_estimate_path,
      sai.catalog_bundle_id IS NOT NULL AS is_bundle_line
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
      AND (
        sai.item_kind = 'product'
        OR sai.catalog_bundle_id IS NOT NULL
      )
      AND sai.item_kind <> 'service'
  ),
  sold_grouped AS (
    SELECT
      l.cat_id,
      COALESCE(SUM(COALESCE(l.quantity, 0)), 0)::numeric AS qty_sold,
      COALESCE(SUM(COALESCE(l.net_line_sales, 0)), 0)::numeric AS net_sales,
      COALESCE(SUM(COALESCE(l.discount_line, 0)), 0)::numeric AS discount_amount,
      COALESCE(SUM(COALESCE(l.net_line_sales, 0) + COALESCE(l.discount_line, 0)), 0)::numeric AS gross_sales,
      COALESCE(SUM(COALESCE(l.resolved_unit_cogs, 0) * COALESCE(l.quantity, 0)), 0)::numeric AS cogs,
      COALESCE(BOOL_OR(l.resolved_unit_cogs IS NULL AND NOT l.is_bundle_line), false) AS cogs_incomplete,
      COALESCE(
        BOOL_OR(l.used_estimate_path AND l.resolved_unit_cogs IS NOT NULL),
        false
      ) AS cogs_estimated
    FROM sold_lines l
    GROUP BY l.cat_id
  ),
  summary AS (
    SELECT COALESCE(SUM(sg.net_sales), 0)::numeric AS product_net
    FROM sold_grouped sg
  )
  SELECT s.product_net INTO v_summary_product_net FROM summary s;

  RETURN QUERY
  WITH activity_gross AS (
    SELECT
      sai.sales_activity_id,
      COALESCE(SUM(COALESCE(sai.total_price, 0)), 0)::numeric AS lines_gross
    FROM public.sales_activity_items sai
    GROUP BY sai.sales_activity_id
  ),
  sold_lines AS (
    SELECT
      CASE
        WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL
        ELSE dp.product_category_id
      END AS cat_id,
      sai.quantity,
      CASE
        WHEN ag.lines_gross > 0 THEN
          COALESCE(sai.total_price, 0) / ag.lines_gross * public.pos_sales_activity_exclusive_net(
            sa.checkout_subtotal,
            sa.checkout_tax_amount,
            sa.checkout_gratuity_amount,
            COALESCE(sa.total_paid_amount, sa.total_amount, 0),
            sa.checkout_application_method
          )
        ELSE COALESCE(sai.total_price, 0)
      END AS net_line_sales,
      CASE
        WHEN ag.lines_gross > 0 THEN
          COALESCE(sai.total_price, 0) / ag.lines_gross * COALESCE(sa.checkout_discount_amount, 0)
        ELSE 0::numeric
      END AS discount_line,
      CASE
        WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL
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
      (sai.unit_cogs IS NULL AND sai.catalog_bundle_id IS NULL) AS used_estimate_path,
      sai.catalog_bundle_id IS NOT NULL AS is_bundle_line
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
      AND (
        sai.item_kind = 'product'
        OR sai.catalog_bundle_id IS NOT NULL
      )
      AND sai.item_kind <> 'service'
  ),
  sold_grouped AS (
    SELECT
      l.cat_id,
      COALESCE(SUM(COALESCE(l.quantity, 0)), 0)::numeric AS qty_sold,
      COALESCE(SUM(COALESCE(l.net_line_sales, 0)), 0)::numeric AS net_sales,
      COALESCE(SUM(COALESCE(l.discount_line, 0)), 0)::numeric AS discount_amount,
      COALESCE(SUM(COALESCE(l.net_line_sales, 0) + COALESCE(l.discount_line, 0)), 0)::numeric AS gross_sales,
      COALESCE(SUM(COALESCE(l.resolved_unit_cogs, 0) * COALESCE(l.quantity, 0)), 0)::numeric AS cogs,
      COALESCE(BOOL_OR(l.resolved_unit_cogs IS NULL AND NOT l.is_bundle_line), false) AS cogs_incomplete,
      COALESCE(
        BOOL_OR(l.used_estimate_path AND l.resolved_unit_cogs IS NOT NULL),
        false
      ) AS cogs_estimated
    FROM sold_lines l
    GROUP BY l.cat_id
  ),
  refund_qty_grouped AS (
    SELECT
      dp.product_category_id AS cat_id,
      COALESCE(SUM(COALESCE(rcl.quantity, 0)), 0)::numeric AS qty_refunded
    FROM public.pos_sales_refund_cogs_lines rcl
    JOIN public.pos_sales_refunds pr ON pr.id = rcl.refund_id
    JOIN public.sales_activities sa ON sa.id = pr.sales_activity_id
    LEFT JOIN public.default_prices dp ON dp.id = rcl.catalog_product_id
    WHERE sa.organization_id = p_organization_id
      AND sa.refund_status = 'full'
      AND sa.refunded_at IS NOT NULL
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.refunded_at >= p_from)
      AND (p_to IS NULL OR sa.refunded_at < p_to)
    GROUP BY dp.product_category_id
  ),
  refund_activity_net AS (
    SELECT
      sa.id AS activity_id,
      public.pos_sales_activity_exclusive_net(
        sa.checkout_subtotal,
        sa.checkout_tax_amount,
        sa.checkout_gratuity_amount,
        COALESCE(sa.total_paid_amount, sa.total_amount, 0),
        sa.checkout_application_method
      ) AS bill_net,
      COALESCE(sa.refund_amount, 0)::numeric AS refund_total
    FROM public.sales_activities sa
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND sa.refund_status = 'full'
      AND sa.refunded_at IS NOT NULL
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.refunded_at >= p_from)
      AND (p_to IS NULL OR sa.refunded_at < p_to)
  ),
  refund_amount_lines AS (
    SELECT
      dp.product_category_id AS cat_id,
      CASE
        WHEN ran.bill_net > 0 AND ag.lines_gross > 0 THEN
          (COALESCE(sai.total_price, 0) / ag.lines_gross * ran.bill_net) / ran.bill_net * ran.refund_total
        ELSE 0::numeric
      END AS refund_line_amount
    FROM refund_activity_net ran
    JOIN public.sales_activity_items sai ON sai.sales_activity_id = ran.activity_id
    JOIN activity_gross ag ON ag.sales_activity_id = ran.activity_id
    LEFT JOIN public.default_prices dp ON dp.id = sai.catalog_product_id
    WHERE sai.item_kind = 'product'
       OR sai.catalog_bundle_id IS NOT NULL
  ),
  refund_amount_grouped AS (
    SELECT
      ral.cat_id,
      COALESCE(SUM(COALESCE(ral.refund_line_amount, 0)), 0)::numeric AS refund_amount
    FROM refund_amount_lines ral
    GROUP BY ral.cat_id
  ),
  merged AS (
    SELECT
      sg.cat_id,
      COALESCE(sg.qty_sold, 0)::numeric AS qty_sold,
      COALESCE(rq.qty_refunded, 0)::numeric AS qty_refunded,
      COALESCE(sg.gross_sales, 0)::numeric AS gross_sales,
      COALESCE(sg.net_sales, 0)::numeric AS net_sales,
      COALESCE(sg.discount_amount, 0)::numeric AS discount_amount,
      COALESCE(ra.refund_amount, 0)::numeric AS refund_amount,
      COALESCE(sg.cogs, 0)::numeric AS cogs,
      COALESCE(sg.cogs_incomplete, false) AS cogs_incomplete,
      COALESCE(sg.cogs_estimated, false) AS cogs_estimated
    FROM sold_grouped sg
    LEFT JOIN refund_qty_grouped rq ON rq.cat_id IS NOT DISTINCT FROM sg.cat_id
    LEFT JOIN refund_amount_grouped ra ON ra.cat_id IS NOT DISTINCT FROM sg.cat_id
    UNION ALL
    SELECT
      rq.cat_id,
      0::numeric AS qty_sold,
      rq.qty_refunded,
      0::numeric AS gross_sales,
      0::numeric AS net_sales,
      0::numeric AS discount_amount,
      COALESCE(ra.refund_amount, 0)::numeric AS refund_amount,
      0::numeric AS cogs,
      false AS cogs_incomplete,
      false AS cogs_estimated
    FROM refund_qty_grouped rq
    LEFT JOIN refund_amount_grouped ra ON ra.cat_id IS NOT DISTINCT FROM rq.cat_id
    WHERE NOT EXISTS (
      SELECT 1 FROM sold_grouped sg WHERE sg.cat_id IS NOT DISTINCT FROM rq.cat_id
    )
    UNION ALL
    SELECT
      ra.cat_id,
      0::numeric AS qty_sold,
      0::numeric AS qty_refunded,
      0::numeric AS gross_sales,
      0::numeric AS net_sales,
      0::numeric AS discount_amount,
      ra.refund_amount,
      0::numeric AS cogs,
      false AS cogs_incomplete,
      false AS cogs_estimated
    FROM refund_amount_grouped ra
    WHERE NOT EXISTS (
      SELECT 1 FROM sold_grouped sg WHERE sg.cat_id IS NOT DISTINCT FROM ra.cat_id
    )
      AND NOT EXISTS (
      SELECT 1 FROM refund_qty_grouped rq WHERE rq.cat_id IS NOT DISTINCT FROM ra.cat_id
    )
  ),
  rolled AS (
    SELECT
      m.cat_id,
      COALESCE(SUM(m.qty_sold), 0)::numeric AS qty_sold,
      COALESCE(SUM(m.qty_refunded), 0)::numeric AS qty_refunded,
      COALESCE(SUM(m.gross_sales), 0)::numeric AS gross_sales,
      COALESCE(SUM(m.net_sales), 0)::numeric AS net_sales,
      COALESCE(SUM(m.discount_amount), 0)::numeric AS discount_amount,
      COALESCE(SUM(m.refund_amount), 0)::numeric AS refund_amount,
      COALESCE(SUM(m.cogs), 0)::numeric AS cogs,
      COALESCE(BOOL_OR(m.cogs_incomplete), false) AS cogs_incomplete,
      COALESCE(BOOL_OR(m.cogs_estimated), false) AS cogs_estimated
    FROM merged m
    GROUP BY m.cat_id
  )
  SELECT
    r.cat_id AS category_id,
    COALESCE(NULLIF(cat.name, ''), 'Uncategorized')::text AS category_name,
    COALESCE(cat.sort_order, 9999)::integer AS sort_order,
    r.qty_sold,
    r.qty_refunded,
    r.gross_sales,
    r.net_sales,
    r.discount_amount,
    r.refund_amount,
    r.cogs,
    (r.net_sales - r.cogs)::numeric AS gross_profit,
    CASE
      WHEN r.net_sales > 0 THEN ROUND(((r.net_sales - r.cogs) / r.net_sales) * 100, 2)
      ELSE 0::numeric
    END AS margin_pct,
    r.cogs_incomplete,
    r.cogs_estimated,
    v_summary_product_net AS summary_product_net_sales
  FROM rolled r
  LEFT JOIN public.catalog_product_categories cat ON cat.id = r.cat_id
  WHERE r.qty_sold > 0
     OR r.qty_refunded > 0
     OR r.gross_sales > 0
     OR r.refund_amount > 0
  ORDER BY r.gross_sales DESC, COALESCE(cat.name, 'Uncategorized') ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_category_sales_report(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_category_sales_report(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_category_sales_report(uuid, uuid, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.pos_category_sales_report(uuid, uuid, timestamptz, timestamptz) IS
  'Category Sales: qty sold/refunded, gross/net/discount/refund amount, COGS per product category.';
