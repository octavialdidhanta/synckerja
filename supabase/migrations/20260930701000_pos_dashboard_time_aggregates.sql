-- Operations dashboard: daily gross_sales + DOW/hour gross aggregates (WIB).

-- ---------------------------------------------------------------------------
-- Extend pos_sales_summary_daily with gross_sales
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.pos_sales_summary_daily(uuid, uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.pos_sales_summary_daily(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  day date,
  net_sales numeric,
  gross_sales numeric,
  total_collected numeric,
  refunds numeric
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
      ), 0)::numeric AS net_sales,
      COALESCE(SUM(COALESCE(sa.checkout_discount_amount, 0)), 0)::numeric AS discounts,
      COALESCE(SUM(COALESCE(sa.total_paid_amount, sa.total_amount, 0)), 0)::numeric AS total_collected
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
  refund_rows AS (
    SELECT
      (sa.refunded_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
      COALESCE(SUM(COALESCE(sa.refund_amount, 0)), 0)::numeric AS refunds
    FROM public.sales_activities sa
    CROSS JOIN bounds b
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'full'
      AND sa.refunded_at IS NOT NULL
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND sa.refunded_at >= b.from_ts
      AND sa.refunded_at < b.to_ts
    GROUP BY 1
  )
  SELECT
    ds.day,
    COALESCE(s.net_sales, 0)::numeric AS net_sales,
    (COALESCE(s.net_sales, 0) + COALESCE(s.discounts, 0))::numeric AS gross_sales,
    COALESCE(s.total_collected, 0)::numeric AS total_collected,
    COALESCE(r.refunds, 0)::numeric AS refunds
  FROM day_spine ds
  LEFT JOIN sales s ON s.day = ds.day
  LEFT JOIN refund_rows r ON r.day = ds.day
  ORDER BY ds.day;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_sales_summary_daily(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_sales_summary_daily(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_sales_summary_daily(uuid, uuid, timestamptz, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- Day of week gross (0=Sun … 6=Sat, WIB)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pos_dashboard_gross_by_dow(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  dow smallint,
  gross_sales numeric
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
  WITH spine AS (
    SELECT generate_series(0, 6)::smallint AS dow
  ),
  sales AS (
    SELECT
      EXTRACT(DOW FROM (sa.created_at AT TIME ZONE 'Asia/Jakarta'))::smallint AS dow,
      COALESCE(SUM(
        public.pos_sales_activity_exclusive_net(
          sa.checkout_subtotal,
          sa.checkout_tax_amount,
          sa.checkout_gratuity_amount,
          COALESCE(sa.total_paid_amount, sa.total_amount, 0),
          sa.checkout_application_method
        ) + COALESCE(sa.checkout_discount_amount, 0)
      ), 0)::numeric AS gross_sales
    FROM public.sales_activities sa
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
    GROUP BY 1
  )
  SELECT
    s.dow,
    COALESCE(x.gross_sales, 0)::numeric AS gross_sales
  FROM spine s
  LEFT JOIN sales x ON x.dow = s.dow
  ORDER BY s.dow;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_dashboard_gross_by_dow(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_dashboard_gross_by_dow(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_dashboard_gross_by_dow(uuid, uuid, timestamptz, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- Hourly gross (0–23, WIB)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pos_dashboard_gross_by_hour(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  hour smallint,
  gross_sales numeric
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
  WITH spine AS (
    SELECT generate_series(0, 23)::smallint AS hour
  ),
  sales AS (
    SELECT
      EXTRACT(HOUR FROM (sa.created_at AT TIME ZONE 'Asia/Jakarta'))::smallint AS hour,
      COALESCE(SUM(
        public.pos_sales_activity_exclusive_net(
          sa.checkout_subtotal,
          sa.checkout_tax_amount,
          sa.checkout_gratuity_amount,
          COALESCE(sa.total_paid_amount, sa.total_amount, 0),
          sa.checkout_application_method
        ) + COALESCE(sa.checkout_discount_amount, 0)
      ), 0)::numeric AS gross_sales
    FROM public.sales_activities sa
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
    GROUP BY 1
  )
  SELECT
    s.hour,
    COALESCE(x.gross_sales, 0)::numeric AS gross_sales
  FROM spine s
  LEFT JOIN sales x ON x.hour = s.hour
  ORDER BY s.hour;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_dashboard_gross_by_hour(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_dashboard_gross_by_hour(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_dashboard_gross_by_hour(uuid, uuid, timestamptz, timestamptz) TO service_role;
