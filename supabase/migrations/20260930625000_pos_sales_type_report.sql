-- Sales Type report: aggregate Store Checkout by catalog_sales_type_id (bill-level)

CREATE INDEX IF NOT EXISTS idx_sales_activities_catalog_sales_type
  ON public.sales_activities (organization_id, catalog_sales_type_id, created_at)
  WHERE activity_type = 'Store Checkout';

CREATE OR REPLACE FUNCTION public.pos_sales_type_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  sales_type_id uuid,
  sales_type_name text,
  sort_order integer,
  transaction_count bigint,
  gross_sales numeric,
  net_sales numeric,
  total_collected numeric,
  summary_gross_sales numeric,
  summary_net_sales numeric,
  summary_transaction_count bigint,
  summary_total_collected numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary_gross numeric := 0;
  v_summary_net numeric := 0;
  v_summary_count bigint := 0;
  v_summary_collected numeric := 0;
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
      + COALESCE(sa.checkout_discount_amount, 0)
    ), 0),
    COALESCE(SUM(
      public.pos_sales_activity_exclusive_net(
        sa.checkout_subtotal,
        sa.checkout_tax_amount,
        sa.checkout_gratuity_amount,
        COALESCE(sa.total_paid_amount, sa.total_amount, 0),
        sa.checkout_application_method
      )
    ), 0),
    COUNT(*)::bigint,
    COALESCE(SUM(COALESCE(sa.total_paid_amount, sa.total_amount, 0)), 0)
  INTO v_summary_gross, v_summary_net, v_summary_count, v_summary_collected
  FROM public.sales_activities sa
  WHERE sa.organization_id = p_organization_id
    AND sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
    AND (p_from IS NULL OR sa.created_at >= p_from)
    AND (p_to IS NULL OR sa.created_at < p_to);

  RETURN QUERY
  WITH sales AS (
    SELECT
      sa.catalog_sales_type_id,
      public.pos_sales_activity_exclusive_net(
        sa.checkout_subtotal,
        sa.checkout_tax_amount,
        sa.checkout_gratuity_amount,
        COALESCE(sa.total_paid_amount, sa.total_amount, 0),
        sa.checkout_application_method
      ) AS net_amount,
      COALESCE(sa.checkout_discount_amount, 0)::numeric AS discount_amount,
      COALESCE(sa.total_paid_amount, sa.total_amount, 0)::numeric AS collected
    FROM public.sales_activities sa
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
  ),
  grouped AS (
    SELECT
      s.catalog_sales_type_id,
      COUNT(*)::bigint AS transaction_count,
      COALESCE(SUM(s.net_amount + s.discount_amount), 0)::numeric AS gross_sales,
      COALESCE(SUM(s.net_amount), 0)::numeric AS net_sales,
      COALESCE(SUM(s.collected), 0)::numeric AS total_collected
    FROM sales s
    GROUP BY s.catalog_sales_type_id
  )
  SELECT
    g.catalog_sales_type_id AS sales_type_id,
    COALESCE(st.name, 'Unassigned')::text AS sales_type_name,
    COALESCE(st.sort_order, 9999)::integer AS sort_order,
    g.transaction_count,
    g.gross_sales,
    g.net_sales,
    g.total_collected,
    v_summary_gross AS summary_gross_sales,
    v_summary_net AS summary_net_sales,
    v_summary_count AS summary_transaction_count,
    v_summary_collected AS summary_total_collected
  FROM grouped g
  LEFT JOIN public.catalog_sales_types st ON st.id = g.catalog_sales_type_id
  ORDER BY COALESCE(st.sort_order, 9999), COALESCE(st.name, 'Unassigned');
END;
$$;

REVOKE ALL ON FUNCTION public.pos_sales_type_report(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_sales_type_report(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_sales_type_report(uuid, uuid, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.pos_sales_type_report(uuid, uuid, timestamptz, timestamptz) IS
  'Sales Type report: txn count, gross/net sales, and total collected by bill-level catalog_sales_type_id.';
