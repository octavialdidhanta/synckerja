-- Sales Type report Fase B: line-level catalog_sales_type_id on items + line-based aggregation RPC

ALTER TABLE public.sales_activity_items
  ADD COLUMN IF NOT EXISTS catalog_sales_type_id uuid REFERENCES public.catalog_sales_types (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_activity_items_catalog_sales_type
  ON public.sales_activity_items (organization_id, catalog_sales_type_id)
  WHERE catalog_sales_type_id IS NOT NULL;

COMMENT ON COLUMN public.sales_activity_items.catalog_sales_type_id IS
  'Sales type for this line (POS customize or bill header fallback). Used by Sales Type report line-level aggregation.';

-- Backfill from bill header where line type was not persisted
UPDATE public.sales_activity_items sai
SET catalog_sales_type_id = sa.catalog_sales_type_id
FROM public.sales_activities sa
WHERE sai.sales_activity_id = sa.id
  AND sai.catalog_sales_type_id IS NULL
  AND sa.catalog_sales_type_id IS NOT NULL
  AND sa.activity_type = 'Store Checkout';

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
  WITH filtered_activities AS (
    SELECT
      sa.id,
      sa.catalog_sales_type_id,
      sa.checkout_subtotal,
      sa.checkout_discount_amount,
      COALESCE(sa.total_paid_amount, sa.total_amount, 0)::numeric AS collected,
      public.pos_sales_activity_exclusive_net(
        sa.checkout_subtotal,
        sa.checkout_tax_amount,
        sa.checkout_gratuity_amount,
        COALESCE(sa.total_paid_amount, sa.total_amount, 0),
        sa.checkout_application_method
      ) AS bill_net
    FROM public.sales_activities sa
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
  ),
  activity_gross AS (
    SELECT
      sai.sales_activity_id,
      COALESCE(SUM(COALESCE(sai.total_price, 0)), 0)::numeric AS lines_gross
    FROM public.sales_activity_items sai
    JOIN filtered_activities fa ON fa.id = sai.sales_activity_id
    GROUP BY sai.sales_activity_id
  ),
  line_allocations AS (
    SELECT
      fa.id AS activity_id,
      COALESCE(sai.catalog_sales_type_id, fa.catalog_sales_type_id) AS resolved_type_id,
      CASE
        WHEN ag.lines_gross > 0 THEN
          COALESCE(sai.total_price, 0) / ag.lines_gross * fa.bill_net
        ELSE 0::numeric
      END AS net_line,
      CASE
        WHEN ag.lines_gross > 0 THEN
          COALESCE(sai.total_price, 0) / ag.lines_gross * COALESCE(fa.checkout_discount_amount, 0)
        ELSE 0::numeric
      END AS discount_line,
      CASE
        WHEN ag.lines_gross > 0 THEN
          COALESCE(sai.total_price, 0) / ag.lines_gross * fa.collected
        ELSE 0::numeric
      END AS collected_line
    FROM filtered_activities fa
    JOIN public.sales_activity_items sai ON sai.sales_activity_id = fa.id
    JOIN activity_gross ag ON ag.sales_activity_id = fa.id
  ),
  line_grouped AS (
    SELECT
      la.resolved_type_id AS sales_type_id,
      COUNT(DISTINCT la.activity_id)::bigint AS transaction_count,
      COALESCE(SUM(la.net_line + la.discount_line), 0)::numeric AS gross_sales,
      COALESCE(SUM(la.net_line), 0)::numeric AS net_sales,
      COALESCE(SUM(la.collected_line), 0)::numeric AS total_collected
    FROM line_allocations la
    GROUP BY la.resolved_type_id
  ),
  bill_only AS (
    SELECT
      fa.catalog_sales_type_id AS sales_type_id,
      COUNT(*)::bigint AS transaction_count,
      COALESCE(SUM(fa.bill_net + COALESCE(fa.checkout_discount_amount, 0)), 0)::numeric AS gross_sales,
      COALESCE(SUM(fa.bill_net), 0)::numeric AS net_sales,
      COALESCE(SUM(fa.collected), 0)::numeric AS total_collected
    FROM filtered_activities fa
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.sales_activity_items sai
      WHERE sai.sales_activity_id = fa.id
    )
    GROUP BY fa.catalog_sales_type_id
  ),
  combined AS (
    SELECT * FROM line_grouped
    UNION ALL
    SELECT * FROM bill_only
  ),
  grouped AS (
    SELECT
      c.sales_type_id,
      SUM(c.transaction_count)::bigint AS transaction_count,
      COALESCE(SUM(c.gross_sales), 0)::numeric AS gross_sales,
      COALESCE(SUM(c.net_sales), 0)::numeric AS net_sales,
      COALESCE(SUM(c.total_collected), 0)::numeric AS total_collected
    FROM combined c
    GROUP BY c.sales_type_id
  )
  SELECT
    g.sales_type_id,
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
  LEFT JOIN public.catalog_sales_types st ON st.id = g.sales_type_id
  ORDER BY COALESCE(st.sort_order, 9999), COALESCE(st.name, 'Unassigned');
END;
$$;

REVOKE ALL ON FUNCTION public.pos_sales_type_report(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_sales_type_report(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_sales_type_report(uuid, uuid, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.pos_sales_type_report(uuid, uuid, timestamptz, timestamptz) IS
  'Sales Type report: line-level aggregation by catalog_sales_type_id with bill-header fallback for legacy rows.';
