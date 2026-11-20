-- Item Sales Fase B: catalog_bundle_id on checkout lines + hourly RPC + bundle grouping in summary

ALTER TABLE public.sales_activity_items
  ADD COLUMN IF NOT EXISTS catalog_bundle_id uuid REFERENCES public.catalog_bundles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_activity_items_catalog_bundle
  ON public.sales_activity_items (organization_id, catalog_bundle_id)
  WHERE catalog_bundle_id IS NOT NULL;

COMMENT ON COLUMN public.sales_activity_items.catalog_bundle_id IS
  'Bundle package sold on this line. Used by Item Sales report for bundle-level aggregation.';

CREATE OR REPLACE FUNCTION public.pos_item_sales_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
)
RETURNS TABLE (
  catalog_product_id uuid,
  catalog_variant_id uuid,
  catalog_bundle_id uuid,
  item_name text,
  variant_name text,
  sku text,
  category_id uuid,
  category_name text,
  qty_sold numeric,
  qty_refunded numeric,
  gross_sales numeric,
  net_sales numeric,
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
      CASE WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL ELSE sai.catalog_product_id END AS product_id,
      CASE WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL ELSE sai.catalog_variant_id END AS variant_id,
      sai.catalog_bundle_id AS bundle_id,
      dp.product_category_id AS cat_id,
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
      AND (
        p_category_id IS NULL
        OR sai.catalog_bundle_id IS NOT NULL
        OR dp.product_category_id = p_category_id
      )
  ),
  sold_grouped AS (
    SELECT
      l.product_id,
      l.variant_id,
      l.bundle_id,
      l.cat_id,
      COALESCE(
        NULLIF(MAX(cb.name), ''),
        NULLIF(MAX(dp.name), ''),
        NULLIF(MAX(l.service_name), ''),
        'Unlinked'
      )::text AS product_name,
      CASE WHEN l.bundle_id IS NOT NULL THEN NULL ELSE NULLIF(MAX(cv.name), '') END::text AS variant_name,
      CASE WHEN l.bundle_id IS NOT NULL THEN NULL ELSE NULLIF(MAX(cat.name), '') END::text AS category_name,
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
    LEFT JOIN public.catalog_product_categories cat ON cat.id = l.cat_id
    LEFT JOIN public.catalog_bundles cb ON cb.id = l.bundle_id
    LEFT JOIN public.inventory_skus isk ON isk.id = l.inventory_sku_id
    GROUP BY
      l.product_id,
      l.variant_id,
      l.bundle_id,
      l.cat_id,
      CASE
        WHEN l.product_id IS NULL AND l.bundle_id IS NULL
        THEN lower(btrim(COALESCE(l.service_name, '')))
        ELSE NULL
      END
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
      CASE WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL ELSE sai.catalog_product_id END AS product_id,
      CASE WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL ELSE sai.catalog_variant_id END AS variant_id,
      sai.catalog_bundle_id AS bundle_id,
      dp.product_category_id AS cat_id,
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
      AND (
        p_category_id IS NULL
        OR sai.catalog_bundle_id IS NOT NULL
        OR dp.product_category_id = p_category_id
      )
  ),
  sold_grouped AS (
    SELECT
      l.product_id,
      l.variant_id,
      l.bundle_id,
      l.cat_id,
      COALESCE(
        NULLIF(MAX(cb.name), ''),
        NULLIF(MAX(dp.name), ''),
        NULLIF(MAX(l.service_name), ''),
        'Unlinked'
      )::text AS product_name,
      CASE WHEN l.bundle_id IS NOT NULL THEN NULL ELSE NULLIF(MAX(cv.name), '') END::text AS variant_name,
      CASE WHEN l.bundle_id IS NOT NULL THEN NULL ELSE NULLIF(MAX(cat.name), '') END::text AS category_name,
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
    LEFT JOIN public.catalog_product_categories cat ON cat.id = l.cat_id
    LEFT JOIN public.catalog_bundles cb ON cb.id = l.bundle_id
    LEFT JOIN public.inventory_skus isk ON isk.id = l.inventory_sku_id
    GROUP BY
      l.product_id,
      l.variant_id,
      l.bundle_id,
      l.cat_id,
      CASE
        WHEN l.product_id IS NULL AND l.bundle_id IS NULL
        THEN lower(btrim(COALESCE(l.service_name, '')))
        ELSE NULL
      END
  ),
  refund_grouped AS (
    SELECT
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
      AND (p_category_id IS NULL OR dp.product_category_id = p_category_id)
    GROUP BY rcl.catalog_product_id, rcl.catalog_variant_id
  ),
  merged AS (
    SELECT
      sg.product_id,
      sg.variant_id,
      sg.bundle_id,
      sg.cat_id,
      sg.product_name,
      sg.variant_name,
      sg.category_name,
      sg.resolved_sku,
      sg.qty_sold,
      COALESCE(rg.qty_refunded, 0)::numeric AS qty_refunded,
      sg.gross_sales,
      sg.net_sales,
      sg.cogs,
      sg.cogs_incomplete,
      sg.cogs_estimated
    FROM sold_grouped sg
    LEFT JOIN refund_grouped rg
      ON sg.product_id IS NOT DISTINCT FROM rg.product_id
     AND sg.variant_id IS NOT DISTINCT FROM rg.variant_id
     AND sg.bundle_id IS NULL
    UNION ALL
    SELECT
      rg.product_id,
      rg.variant_id,
      NULL::uuid AS bundle_id,
      dp.product_category_id AS cat_id,
      COALESCE(NULLIF(dp.name, ''), 'Unlinked')::text AS product_name,
      NULLIF(cv.name, '')::text AS variant_name,
      NULLIF(cat.name, '')::text AS category_name,
      COALESCE(NULLIF(cv.sku, ''), NULLIF(dp.sku, ''))::text AS resolved_sku,
      0::numeric AS qty_sold,
      rg.qty_refunded,
      0::numeric AS gross_sales,
      0::numeric AS net_sales,
      0::numeric AS cogs,
      false AS cogs_incomplete,
      false AS cogs_estimated
    FROM refund_grouped rg
    LEFT JOIN public.default_prices dp ON dp.id = rg.product_id
    LEFT JOIN public.catalog_product_variants cv ON cv.id = rg.variant_id
    LEFT JOIN public.catalog_product_categories cat ON cat.id = dp.product_category_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM sold_grouped sg
      WHERE sg.product_id IS NOT DISTINCT FROM rg.product_id
        AND sg.variant_id IS NOT DISTINCT FROM rg.variant_id
        AND sg.bundle_id IS NULL
    )
  )
  SELECT
    m.product_id AS catalog_product_id,
    m.variant_id AS catalog_variant_id,
    m.bundle_id AS catalog_bundle_id,
    COALESCE(m.product_name, 'Unlinked')::text AS item_name,
    m.variant_name,
    m.resolved_sku AS sku,
    m.cat_id AS category_id,
    m.category_name,
    m.qty_sold,
    m.qty_refunded,
    m.gross_sales,
    m.net_sales,
    m.cogs,
    (m.net_sales - m.cogs)::numeric AS gross_profit,
    CASE
      WHEN m.net_sales > 0 THEN ROUND(((m.net_sales - m.cogs) / m.net_sales) * 100, 2)
      ELSE 0::numeric
    END AS margin_pct,
    m.cogs_incomplete,
    m.cogs_estimated,
    v_summary_product_net AS summary_product_net_sales
  FROM merged m
  ORDER BY m.net_sales DESC, m.qty_sold DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_item_sales_hourly(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  product_key text,
  item_name text,
  variant_name text,
  sku text,
  hour integer,
  qty numeric,
  net_sales numeric
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
  hourly_lines AS (
    SELECT
      CASE
        WHEN sai.catalog_bundle_id IS NOT NULL THEN 'b:' || sai.catalog_bundle_id::text
        WHEN sai.catalog_product_id IS NOT NULL THEN
          'p:' || sai.catalog_product_id::text || ':v:' || COALESCE(sai.catalog_variant_id::text, '')
        ELSE 'n:' || lower(btrim(COALESCE(sai.service_name, 'unlinked')))
      END AS product_key,
      COALESCE(
        NULLIF(cb.name, ''),
        NULLIF(dp.name, ''),
        NULLIF(sai.service_name, ''),
        'Unlinked'
      )::text AS resolved_name,
      CASE WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL ELSE NULLIF(cv.name, '') END::text AS resolved_variant,
      CASE
        WHEN sai.catalog_bundle_id IS NOT NULL THEN NULL
        ELSE COALESCE(
          NULLIF(cv.sku, ''),
          NULLIF(dp.sku, ''),
          NULLIF(isk.internal_sku, '')
        )
      END::text AS resolved_sku,
      EXTRACT(HOUR FROM sa.created_at AT TIME ZONE 'Asia/Jakarta')::integer AS sale_hour,
      COALESCE(sai.quantity, 0)::numeric AS line_qty,
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
      END AS net_line_sales
    FROM public.sales_activities sa
    JOIN public.sales_activity_items sai ON sai.sales_activity_id = sa.id
    JOIN activity_gross ag ON ag.sales_activity_id = sa.id
    LEFT JOIN public.default_prices dp ON dp.id = sai.catalog_product_id
    LEFT JOIN public.catalog_product_variants cv ON cv.id = sai.catalog_variant_id
    LEFT JOIN public.catalog_bundles cb ON cb.id = sai.catalog_bundle_id
    LEFT JOIN public.inventory_skus isk ON isk.id = sai.inventory_sku_id
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
  )
  SELECT
    hl.product_key,
    MAX(hl.resolved_name)::text AS item_name,
    MAX(hl.resolved_variant)::text AS variant_name,
    MAX(hl.resolved_sku)::text AS sku,
    hl.sale_hour AS hour,
    COALESCE(SUM(hl.line_qty), 0)::numeric AS qty,
    COALESCE(SUM(hl.net_line_sales), 0)::numeric AS net_sales
  FROM hourly_lines hl
  GROUP BY hl.product_key, hl.sale_hour
  ORDER BY MAX(hl.resolved_name), hl.sale_hour;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_item_sales_report(uuid, uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_item_sales_report(uuid, uuid, timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_item_sales_report(uuid, uuid, timestamptz, timestamptz, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.pos_item_sales_hourly(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_item_sales_hourly(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_item_sales_hourly(uuid, uuid, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.pos_item_sales_hourly(uuid, uuid, timestamptz, timestamptz) IS
  'Item Sales hourly matrix: qty and net sales per item × hour (0–23 WIB).';
