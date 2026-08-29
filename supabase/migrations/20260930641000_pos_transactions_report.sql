-- Transactions report: success orders, cancelled bills, void items (audit per receipt)

DROP FUNCTION IF EXISTS public.pos_transactions_success_orders(uuid, uuid, timestamptz, timestamptz, text, timestamptz, integer);
DROP FUNCTION IF EXISTS public.pos_transactions_cancelled_orders(uuid, uuid, timestamptz, timestamptz, timestamptz, integer);
DROP FUNCTION IF EXISTS public.pos_transactions_void_items(uuid, uuid, timestamptz, timestamptz, timestamptz, integer);

CREATE OR REPLACE FUNCTION public.pos_transactions_success_orders(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_receipt_query text DEFAULT NULL,
  p_cursor timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  activity_id uuid,
  created_at timestamptz,
  outlet_id uuid,
  outlet_name text,
  receipt_code text,
  collected_by_user_id uuid,
  collected_by_name text,
  served_by_user_id uuid,
  served_by_name text,
  item_summary text,
  total_collected numeric,
  net_sales numeric,
  gross_sales numeric,
  summary_txn_count bigint,
  summary_total_collected numeric,
  summary_net_sales numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt_prefix text;
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
BEGIN
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
      RAISE EXCEPTION 'not_authenticated';
    END IF;
  ELSIF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  v_receipt_prefix := upper(replace(replace(COALESCE(btrim(p_receipt_query), ''), 'SC-', ''), '-', ''));

  RETURN QUERY
  WITH filtered AS (
    SELECT
      sa.id,
      sa.created_at,
      sa.pos_outlet_id,
      sa.created_by,
      sa.served_by_user_id,
      COALESCE(sa.total_paid_amount, sa.total_amount, 0)::numeric AS collected,
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
      AND (
        v_receipt_prefix = ''
        OR upper(replace(sa.id::text, '-', '')) LIKE v_receipt_prefix || '%'
      )
  ),
  summary AS (
    SELECT
      COUNT(*)::bigint AS summary_txn_count,
      COALESCE(SUM(f.collected), 0)::numeric AS summary_total_collected,
      COALESCE(SUM(f.bill_net), 0)::numeric AS summary_net_sales
    FROM filtered f
  ),
  page AS (
    SELECT f.*
    FROM filtered f
    WHERE p_cursor IS NULL OR f.created_at < p_cursor
    ORDER BY f.created_at DESC
    LIMIT v_limit
  )
  SELECT
    p.id AS activity_id,
    p.created_at,
    p.pos_outlet_id AS outlet_id,
    COALESCE(NULLIF(btrim(po.name), ''), '—') AS outlet_name,
    ('SC-' || upper(substr(replace(p.id::text, '-', ''), 1, 8))) AS receipt_code,
    p.created_by AS collected_by_user_id,
    COALESCE(
      NULLIF(btrim(ec.full_name), ''),
      NULLIF(btrim(pc.full_name), ''),
      NULLIF(split_part(auc.email, '@', 1), ''),
      'Unknown Staff'
    ) AS collected_by_name,
    p.served_by_user_id,
    CASE
      WHEN p.served_by_user_id IS NULL THEN NULL
      ELSE COALESCE(
        NULLIF(btrim(es.full_name), ''),
        NULLIF(btrim(ps.full_name), ''),
        NULLIF(split_part(aus.email, '@', 1), ''),
        'Unknown Server'
      )
    END AS served_by_name,
    COALESCE(items.item_summary, '') AS item_summary,
    p.collected AS total_collected,
    p.bill_net AS net_sales,
    (p.bill_net + p.discount_amount) AS gross_sales,
    sm.summary_txn_count,
    sm.summary_total_collected,
    sm.summary_net_sales
  FROM page p
  CROSS JOIN summary sm
  LEFT JOIN public.pos_outlets po ON po.id = p.pos_outlet_id
  LEFT JOIN public.employees ec ON ec.user_id = p.created_by AND ec.organization_id = p_organization_id
  LEFT JOIN public.profiles pc ON pc.user_id = p.created_by
  LEFT JOIN auth.users auc ON auc.id = p.created_by
  LEFT JOIN public.employees es ON es.user_id = p.served_by_user_id AND es.organization_id = p_organization_id
  LEFT JOIN public.profiles ps ON ps.user_id = p.served_by_user_id
  LEFT JOIN auth.users aus ON aus.id = p.served_by_user_id
  LEFT JOIN LATERAL (
    SELECT string_agg(sub.n, ', ' ORDER BY sub.ord) AS item_summary
    FROM (
      SELECT
        COALESCE(NULLIF(btrim(sai.service_name), ''), 'Item') AS n,
        row_number() OVER (ORDER BY sai.created_at) AS ord
      FROM public.sales_activity_items sai
      WHERE sai.sales_activity_id = p.id
      ORDER BY sai.created_at
      LIMIT 3
    ) sub
  ) items ON true
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_transactions_cancelled_orders(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_cursor timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  session_id uuid,
  closed_at timestamptz,
  outlet_id uuid,
  outlet_name text,
  table_name text,
  staff_user_id uuid,
  staff_name text,
  cancel_reason text,
  item_summary text,
  cart_snapshot jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
BEGIN
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
      RAISE EXCEPTION 'not_authenticated';
    END IF;
  ELSIF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      pts.id,
      pts.closed_at,
      pts.outlet_id,
      pts.table_name,
      COALESCE(pts.waiter_id, pts.opened_by) AS staff_user_id,
      pts.cancel_reason,
      pts.cart_snapshot
    FROM public.pos_table_sessions pts
    WHERE pts.organization_id = p_organization_id
      AND pts.status = 'cancelled'
      AND pts.closed_at IS NOT NULL
      AND (p_outlet_id IS NULL OR pts.outlet_id = p_outlet_id)
      AND (p_from IS NULL OR pts.closed_at >= p_from)
      AND (p_to IS NULL OR pts.closed_at < p_to)
  ),
  page AS (
    SELECT f.*
    FROM filtered f
    WHERE p_cursor IS NULL OR f.closed_at < p_cursor
    ORDER BY f.closed_at DESC
    LIMIT v_limit
  )
  SELECT
    p.id AS session_id,
    p.closed_at,
    p.outlet_id,
    COALESCE(NULLIF(btrim(po.name), ''), '—') AS outlet_name,
    COALESCE(NULLIF(btrim(p.table_name), ''), '—') AS table_name,
    p.staff_user_id,
    COALESCE(
      NULLIF(btrim(e.full_name), ''),
      NULLIF(btrim(pr.full_name), ''),
      NULLIF(split_part(au.email, '@', 1), ''),
      'Unknown Staff'
    ) AS staff_name,
    COALESCE(NULLIF(btrim(p.cancel_reason), ''), '—') AS cancel_reason,
    COALESCE(items.item_summary, '') AS item_summary,
    COALESCE(p.cart_snapshot, '[]'::jsonb) AS cart_snapshot
  FROM page p
  LEFT JOIN public.pos_outlets po ON po.id = p.outlet_id
  LEFT JOIN public.employees e ON e.user_id = p.staff_user_id AND e.organization_id = p_organization_id
  LEFT JOIN public.profiles pr ON pr.user_id = p.staff_user_id
  LEFT JOIN auth.users au ON au.id = p.staff_user_id
  LEFT JOIN LATERAL (
    SELECT string_agg(sub.n, ', ' ORDER BY sub.ord) AS item_summary
    FROM (
      SELECT
        COALESCE(
          NULLIF(btrim(elem->>'serviceName'), ''),
          NULLIF(btrim(elem->>'service_name'), ''),
          'Item'
        ) AS n,
        ordinality AS ord
      FROM jsonb_array_elements(COALESCE(p.cart_snapshot, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ordinality)
      ORDER BY ordinality
      LIMIT 3
    ) sub
  ) items ON true
  ORDER BY p.closed_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_transactions_void_items(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_cursor timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  void_id uuid,
  created_at timestamptz,
  outlet_id uuid,
  outlet_name text,
  session_id uuid,
  table_name text,
  product_name text,
  quantity numeric,
  unit_price numeric,
  line_total numeric,
  reason text,
  voided_by_user_id uuid,
  voided_by_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
BEGIN
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
      RAISE EXCEPTION 'not_authenticated';
    END IF;
  ELSIF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      v.id,
      v.created_at,
      v.outlet_id,
      v.session_id,
      v.product_name,
      v.quantity,
      v.unit_price,
      v.reason,
      v.voided_by
    FROM public.pos_line_voids v
    WHERE v.organization_id = p_organization_id
      AND (p_outlet_id IS NULL OR v.outlet_id = p_outlet_id)
      AND (p_from IS NULL OR v.created_at >= p_from)
      AND (p_to IS NULL OR v.created_at < p_to)
  ),
  page AS (
    SELECT f.*
    FROM filtered f
    WHERE p_cursor IS NULL OR f.created_at < p_cursor
    ORDER BY f.created_at DESC
    LIMIT v_limit
  )
  SELECT
    p.id AS void_id,
    p.created_at,
    p.outlet_id,
    COALESCE(NULLIF(btrim(po.name), ''), '—') AS outlet_name,
    p.session_id,
    COALESCE(NULLIF(btrim(pts.table_name), ''), '—') AS table_name,
    COALESCE(NULLIF(btrim(p.product_name), ''), '—') AS product_name,
    p.quantity::numeric,
    p.unit_price::numeric,
    (p.quantity * p.unit_price)::numeric AS line_total,
    COALESCE(NULLIF(btrim(p.reason), ''), '—') AS reason,
    p.voided_by AS voided_by_user_id,
    COALESCE(
      NULLIF(btrim(pr.full_name), ''),
      NULLIF(split_part(au.email, '@', 1), ''),
      'Unknown Staff'
    ) AS voided_by_name
  FROM page p
  LEFT JOIN public.pos_outlets po ON po.id = p.outlet_id
  LEFT JOIN public.pos_table_sessions pts ON pts.id = p.session_id
  LEFT JOIN public.profiles pr ON pr.user_id = p.voided_by
  LEFT JOIN auth.users au ON au.id = p.voided_by
  ORDER BY p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.pos_transactions_success_orders IS
  'Transactions audit: paginated successful store checkouts with summary totals.';

COMMENT ON FUNCTION public.pos_transactions_cancelled_orders IS
  'Transactions audit: paginated cancelled table sessions.';

COMMENT ON FUNCTION public.pos_transactions_void_items IS
  'Transactions audit: paginated line voids.';

GRANT EXECUTE ON FUNCTION public.pos_transactions_success_orders(uuid, uuid, timestamptz, timestamptz, text, timestamptz, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_transactions_cancelled_orders(uuid, uuid, timestamptz, timestamptz, timestamptz, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_transactions_void_items(uuid, uuid, timestamptz, timestamptz, timestamptz, integer) TO authenticated, service_role;
