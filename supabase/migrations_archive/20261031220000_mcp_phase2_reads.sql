-- Phase 2 MCP reads. Membership is checked here; EXECUTE is service_role only.
-- Tokens, receipts, bank accounts, phones, and payroll columns are not selected.

CREATE OR REPLACE FUNCTION public.mcp_list_ads_accounts(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  platform text,
  label text,
  account_id text,
  is_active boolean,
  last_test_ok boolean,
  connected_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
  SELECT q.platform, q.label, q.account_id, q.is_active, q.last_test_ok, q.connected_at
  FROM (
    SELECT
      'google'::text AS platform,
      a.label,
      a.customer_id AS account_id,
      a.is_active,
      c.last_test_ok,
      c.oauth_connected_at AS connected_at
    FROM public.organization_google_ads_accounts a
    LEFT JOIN public.organization_google_ads_connections c
      ON c.organization_id = a.organization_id
    WHERE a.organization_id = p_organization_id
    UNION ALL
    SELECT
      'google'::text,
      NULL::text,
      NULL::text,
      c.is_active,
      c.last_test_ok,
      c.oauth_connected_at
    FROM public.organization_google_ads_connections c
    WHERE c.organization_id = p_organization_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_google_ads_accounts a
        WHERE a.organization_id = c.organization_id
      )
    UNION ALL
    SELECT
      'meta'::text,
      a.label,
      a.ad_account_id,
      a.is_active,
      c.last_test_ok,
      c.oauth_connected_at
    FROM public.organization_meta_ads_accounts a
    LEFT JOIN public.organization_meta_ads_connections c
      ON c.organization_id = a.organization_id
    WHERE a.organization_id = p_organization_id
    UNION ALL
    SELECT
      'meta'::text,
      NULL::text,
      NULL::text,
      c.is_active,
      c.last_test_ok,
      c.oauth_connected_at
    FROM public.organization_meta_ads_connections c
    WHERE c.organization_id = p_organization_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_meta_ads_accounts a
        WHERE a.organization_id = c.organization_id
      )
    UNION ALL
    SELECT
      'tiktok'::text,
      a.label,
      a.advertiser_id,
      a.is_active,
      c.last_test_ok,
      c.oauth_connected_at
    FROM public.organization_tiktok_ads_accounts a
    LEFT JOIN public.organization_tiktok_ads_connections c
      ON c.organization_id = a.organization_id
    WHERE a.organization_id = p_organization_id
    UNION ALL
    SELECT
      'tiktok'::text,
      NULL::text,
      NULL::text,
      c.is_active,
      c.last_test_ok,
      c.oauth_connected_at
    FROM public.organization_tiktok_ads_connections c
    WHERE c.organization_id = p_organization_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_tiktok_ads_accounts a
        WHERE a.organization_id = c.organization_id
      )
  ) q
  ORDER BY q.platform ASC, q.label ASC NULLS LAST, q.account_id ASC NULLS LAST
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_income_transactions(
  p_user_id uuid,
  p_organization_id uuid,
  p_month text
)
RETURNS TABLE (
  id uuid,
  transaction_date date,
  amount double precision,
  customer_name text,
  payment_method text,
  status text
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
    t.id,
    t.transaction_date,
    t.amount::double precision,
    t.customer_name,
    t.payment_method,
    t.status
  FROM public.income_transactions t
  WHERE t.organization_id = p_organization_id
    AND to_char(t.transaction_date, 'YYYY-MM') = v_month
  ORDER BY t.transaction_date DESC, t.id ASC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_expenses(
  p_user_id uuid,
  p_organization_id uuid,
  p_month text
)
RETURNS TABLE (
  id uuid,
  expense_name text,
  amount double precision,
  expense_type text,
  category text,
  create_date date,
  status text
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
    e.id,
    e.expense_name,
    e.amount::double precision,
    e.expense_type,
    e.category,
    e.create_date,
    e.status
  FROM public.expenses e
  WHERE e.organization_id = p_organization_id
    AND to_char(e.create_date, 'YYYY-MM') = v_month
  ORDER BY e.create_date DESC, e.id ASC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_employees(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  full_name text,
  status text,
  department_name text,
  job_level_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
  SELECT
    e.id,
    e.full_name,
    es.name,
    dep.name,
    jl.name
  FROM public.employees e
  LEFT JOIN public.employee_statuses es ON es.id = e.employee_status_id
  LEFT JOIN public.departments dep ON dep.id = e.department_id
  LEFT JOIN public.job_levels jl ON jl.id = e.job_level_id
  WHERE e.organization_id = p_organization_id
  ORDER BY
    CASE WHEN lower(COALESCE(es.name, '')) IN ('terminated', 'inactive') THEN 1 ELSE 0 END,
    e.full_name ASC,
    e.id ASC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_customer_visits(
  p_user_id uuid,
  p_organization_id uuid,
  p_month text
)
RETURNS TABLE (
  id uuid,
  visit_date date,
  status text,
  match_status text,
  lookup_kind text,
  client_name text
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
    v.id,
    v.visit_date,
    v.status,
    v.match_status,
    v.lookup_kind,
    l.client
  FROM public.customer_visits v
  LEFT JOIN public.leads l
    ON l.id = v.lead_id
   AND l.organization_id = v.organization_id
  WHERE v.organization_id = p_organization_id
    AND to_char(v.visit_date, 'YYYY-MM') = v_month
  ORDER BY v.visit_date DESC, v.id ASC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_kol_campaigns(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  status text,
  start_date date,
  end_date date,
  budget double precision,
  total_budget double precision,
  allocated_budget double precision,
  remaining_budget double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.status,
    c.start_date,
    c.end_date,
    c.budget::double precision,
    c.total_budget::double precision,
    c.allocated_budget::double precision,
    c.remaining_budget::double precision
  FROM public.kol_campaigns c
  WHERE c.organization_id = p_organization_id
  ORDER BY c.updated_at DESC, c.id ASC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_kol_profiles(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  status text,
  category text,
  followers_count bigint,
  engagement_rate double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
  SELECT
    k.id,
    k.name,
    k.status,
    k.category,
    k.followers_count,
    k.engagement_rate::double precision
  FROM public.kol_profiles k
  WHERE k.organization_id = p_organization_id
  ORDER BY k.updated_at DESC, k.id ASC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_list_inventory_stock(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  product_name text,
  sku_name text,
  internal_sku text,
  available_qty integer,
  reserved_qty integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
  SELECT
    lvl.id,
    prod.name,
    sku.name,
    sku.internal_sku,
    lvl.available_qty,
    lvl.reserved_qty
  FROM public.inventory_stock_levels lvl
  JOIN public.inventory_skus sku
    ON sku.id = lvl.sku_id
   AND sku.organization_id = lvl.organization_id
  JOIN public.inventory_products prod
    ON prod.id = sku.product_id
   AND prod.organization_id = lvl.organization_id
  WHERE lvl.organization_id = p_organization_id
  ORDER BY lvl.available_qty ASC, sku.internal_sku ASC, lvl.id ASC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_list_ads_accounts(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_ads_accounts(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_ads_accounts(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_income_transactions(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_income_transactions(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_income_transactions(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_expenses(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_expenses(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_expenses(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_employees(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_employees(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_employees(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_customer_visits(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_customer_visits(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_customer_visits(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_kol_campaigns(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_kol_campaigns(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_kol_campaigns(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_kol_profiles(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_kol_profiles(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_kol_profiles(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_list_inventory_stock(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_list_inventory_stock(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_list_inventory_stock(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
