-- Gross Profit report: product vs non-product net sales breakdown (Moka-style reconciliation)

DROP FUNCTION IF EXISTS public.pos_gross_profit_report(uuid, uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.pos_gross_profit_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  gross_sales numeric,
  discounts numeric,
  refunds numeric,
  net_sales numeric,
  product_net_sales numeric,
  non_product_net numeric,
  gratuity numeric,
  tax numeric,
  cogs numeric,
  gross_profit numeric,
  gross_profit_margin numeric,
  cogs_incomplete boolean,
  transaction_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net numeric := 0;
  v_product_net numeric := 0;
  v_discounts numeric := 0;
  v_gratuity numeric := 0;
  v_tax numeric := 0;
  v_count bigint := 0;
  v_refunds numeric := 0;
  v_cogs numeric := 0;
  v_incomplete boolean := false;
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

  SELECT
    COALESCE(SUM(
      public.pos_sales_activity_exclusive_net(
        sa.checkout_subtotal,
        sa.checkout_tax_amount,
        sa.checkout_gratuity_amount,
        COALESCE(sa.total_paid_amount, sa.total_amount, 0),
        sa.checkout_application_method
      )
    ), 0),
    COALESCE(SUM(COALESCE(sa.checkout_discount_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sa.checkout_gratuity_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sa.checkout_tax_amount, 0)), 0),
    COUNT(*)::bigint
  INTO v_net, v_discounts, v_gratuity, v_tax, v_count
  FROM public.sales_activities sa
  WHERE sa.organization_id = p_organization_id
    AND sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
    AND (p_from IS NULL OR sa.created_at >= p_from)
    AND (p_to IS NULL OR sa.created_at < p_to);

  WITH activity_gross AS (
    SELECT
      sai.sales_activity_id,
      COALESCE(SUM(COALESCE(sai.total_price, 0)), 0)::numeric AS lines_gross,
      COALESCE(SUM(COALESCE(sai.total_price, 0)) FILTER (WHERE sai.item_kind = 'product'), 0)::numeric AS product_gross
    FROM public.sales_activity_items sai
    GROUP BY sai.sales_activity_id
  ),
  product_contrib AS (
    SELECT
      CASE
        WHEN ag.lines_gross > 0 THEN
          ag.product_gross * (
            public.pos_sales_activity_exclusive_net(
              sa.checkout_subtotal,
              sa.checkout_tax_amount,
              sa.checkout_gratuity_amount,
              COALESCE(sa.total_paid_amount, sa.total_amount, 0),
              sa.checkout_application_method
            ) / ag.lines_gross
          )
        ELSE 0::numeric
      END AS product_net_contrib
    FROM public.sales_activities sa
    JOIN activity_gross ag ON ag.sales_activity_id = sa.id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
  )
  SELECT COALESCE(SUM(product_net_contrib), 0)
  INTO v_product_net
  FROM product_contrib;

  SELECT COALESCE(SUM(COALESCE(sa.refund_amount, 0)), 0)
  INTO v_refunds
  FROM public.sales_activities sa
  WHERE sa.organization_id = p_organization_id
    AND sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'full'
    AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
    AND sa.refunded_at IS NOT NULL
    AND (p_from IS NULL OR sa.refunded_at >= p_from)
    AND (p_to IS NULL OR sa.refunded_at < p_to);

  WITH sold AS (
    SELECT
      sa.pos_outlet_id AS outlet_id,
      sai.quantity,
      sai.catalog_product_id,
      sai.catalog_variant_id,
      sai.unit_cogs
    FROM public.sales_activities sa
    JOIN public.sales_activity_items sai ON sai.sales_activity_id = sa.id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
      AND sai.item_kind = 'product'
  ),
  priced AS (
    SELECT
      s.quantity,
      CASE
        WHEN s.unit_cogs IS NOT NULL THEN s.unit_cogs
        WHEN s.catalog_product_id IS NOT NULL AND s.outlet_id IS NOT NULL THEN
          public.pos_estimate_line_unit_cogs(
            p_organization_id,
            s.outlet_id,
            s.catalog_product_id,
            s.catalog_variant_id
          )
        ELSE NULL
      END AS resolved_unit_cogs
    FROM sold s
  )
  SELECT
    COALESCE(SUM(COALESCE(p.resolved_unit_cogs, 0) * COALESCE(p.quantity, 0)), 0),
    COALESCE(BOOL_OR(p.resolved_unit_cogs IS NULL), false)
  INTO v_cogs, v_incomplete
  FROM priced p;

  RETURN QUERY
  SELECT
    (v_net + v_discounts)::numeric AS gross_sales,
    v_discounts::numeric AS discounts,
    v_refunds::numeric AS refunds,
    v_net::numeric AS net_sales,
    v_product_net::numeric AS product_net_sales,
    GREATEST(0, v_net - v_product_net)::numeric AS non_product_net,
    v_gratuity::numeric AS gratuity,
    v_tax::numeric AS tax,
    v_cogs::numeric AS cogs,
    (v_net - v_cogs)::numeric AS gross_profit,
    CASE
      WHEN v_net > 0 THEN ROUND(((v_net - v_cogs) / v_net) * 100, 2)
      ELSE 0::numeric
    END AS gross_profit_margin,
    COALESCE(v_incomplete, false) AS cogs_incomplete,
    v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_gross_profit_report(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_gross_profit_report(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_gross_profit_report(uuid, uuid, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.pos_gross_profit_report(uuid, uuid, timestamptz, timestamptz) IS
  'Gross profit summary with product vs non-product net breakdown for Moka-style reconciliation.';
