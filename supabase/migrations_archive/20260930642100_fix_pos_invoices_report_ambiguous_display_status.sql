-- Fix pos_invoices_report: qualify display_status in summary CTE (RETURNS TABLE name clash).

CREATE OR REPLACE FUNCTION public.pos_invoices_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_status_filter text DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_cursor timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  activity_id uuid,
  invoice_number text,
  created_at timestamptz,
  invoice_due_date date,
  outlet_id uuid,
  outlet_name text,
  client_name text,
  display_status text,
  overdue_days integer,
  total_amount numeric,
  total_paid_amount numeric,
  amount_due numeric,
  item_summary text,
  summary_count bigint,
  summary_unpaid bigint,
  summary_partial bigint,
  summary_paid bigint,
  summary_overdue bigint,
  summary_cancelled bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_search text := btrim(COALESCE(p_search_query, ''));
  v_invoice_prefix text;
BEGIN
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
      RAISE EXCEPTION 'not_authenticated';
    END IF;
  ELSIF p_organization_id IS NULL
     OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  v_invoice_prefix := upper(replace(replace(v_search, 'INV-', ''), '-', ''));

  RETURN QUERY
  WITH eligible AS (
    SELECT
      sa.id,
      sa.created_at,
      sa.invoice_number,
      sa.invoice_due_date,
      sa.invoice_cancelled_at,
      sa.payment_status,
      sa.client_name,
      sa.pos_outlet_id,
      COALESCE(sa.total_amount, 0)::numeric AS total_amount,
      COALESCE(sa.total_paid_amount, 0)::numeric AS total_paid_amount
    FROM public.sales_activities sa
    WHERE sa.organization_id = p_organization_id
      AND lower(btrim(sa.activity_type)) <> 'store checkout'
      AND COALESCE(sa.total_amount, 0) > 0
      AND sa.invoice_number IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.sales_activity_items sai WHERE sai.sales_activity_id = sa.id
      )
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
      AND (
        v_search = ''
        OR sa.client_name ILIKE '%' || v_search || '%'
        OR upper(replace(COALESCE(sa.invoice_number, ''), '-', '')) LIKE '%' || upper(replace(v_search, '-', '')) || '%'
        OR (
          v_invoice_prefix <> ''
          AND upper(replace(sa.id::text, '-', '')) LIKE v_invoice_prefix || '%'
        )
      )
  ),
  enriched AS (
    SELECT
      e.*,
      public.pos_invoice_display_status(
        e.invoice_cancelled_at,
        e.invoice_due_date,
        e.payment_status,
        e.total_amount,
        e.total_paid_amount
      ) AS display_status,
      CASE
        WHEN e.invoice_cancelled_at IS NOT NULL THEN NULL
        WHEN e.invoice_due_date IS NULL THEN NULL
        WHEN e.invoice_due_date >= CURRENT_DATE THEN NULL
        ELSE (CURRENT_DATE - e.invoice_due_date)::integer
      END AS overdue_days,
      GREATEST(e.total_amount - e.total_paid_amount, 0)::numeric AS amount_due
    FROM eligible e
  ),
  filtered AS (
    SELECT e.*
    FROM enriched e
    WHERE p_status_filter IS NULL
       OR btrim(p_status_filter) = ''
       OR btrim(p_status_filter) = 'all'
       OR e.display_status = lower(btrim(p_status_filter))
  ),
  summary AS (
    SELECT
      COUNT(*)::bigint AS summary_count,
      COUNT(*) FILTER (WHERE f.display_status = 'unpaid')::bigint AS summary_unpaid,
      COUNT(*) FILTER (WHERE f.display_status = 'partial')::bigint AS summary_partial,
      COUNT(*) FILTER (WHERE f.display_status = 'paid')::bigint AS summary_paid,
      COUNT(*) FILTER (WHERE f.display_status = 'overdue')::bigint AS summary_overdue,
      COUNT(*) FILTER (WHERE f.display_status = 'cancelled')::bigint AS summary_cancelled
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
    COALESCE(p.invoice_number, 'INV-' || upper(substr(replace(p.id::text, '-', ''), 1, 8))) AS invoice_number,
    p.created_at,
    p.invoice_due_date,
    p.pos_outlet_id AS outlet_id,
    COALESCE(NULLIF(btrim(po.name), ''), '—') AS outlet_name,
    COALESCE(NULLIF(btrim(p.client_name), ''), '—') AS client_name,
    p.display_status,
    p.overdue_days,
    p.total_amount,
    p.total_paid_amount,
    p.amount_due,
    COALESCE(items.item_summary, '') AS item_summary,
    sm.summary_count,
    sm.summary_unpaid,
    sm.summary_partial,
    sm.summary_paid,
    sm.summary_overdue,
    sm.summary_cancelled
  FROM page p
  CROSS JOIN summary sm
  LEFT JOIN public.pos_outlets po ON po.id = p.pos_outlet_id
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
