-- Served By sales report: persist served_by_user_id + aggregation RPCs per server / sales type

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS served_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_activities_served_by
  ON public.sales_activities (organization_id, served_by_user_id)
  WHERE served_by_user_id IS NOT NULL;

COMMENT ON COLUMN public.sales_activities.served_by_user_id IS
  'Waiter / order taker who served the bill (from pos_table_sessions.waiter_id at pay). Distinct from created_by (Collected By).';

-- Backfill from paid table sessions linked to checkout
UPDATE public.sales_activities sa
SET served_by_user_id = pts.waiter_id
FROM public.pos_table_sessions pts
WHERE pts.sales_activity_id = sa.id
  AND pts.waiter_id IS NOT NULL
  AND sa.served_by_user_id IS NULL;

DROP FUNCTION IF EXISTS public.pos_served_by_sales_report(uuid, uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.pos_served_by_sales_by_sales_type(uuid, uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.pos_served_by_sales_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  server_user_id uuid,
  server_name text,
  employee_id uuid,
  transaction_count bigint,
  gross_sales numeric,
  net_sales numeric,
  summary_gross_sales numeric,
  summary_net_sales numeric,
  summary_transaction_count bigint
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
  WITH sales AS (
    SELECT
      sa.served_by_user_id,
      public.pos_sales_activity_exclusive_net(
        sa.checkout_subtotal,
        sa.checkout_tax_amount,
        sa.checkout_gratuity_amount,
        COALESCE(sa.total_paid_amount, sa.total_amount, 0),
        sa.checkout_application_method
      ) AS bill_net,
      COALESCE(sa.checkout_discount_amount, 0)::numeric AS discount_amount
    FROM public.sales_activities sa
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
  ),
  summary AS (
    SELECT
      COALESCE(SUM(s.bill_net + s.discount_amount), 0)::numeric AS summary_gross_sales,
      COALESCE(SUM(s.bill_net), 0)::numeric AS summary_net_sales,
      COUNT(*)::bigint AS summary_transaction_count
    FROM sales s
  ),
  enriched AS (
    SELECT
      s.served_by_user_id AS server_user_id,
      COALESCE(
        NULLIF(btrim(e.full_name), ''),
        NULLIF(btrim(p.full_name), ''),
        NULLIF(split_part(au.email, '@', 1), ''),
        'Unknown Server'
      ) AS server_name,
      e.id AS employee_id,
      s.bill_net,
      s.discount_amount
    FROM sales s
    LEFT JOIN public.employees e
      ON e.user_id = s.served_by_user_id
     AND e.organization_id = p_organization_id
    LEFT JOIN public.profiles p ON p.user_id = s.served_by_user_id
    LEFT JOIN auth.users au ON au.id = s.served_by_user_id
  ),
  grouped AS (
    SELECT
      en.server_user_id,
      CASE
        WHEN en.server_user_id IS NULL THEN 'Unknown Server'
        ELSE en.server_name
      END AS server_name,
      MAX(en.employee_id::text)::uuid AS employee_id,
      COUNT(*)::bigint AS transaction_count,
      COALESCE(SUM(en.bill_net + en.discount_amount), 0)::numeric AS gross_sales,
      COALESCE(SUM(en.bill_net), 0)::numeric AS net_sales
    FROM enriched en
    GROUP BY en.server_user_id, CASE
      WHEN en.server_user_id IS NULL THEN 'Unknown Server'
      ELSE en.server_name
    END
  )
  SELECT
    g.server_user_id,
    g.server_name,
    g.employee_id,
    g.transaction_count,
    g.gross_sales,
    g.net_sales,
    sm.summary_gross_sales,
    sm.summary_net_sales,
    sm.summary_transaction_count
  FROM grouped g
  CROSS JOIN summary sm
  ORDER BY g.net_sales DESC, g.server_name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_served_by_sales_by_sales_type(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  server_user_id uuid,
  catalog_sales_type_id uuid,
  sales_type_name text,
  transaction_count bigint,
  gross_sales numeric,
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
  WITH sales AS (
    SELECT
      sa.served_by_user_id,
      sa.catalog_sales_type_id,
      public.pos_sales_activity_exclusive_net(
        sa.checkout_subtotal,
        sa.checkout_tax_amount,
        sa.checkout_gratuity_amount,
        COALESCE(sa.total_paid_amount, sa.total_amount, 0),
        sa.checkout_application_method
      ) AS bill_net,
      COALESCE(sa.checkout_discount_amount, 0)::numeric AS discount_amount
    FROM public.sales_activities sa
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
  )
  SELECT
    s.served_by_user_id AS server_user_id,
    s.catalog_sales_type_id,
    COALESCE(NULLIF(btrim(cst.name), ''), 'Unknown') AS sales_type_name,
    COUNT(*)::bigint AS transaction_count,
    COALESCE(SUM(s.bill_net + s.discount_amount), 0)::numeric AS gross_sales,
    COALESCE(SUM(s.bill_net), 0)::numeric AS net_sales
  FROM sales s
  LEFT JOIN public.catalog_sales_types cst ON cst.id = s.catalog_sales_type_id
  GROUP BY s.served_by_user_id, s.catalog_sales_type_id, COALESCE(NULLIF(btrim(cst.name), ''), 'Unknown')
  ORDER BY s.served_by_user_id NULLS FIRST, sales_type_name ASC;
END;
$$;

COMMENT ON FUNCTION public.pos_served_by_sales_report IS
  'Served By report: txn count, gross and net sales per waiter (served_by_user_id).';

COMMENT ON FUNCTION public.pos_served_by_sales_by_sales_type IS
  'Served By report breakdown: sales type per server.';

GRANT EXECUTE ON FUNCTION public.pos_served_by_sales_report(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_served_by_sales_by_sales_type(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
