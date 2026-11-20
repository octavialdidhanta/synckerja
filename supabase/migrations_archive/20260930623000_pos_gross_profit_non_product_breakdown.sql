-- Gross Profit Phase 3: non-product / service line breakdown for expandable items footer

CREATE OR REPLACE FUNCTION public.pos_gross_profit_non_product_breakdown(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  service_id uuid,
  line_name text,
  sub_name text,
  line_kind text,
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
  lines AS (
    SELECT
      sai.service_id,
      COALESCE(NULLIF(TRIM(sai.service_name), ''), 'Custom amount')::text AS line_name,
      NULLIF(TRIM(sai.sub_service_name), '')::text AS sub_name,
      CASE
        WHEN sai.service_id IS NOT NULL THEN 'service'
        ELSE 'custom'
      END::text AS line_kind,
      sai.quantity,
      CASE
        WHEN ag.lines_gross > 0 THEN
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
      END AS net_line_sales
    FROM public.sales_activities sa
    JOIN public.sales_activity_items sai ON sai.sales_activity_id = sa.id
    JOIN activity_gross ag ON ag.sales_activity_id = sa.id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
      AND sai.item_kind <> 'product'
  ),
  grouped AS (
    SELECT
      l.service_id,
      l.line_name,
      l.sub_name,
      l.line_kind,
      COALESCE(SUM(COALESCE(l.quantity, 0)), 0)::numeric AS qty,
      COALESCE(SUM(COALESCE(l.net_line_sales, 0)), 0)::numeric AS net_sales
    FROM lines l
    GROUP BY l.service_id, l.line_name, l.sub_name, l.line_kind
  )
  SELECT
    g.service_id,
    g.line_name,
    g.sub_name,
    g.line_kind,
    g.qty,
    g.net_sales
  FROM grouped g
  WHERE g.net_sales > 0.01
  ORDER BY g.net_sales DESC, g.line_name ASC, g.sub_name ASC NULLS FIRST;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_gross_profit_non_product_breakdown(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_gross_profit_non_product_breakdown(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_gross_profit_non_product_breakdown(uuid, uuid, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.pos_gross_profit_non_product_breakdown(uuid, uuid, timestamptz, timestamptz) IS
  'Non-product/service net sales breakdown grouped by service name for gross profit items footer.';
