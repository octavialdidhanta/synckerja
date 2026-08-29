-- Collected By sales report: aggregate Store Checkout collections per payment processor (created_by)

DROP FUNCTION IF EXISTS public.pos_collected_by_sales_report(uuid, uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.pos_collected_by_sales_by_payment(uuid, uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.pos_collected_by_sales_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  collector_user_id uuid,
  collector_name text,
  employee_id uuid,
  transaction_count bigint,
  total_collected numeric,
  summary_total_collected numeric,
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
      sa.id,
      sa.created_by,
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
  summary AS (
    SELECT
      COALESCE(SUM(s.collected), 0)::numeric AS summary_total_collected,
      COUNT(*)::bigint AS summary_transaction_count
    FROM sales s
  ),
  enriched AS (
    SELECT
      s.created_by AS collector_user_id,
      COALESCE(
        NULLIF(btrim(e.full_name), ''),
        NULLIF(btrim(p.full_name), ''),
        NULLIF(split_part(au.email, '@', 1), ''),
        'Unknown Staff'
      ) AS collector_name,
      e.id AS employee_id,
      s.collected
    FROM sales s
    LEFT JOIN public.employees e
      ON e.user_id = s.created_by
     AND e.organization_id = p_organization_id
    LEFT JOIN public.profiles p ON p.user_id = s.created_by
    LEFT JOIN auth.users au ON au.id = s.created_by
  ),
  grouped AS (
    SELECT
      en.collector_user_id,
      en.collector_name,
      MAX(en.employee_id::text)::uuid AS employee_id,
      COUNT(*)::bigint AS transaction_count,
      COALESCE(SUM(en.collected), 0)::numeric AS total_collected
    FROM enriched en
    GROUP BY en.collector_user_id, en.collector_name
  )
  SELECT
    g.collector_user_id,
    g.collector_name,
    g.employee_id,
    g.transaction_count,
    g.total_collected,
    sm.summary_total_collected,
    sm.summary_transaction_count
  FROM grouped g
  CROSS JOIN summary sm
  ORDER BY g.total_collected DESC, g.collector_name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_collected_by_sales_by_payment(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  collector_user_id uuid,
  payment_kind text,
  transaction_count bigint,
  total_collected numeric
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
      sa.id,
      sa.created_by,
      sa.payment_method,
      sa.payment_reference,
      sa.payment_channel_id,
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
  resolved AS (
    SELECT
      s.created_by AS collector_user_id,
      CASE
        WHEN COALESCE(
          ch.category,
          CASE lower(COALESCE(s.payment_method, ''))
            WHEN 'cash' THEN 'cash'
            ELSE 'other'
          END
        ) = 'cash' THEN 'cash'
        ELSE 'non_cash'
      END AS payment_kind,
      s.collected
    FROM sales s
    LEFT JOIN public.pos_payment_method_channels ch ON ch.id = s.payment_channel_id
  )
  SELECT
    r.collector_user_id,
    r.payment_kind,
    COUNT(*)::bigint AS transaction_count,
    COALESCE(SUM(r.collected), 0)::numeric AS total_collected
  FROM resolved r
  GROUP BY r.collector_user_id, r.payment_kind
  ORDER BY r.collector_user_id NULLS FIRST, r.payment_kind ASC;
END;
$$;

COMMENT ON FUNCTION public.pos_collected_by_sales_report IS
  'Collected By report: txn count and total collected per checkout processor (created_by).';

COMMENT ON FUNCTION public.pos_collected_by_sales_by_payment IS
  'Collected By report breakdown: cash vs non-cash per checkout processor.';

GRANT EXECUTE ON FUNCTION public.pos_collected_by_sales_report(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_collected_by_sales_by_payment(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
