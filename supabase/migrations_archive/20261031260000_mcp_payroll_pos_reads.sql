-- Payroll run summaries and daily POS sales. Membership is checked here; EXECUTE is service_role only.

CREATE OR REPLACE FUNCTION public.mcp_list_payroll_runs(
  p_user_id uuid,
  p_organization_id uuid,
  p_month text
)
RETURNS TABLE (
  id uuid,
  run_name text,
  period_name text,
  start_date date,
  end_date date,
  status text,
  total_employees integer,
  total_net_pay double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  v_month := NULLIF(btrim(COALESCE(p_month, '')), '');
  IF v_month IS NOT NULL AND v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'invalid_month' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    run.id,
    run.run_name,
    period.period_name,
    period.start_date,
    period.end_date,
    run.status,
    run.total_employees,
    run.total_net_pay::double precision
  FROM public.payroll_runs run
  JOIN public.payroll_periods period
    ON period.id = run.payroll_period_id
   AND period.organization_id = run.organization_id
  WHERE run.organization_id = p_organization_id
    AND (v_month IS NULL OR to_char(period.start_date, 'YYYY-MM') = v_month)
  ORDER BY period.start_date DESC, run.run_date DESC, run.id ASC
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_pos_daily_sales(
  p_user_id uuid,
  p_organization_id uuid,
  p_month text
)
RETURNS TABLE (
  sale_date date,
  transaction_count bigint,
  total_sales double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  v_month := NULLIF(btrim(COALESCE(p_month, '')), '');
  IF v_month IS NULL THEN
    v_month := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM');
  END IF;
  IF v_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'invalid_month' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    (sa.created_at AT TIME ZONE 'Asia/Jakarta')::date,
    COUNT(*)::bigint,
    COALESCE(SUM(COALESCE(sa.total_paid_amount, sa.total_amount, 0)), 0)::double precision
  FROM public.sales_activities sa
  WHERE sa.organization_id = p_organization_id
    AND sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND to_char(sa.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') = v_month
  GROUP BY (sa.created_at AT TIME ZONE 'Asia/Jakarta')::date
  ORDER BY 1 ASC
  LIMIT 31;
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_list_payroll_runs(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_payroll_runs(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_payroll_runs(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_pos_daily_sales(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_pos_daily_sales(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_pos_daily_sales(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
