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

CREATE OR REPLACE FUNCTION public.pos_gross_profit_daily(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  day date,
  net_sales numeric,
  cogs numeric,
  gross_profit numeric
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
  WITH bounds AS (
    SELECT
      COALESCE(p_from, timestamptz '1970-01-01') AS from_ts,
      COALESCE(p_to, timestamptz '2100-01-01') AS to_ts
  ),
  day_spine AS (
    SELECT d::date AS day
    FROM bounds b,
    LATERAL generate_series(
      (b.from_ts AT TIME ZONE 'Asia/Jakarta')::date,
      ((b.to_ts - interval '1 second') AT TIME ZONE 'Asia/Jakarta')::date,
      interval '1 day'
    ) AS d
  ),
  sales AS (
    SELECT
      (sa.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
      COALESCE(SUM(
        public.pos_sales_activity_exclusive_net(
          sa.checkout_subtotal,
          sa.checkout_tax_amount,
          sa.checkout_gratuity_amount,
          COALESCE(sa.total_paid_amount, sa.total_amount, 0),
          sa.checkout_application_method
        )
      ), 0)::numeric AS net_sales
    FROM public.sales_activities sa
    CROSS JOIN bounds b
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND sa.created_at >= b.from_ts
      AND sa.created_at < b.to_ts
    GROUP BY 1
  ),
  cogs_by_day AS (
    SELECT
      (sa.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
      COALESCE(SUM(
        COALESCE(
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
          END,
          0
        ) * COALESCE(sai.quantity, 0)
      ), 0)::numeric AS cogs
    FROM public.sales_activities sa
    JOIN public.sales_activity_items sai ON sai.sales_activity_id = sa.id
    CROSS JOIN bounds b
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND sa.created_at >= b.from_ts
      AND sa.created_at < b.to_ts
      AND sai.item_kind = 'product'
    GROUP BY 1
  )
  SELECT
    ds.day,
    COALESCE(s.net_sales, 0)::numeric AS net_sales,
    COALESCE(c.cogs, 0)::numeric AS cogs,
    (COALESCE(s.net_sales, 0) - COALESCE(c.cogs, 0))::numeric AS gross_profit
  FROM day_spine ds
  LEFT JOIN sales s ON s.day = ds.day
  LEFT JOIN cogs_by_day c ON c.day = ds.day
  ORDER BY ds.day;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_gross_profit_daily(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_gross_profit_daily(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_gross_profit_daily(uuid, uuid, timestamptz, timestamptz) TO service_role;

