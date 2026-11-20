-- Sales summary reconciliation: legacy backfill, tax-inclusive snapshot, RPC + trigger fixes

ALTER TABLE public.sales_activities
  ADD COLUMN IF NOT EXISTS checkout_application_method text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sales_activities_checkout_application_method_check'
  ) THEN
    ALTER TABLE public.sales_activities
      ADD CONSTRAINT sales_activities_checkout_application_method_check
      CHECK (checkout_application_method IS NULL OR checkout_application_method IN ('add', 'include'));
  END IF;
END $$;

COMMENT ON COLUMN public.sales_activities.checkout_application_method IS
  'Snapshot of catalog checkout application_method at pay time: add=exclusive, include=inclusive.';

CREATE OR REPLACE FUNCTION public.pos_sales_activity_tax_inclusive(
  p_subtotal numeric,
  p_tax numeric,
  p_gratuity numeric,
  p_paid numeric,
  p_method text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_method = 'include' THEN true
    WHEN p_method = 'add' THEN false
    WHEN p_subtotal IS NOT NULL
         AND ABS(COALESCE(p_paid, 0) - COALESCE(p_subtotal, 0)) < 1
         AND (COALESCE(p_tax, 0) + COALESCE(p_gratuity, 0)) > 0 THEN true
    ELSE false
  END;
$$;

-- Legacy store checkouts without breakdown
UPDATE public.sales_activities sa
SET
  checkout_subtotal = COALESCE(sa.total_paid_amount, sa.total_amount, 0),
  checkout_tax_amount = COALESCE(sa.checkout_tax_amount, 0),
  checkout_gratuity_amount = COALESCE(sa.checkout_gratuity_amount, 0),
  checkout_discount_amount = COALESCE(sa.checkout_discount_amount, 0)
WHERE sa.activity_type = 'Store Checkout'
  AND sa.checkout_subtotal IS NULL;

-- Infer application method for existing rows
UPDATE public.sales_activities sa
SET checkout_application_method = CASE
  WHEN public.pos_sales_activity_tax_inclusive(
    sa.checkout_subtotal,
    sa.checkout_tax_amount,
    sa.checkout_gratuity_amount,
    COALESCE(sa.total_paid_amount, sa.total_amount, 0),
    NULL
  ) THEN 'include'
  ELSE 'add'
END
WHERE sa.activity_type = 'Store Checkout'
  AND sa.checkout_application_method IS NULL;

-- Normalize include-mode totals (trigger may have added tax/gratuity on top)
UPDATE public.sales_activities sa
SET
  total_amount = COALESCE(sa.checkout_subtotal, 0),
  total_paid_amount = COALESCE(sa.checkout_subtotal, 0),
  remaining_amount = 0
WHERE sa.activity_type = 'Store Checkout'
  AND sa.checkout_application_method = 'include'
  AND sa.checkout_subtotal IS NOT NULL
  AND ABS(
    COALESCE(sa.total_paid_amount, sa.total_amount, 0) - COALESCE(sa.checkout_subtotal, 0)
  ) < 1;

CREATE OR REPLACE FUNCTION public.update_sales_activity_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_id uuid;
  v_checkout_subtotal numeric;
  v_tax numeric;
  v_gratuity numeric;
  v_paid numeric;
  v_method text;
  v_tax_inclusive boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.sales_activity_id;
  ELSE
    target_id := NEW.sales_activity_id;
  END IF;

  SELECT
    sa.checkout_subtotal,
    sa.checkout_tax_amount,
    sa.checkout_gratuity_amount,
    COALESCE(sa.total_paid_amount, sa.total_amount, 0),
    sa.checkout_application_method
  INTO
    v_checkout_subtotal,
    v_tax,
    v_gratuity,
    v_paid,
    v_method
  FROM public.sales_activities sa
  WHERE sa.id = target_id;

  IF v_checkout_subtotal IS NOT NULL THEN
    v_tax_inclusive := public.pos_sales_activity_tax_inclusive(
      v_checkout_subtotal,
      v_tax,
      v_gratuity,
      v_paid,
      v_method
    );

    UPDATE public.sales_activities sa
    SET
      total_amount = ROUND(
        CASE
          WHEN v_tax_inclusive THEN COALESCE(v_checkout_subtotal, 0)
          ELSE COALESCE(v_checkout_subtotal, 0)
            + COALESCE(v_tax, 0)
            + COALESCE(v_gratuity, 0)
        END,
        2
      ),
      updated_at = NOW()
    WHERE sa.id = target_id;
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.sales_activities sa
  SET
    total_amount = COALESCE((
      SELECT SUM(i.total_price)
      FROM public.sales_activity_items i
      WHERE i.sales_activity_id = sa.id
    ), 0),
    updated_at = NOW()
  WHERE sa.id = target_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP FUNCTION IF EXISTS public.pos_sales_summary_report(uuid, uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.pos_sales_summary_report(
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
  rounding numeric,
  total_collected numeric,
  transaction_count bigint,
  tax_gratuity_included boolean,
  tax_gratuity_included_gratuity numeric,
  tax_gratuity_included_tax numeric
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
  v_total numeric := 0;
  v_count bigint := 0;
  v_refunds numeric := 0;
  v_tax_gratuity_included boolean := false;
  v_included_gratuity numeric := 0;
  v_included_tax numeric := 0;
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

  WITH sales_rows AS (
    SELECT
      sa.*,
      public.pos_sales_activity_tax_inclusive(
        sa.checkout_subtotal,
        sa.checkout_tax_amount,
        sa.checkout_gratuity_amount,
        COALESCE(sa.total_paid_amount, sa.total_amount, 0),
        sa.checkout_application_method
      ) AS is_tax_inclusive
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
    COALESCE(SUM(
      COALESCE(sr.checkout_subtotal, sr.total_paid_amount, sr.total_amount, 0)
    ), 0),
    COALESCE(SUM(COALESCE(sr.checkout_discount_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sr.checkout_gratuity_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sr.checkout_tax_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sr.total_paid_amount, sr.total_amount, 0)), 0),
    COUNT(*)::bigint,
    COALESCE(BOOL_OR(sr.is_tax_inclusive), false),
    COALESCE(SUM(COALESCE(sr.checkout_gratuity_amount, 0)) FILTER (WHERE sr.is_tax_inclusive), 0),
    COALESCE(SUM(COALESCE(sr.checkout_tax_amount, 0)) FILTER (WHERE sr.is_tax_inclusive), 0)
  INTO
    v_net,
    v_discounts,
    v_gratuity,
    v_tax,
    v_total,
    v_count,
    v_tax_gratuity_included,
    v_included_gratuity,
    v_included_tax
  FROM sales_rows sr;

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

  RETURN QUERY
  SELECT
    (v_net + v_discounts)::numeric AS gross_sales,
    v_discounts::numeric AS discounts,
    v_refunds::numeric AS refunds,
    v_net::numeric AS net_sales,
    v_gratuity::numeric AS gratuity,
    v_tax::numeric AS tax,
    0::numeric AS rounding,
    v_total::numeric AS total_collected,
    v_count,
    v_tax_gratuity_included,
    v_included_gratuity,
    v_included_tax;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_sales_summary_report(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_sales_summary_report(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_sales_summary_report(uuid, uuid, timestamptz, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.pos_sales_summary_daily(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  day date,
  net_sales numeric,
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
        COALESCE(sa.checkout_subtotal, sa.total_paid_amount, sa.total_amount, 0)
      ), 0)::numeric AS net_sales,
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
