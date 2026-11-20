-- Brand Sales report: aggregate Store Checkout product lines by catalog brand

CREATE OR REPLACE FUNCTION public.pos_brand_sales_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  brand_id uuid,
  brand_name text,
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
        ELSE dp.product_brand_id
      END AS brand_id,
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
      l.brand_id,
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
    GROUP BY l.brand_id
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
        ELSE dp.product_brand_id
      END AS brand_id,
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
      l.brand_id,
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
    GROUP BY l.brand_id
  ),
  refund_qty_grouped AS (
    SELECT
      dp.product_brand_id AS brand_id,
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
    GROUP BY dp.product_brand_id
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
      dp.product_brand_id AS brand_id,
      CASE
        WHEN ran.bill_net > 0 AND ag.lines_gross > 0 THEN
          COALESCE(sai.total_price, 0) / ag.lines_gross * ran.refund_total
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
      ral.brand_id,
      COALESCE(SUM(COALESCE(ral.refund_line_amount, 0)), 0)::numeric AS refund_amount
    FROM refund_amount_lines ral
    GROUP BY ral.brand_id
  ),
  merged AS (
    SELECT
      sg.brand_id,
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
    LEFT JOIN refund_qty_grouped rq ON rq.brand_id IS NOT DISTINCT FROM sg.brand_id
    LEFT JOIN refund_amount_grouped ra ON ra.brand_id IS NOT DISTINCT FROM sg.brand_id
    UNION ALL
    SELECT
      rq.brand_id,
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
    LEFT JOIN refund_amount_grouped ra ON ra.brand_id IS NOT DISTINCT FROM rq.brand_id
    WHERE NOT EXISTS (
      SELECT 1 FROM sold_grouped sg WHERE sg.brand_id IS NOT DISTINCT FROM rq.brand_id
    )
    UNION ALL
    SELECT
      ra.brand_id,
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
      SELECT 1 FROM sold_grouped sg WHERE sg.brand_id IS NOT DISTINCT FROM ra.brand_id
    )
      AND NOT EXISTS (
      SELECT 1 FROM refund_qty_grouped rq WHERE rq.brand_id IS NOT DISTINCT FROM ra.brand_id
    )
  ),
  rolled AS (
    SELECT
      m.brand_id,
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
    GROUP BY m.brand_id
  )
  SELECT
    r.brand_id,
    COALESCE(NULLIF(b.name, ''), 'Unbranded')::text AS brand_name,
    COALESCE(b.sort_order, 9999)::integer AS sort_order,
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
  LEFT JOIN public.catalog_brands b ON b.id = r.brand_id
  WHERE r.qty_sold > 0
     OR r.qty_refunded > 0
     OR r.gross_sales > 0
     OR r.refund_amount > 0
  ORDER BY r.gross_sales DESC, COALESCE(b.name, 'Unbranded') ASC;
END;
$$;

-- Brand Sales by item (product/variant/bundle under brand)

CREATE OR REPLACE FUNCTION public.pos_brand_sales_by_item(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  brand_id uuid,
  brand_name text,
  brand_sort_order integer,
  catalog_product_id uuid,
  catalog_variant_id uuid,
  catalog_bundle_id uuid,
  item_name text,
  variant_name text,
  sku text,
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
  sold_lines AS (
    SELECT
      CASE WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL ELSE dp.product_brand_id END AS brand_id,
      CASE WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL ELSE sai.catalog_product_id END AS product_id,
      CASE WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL ELSE sai.catalog_variant_id END AS variant_id,
      sai.catalog_bundle_id AS bundle_id,
      sai.service_name,
      sai.quantity,
      sai.inventory_sku_id,
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
      (sai.unit_cogs IS NULL AND sai.catalog_bundle_id IS NULL) AS used_estimate_path
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
      l.brand_id,
      l.product_id,
      l.variant_id,
      l.bundle_id,
      COALESCE(
        NULLIF(MAX(cb.name), ''),
        NULLIF(MAX(dp.name), ''),
        NULLIF(MAX(l.service_name), ''),
        'Unlinked'
      )::text AS product_name,
      CASE WHEN l.bundle_id IS NOT NULL THEN NULL ELSE NULLIF(MAX(cv.name), '') END::text AS variant_name,
      CASE
        WHEN l.bundle_id IS NOT NULL THEN NULL
        ELSE COALESCE(
          NULLIF(MAX(cv.sku), ''),
          NULLIF(MAX(dp.sku), ''),
          NULLIF(MAX(isk.internal_sku), '')
        )
      END::text AS resolved_sku,
      COALESCE(SUM(COALESCE(l.quantity, 0)), 0)::numeric AS qty_sold,
      COALESCE(SUM(COALESCE(l.net_line_sales, 0)), 0)::numeric AS net_sales,
      COALESCE(SUM(COALESCE(l.discount_line, 0)), 0)::numeric AS discount_amount,
      COALESCE(SUM(COALESCE(l.net_line_sales, 0) + COALESCE(l.discount_line, 0)), 0)::numeric AS gross_sales,
      COALESCE(SUM(COALESCE(l.resolved_unit_cogs, 0) * COALESCE(l.quantity, 0)), 0)::numeric AS cogs,
      COALESCE(BOOL_OR(l.resolved_unit_cogs IS NULL AND l.bundle_id IS NULL), false) AS cogs_incomplete,
      COALESCE(
        BOOL_OR(l.used_estimate_path AND l.resolved_unit_cogs IS NOT NULL),
        false
      ) AS cogs_estimated
    FROM sold_lines l
    LEFT JOIN public.default_prices dp ON dp.id = l.product_id
    LEFT JOIN public.catalog_product_variants cv ON cv.id = l.variant_id
    LEFT JOIN public.catalog_bundles cb ON cb.id = l.bundle_id
    LEFT JOIN public.inventory_skus isk ON isk.id = l.inventory_sku_id
    GROUP BY
      l.brand_id,
      l.product_id,
      l.variant_id,
      l.bundle_id,
      CASE
        WHEN l.product_id IS NULL AND l.bundle_id IS NULL
        THEN lower(btrim(COALESCE(l.service_name, '')))
        ELSE NULL
      END
  ),
  refund_qty_grouped AS (
    SELECT
      dp.product_brand_id AS brand_id,
      rcl.catalog_product_id AS product_id,
      rcl.catalog_variant_id AS variant_id,
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
    GROUP BY dp.product_brand_id, rcl.catalog_product_id, rcl.catalog_variant_id
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
      dp.product_brand_id AS brand_id,
      CASE WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL ELSE sai.catalog_product_id END AS product_id,
      CASE WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL ELSE sai.catalog_variant_id END AS variant_id,
      sai.catalog_bundle_id AS bundle_id,
      CASE
        WHEN ran.bill_net > 0 AND ag.lines_gross > 0 THEN
          COALESCE(sai.total_price, 0) / ag.lines_gross * ran.refund_total
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
      ral.brand_id,
      ral.product_id,
      ral.variant_id,
      ral.bundle_id,
      COALESCE(SUM(COALESCE(ral.refund_line_amount, 0)), 0)::numeric AS refund_amount
    FROM refund_amount_lines ral
    GROUP BY ral.brand_id, ral.product_id, ral.variant_id, ral.bundle_id
  ),
  merged AS (
    SELECT
      sg.brand_id,
      sg.product_id,
      sg.variant_id,
      sg.bundle_id,
      sg.product_name,
      sg.variant_name,
      sg.resolved_sku,
      sg.qty_sold,
      COALESCE(rq.qty_refunded, 0)::numeric AS qty_refunded,
      sg.gross_sales,
      sg.net_sales,
      sg.discount_amount,
      COALESCE(ra.refund_amount, 0)::numeric AS refund_amount,
      sg.cogs,
      sg.cogs_incomplete,
      sg.cogs_estimated
    FROM sold_grouped sg
    LEFT JOIN refund_qty_grouped rq
      ON sg.brand_id IS NOT DISTINCT FROM rq.brand_id
     AND sg.product_id IS NOT DISTINCT FROM rq.product_id
     AND sg.variant_id IS NOT DISTINCT FROM rq.variant_id
     AND sg.bundle_id IS NULL
    LEFT JOIN refund_amount_grouped ra
      ON sg.brand_id IS NOT DISTINCT FROM ra.brand_id
     AND sg.product_id IS NOT DISTINCT FROM ra.product_id
     AND sg.variant_id IS NOT DISTINCT FROM ra.variant_id
     AND sg.bundle_id IS NOT DISTINCT FROM ra.bundle_id
    UNION ALL
    SELECT
      rq.brand_id,
      rq.product_id,
      rq.variant_id,
      NULL::uuid AS bundle_id,
      COALESCE(NULLIF(dp.name, ''), 'Unlinked')::text AS product_name,
      NULLIF(cv.name, '')::text AS variant_name,
      COALESCE(NULLIF(cv.sku, ''), NULLIF(dp.sku, ''))::text AS resolved_sku,
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
    LEFT JOIN public.default_prices dp ON dp.id = rq.product_id
    LEFT JOIN public.catalog_product_variants cv ON cv.id = rq.variant_id
    LEFT JOIN refund_amount_grouped ra
      ON rq.brand_id IS NOT DISTINCT FROM ra.brand_id
     AND rq.product_id IS NOT DISTINCT FROM ra.product_id
     AND rq.variant_id IS NOT DISTINCT FROM ra.variant_id
     AND ra.bundle_id IS NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM sold_grouped sg
      WHERE sg.brand_id IS NOT DISTINCT FROM rq.brand_id
        AND sg.product_id IS NOT DISTINCT FROM rq.product_id
        AND sg.variant_id IS NOT DISTINCT FROM rq.variant_id
        AND sg.bundle_id IS NULL
    )
  )
  SELECT
    m.brand_id,
    COALESCE(NULLIF(b.name, ''), 'Unbranded')::text AS brand_name,
    COALESCE(b.sort_order, 9999)::integer AS brand_sort_order,
    m.product_id AS catalog_product_id,
    m.variant_id AS catalog_variant_id,
    m.bundle_id AS catalog_bundle_id,
    COALESCE(m.product_name, 'Unlinked')::text AS item_name,
    m.variant_name,
    m.resolved_sku AS sku,
    m.qty_sold,
    m.qty_refunded,
    m.gross_sales,
    m.net_sales,
    m.discount_amount,
    m.refund_amount,
    m.cogs,
    (m.net_sales - m.cogs)::numeric AS gross_profit,
    CASE
      WHEN m.net_sales > 0 THEN ROUND(((m.net_sales - m.cogs) / m.net_sales) * 100, 2)
      ELSE 0::numeric
    END AS margin_pct,
    m.cogs_incomplete,
    m.cogs_estimated
  FROM merged m
  LEFT JOIN public.catalog_brands b ON b.id = m.brand_id
  WHERE m.qty_sold > 0
     OR m.qty_refunded > 0
     OR m.gross_sales > 0
     OR m.refund_amount > 0
  ORDER BY COALESCE(b.sort_order, 9999), COALESCE(b.name, 'Unbranded'), m.net_sales DESC;
END;
$$;

-- Brand Sales by outlet (all outlets; for export)

CREATE OR REPLACE FUNCTION public.pos_brand_sales_by_outlet(
  p_organization_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  brand_id uuid,
  brand_name text,
  outlet_id uuid,
  outlet_name text,
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
  sold_lines AS (
    SELECT
      sa.pos_outlet_id AS outlet_id,
      CASE
        WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL
        ELSE dp.product_brand_id
      END AS brand_id,
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
      AND sa.pos_outlet_id IS NOT NULL
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
      l.brand_id,
      l.outlet_id,
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
    GROUP BY l.brand_id, l.outlet_id
  ),
  refund_qty_grouped AS (
    SELECT
      dp.product_brand_id AS brand_id,
      sa.pos_outlet_id AS outlet_id,
      COALESCE(SUM(COALESCE(rcl.quantity, 0)), 0)::numeric AS qty_refunded
    FROM public.pos_sales_refund_cogs_lines rcl
    JOIN public.pos_sales_refunds pr ON pr.id = rcl.refund_id
    JOIN public.sales_activities sa ON sa.id = pr.sales_activity_id
    LEFT JOIN public.default_prices dp ON dp.id = rcl.catalog_product_id
    WHERE sa.organization_id = p_organization_id
      AND sa.refund_status = 'full'
      AND sa.refunded_at IS NOT NULL
      AND sa.pos_outlet_id IS NOT NULL
      AND (p_from IS NULL OR sa.refunded_at >= p_from)
      AND (p_to IS NULL OR sa.refunded_at < p_to)
    GROUP BY dp.product_brand_id, sa.pos_outlet_id
  ),
  refund_activity_net AS (
    SELECT
      sa.id AS activity_id,
      sa.pos_outlet_id AS outlet_id,
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
      AND sa.pos_outlet_id IS NOT NULL
      AND (p_from IS NULL OR sa.refunded_at >= p_from)
      AND (p_to IS NULL OR sa.refunded_at < p_to)
  ),
  refund_amount_lines AS (
    SELECT
      ran.outlet_id,
      dp.product_brand_id AS brand_id,
      CASE
        WHEN ran.bill_net > 0 AND ag.lines_gross > 0 THEN
          COALESCE(sai.total_price, 0) / ag.lines_gross * ran.refund_total
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
      ral.brand_id,
      ral.outlet_id,
      COALESCE(SUM(COALESCE(ral.refund_line_amount, 0)), 0)::numeric AS refund_amount
    FROM refund_amount_lines ral
    GROUP BY ral.brand_id, ral.outlet_id
  ),
  merged AS (
    SELECT
      sg.brand_id,
      sg.outlet_id,
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
    LEFT JOIN refund_qty_grouped rq
      ON rq.brand_id IS NOT DISTINCT FROM sg.brand_id
     AND rq.outlet_id = sg.outlet_id
    LEFT JOIN refund_amount_grouped ra
      ON ra.brand_id IS NOT DISTINCT FROM sg.brand_id
     AND ra.outlet_id = sg.outlet_id
    UNION ALL
    SELECT
      rq.brand_id,
      rq.outlet_id,
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
    LEFT JOIN refund_amount_grouped ra
      ON ra.brand_id IS NOT DISTINCT FROM rq.brand_id
     AND ra.outlet_id = rq.outlet_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM sold_grouped sg
      WHERE sg.brand_id IS NOT DISTINCT FROM rq.brand_id
        AND sg.outlet_id = rq.outlet_id
    )
    UNION ALL
    SELECT
      ra.brand_id,
      ra.outlet_id,
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
      SELECT 1
      FROM sold_grouped sg
      WHERE sg.brand_id IS NOT DISTINCT FROM ra.brand_id
        AND sg.outlet_id = ra.outlet_id
    )
      AND NOT EXISTS (
      SELECT 1
      FROM refund_qty_grouped rq
      WHERE rq.brand_id IS NOT DISTINCT FROM ra.brand_id
        AND rq.outlet_id = ra.outlet_id
    )
  ),
  rolled AS (
    SELECT
      m.brand_id,
      m.outlet_id,
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
    GROUP BY m.brand_id, m.outlet_id
  )
  SELECT
    r.brand_id,
    COALESCE(NULLIF(b.name, ''), 'Unbranded')::text AS brand_name,
    r.outlet_id,
    COALESCE(NULLIF(o.name, ''), 'Outlet')::text AS outlet_name,
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
    r.cogs_estimated
  FROM rolled r
  LEFT JOIN public.catalog_brands b ON b.id = r.brand_id
  LEFT JOIN public.pos_outlets o ON o.id = r.outlet_id
  WHERE r.qty_sold > 0
     OR r.qty_refunded > 0
     OR r.gross_sales > 0
     OR r.refund_amount > 0
  ORDER BY COALESCE(b.name, 'Unbranded'), COALESCE(o.name, 'Outlet');
END;
$$;

REVOKE ALL ON FUNCTION public.pos_brand_sales_report(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_brand_sales_report(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_brand_sales_report(uuid, uuid, timestamptz, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.pos_brand_sales_by_item(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_brand_sales_by_item(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_brand_sales_by_item(uuid, uuid, timestamptz, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.pos_brand_sales_by_outlet(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_brand_sales_by_outlet(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_brand_sales_by_outlet(uuid, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.pos_brand_sales_report(uuid, uuid, timestamptz, timestamptz) IS
  'Brand Sales rollup: qty sold/refunded, gross/net/discount/refund, COGS per catalog brand.';

COMMENT ON FUNCTION public.pos_brand_sales_by_item(uuid, uuid, timestamptz, timestamptz) IS
  'Brand Sales item breakdown under each brand (product/variant/bundle grain).';

COMMENT ON FUNCTION public.pos_brand_sales_by_outlet(uuid, timestamptz, timestamptz) IS
  'Brand Sales by outlet for export (all outlets in org).';
