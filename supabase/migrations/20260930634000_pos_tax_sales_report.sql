-- Tax Sales report: persist bill-level tax applications + aggregate RPCs

CREATE TABLE IF NOT EXISTS public.sales_activity_checkout_taxes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sales_activity_id uuid NOT NULL REFERENCES public.sales_activities (id) ON DELETE CASCADE,
  catalog_tax_id uuid NULL REFERENCES public.catalog_taxes (id) ON DELETE SET NULL,
  tax_name text NOT NULL,
  amount_percent numeric NOT NULL DEFAULT 0,
  amount_rp numeric NOT NULL DEFAULT 0,
  rate_label text NOT NULL DEFAULT '—',
  application_method text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_activity_checkout_taxes_pkey PRIMARY KEY (id),
  CONSTRAINT sales_activity_checkout_taxes_amount_rp_check CHECK (amount_rp >= 0),
  CONSTRAINT sales_activity_checkout_taxes_amount_percent_check CHECK (amount_percent >= 0),
  CONSTRAINT sales_activity_checkout_taxes_tax_name_check CHECK (btrim(tax_name) <> ''),
  CONSTRAINT sales_activity_checkout_taxes_rate_label_check CHECK (btrim(rate_label) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_activity_checkout_taxes_activity_tax
  ON public.sales_activity_checkout_taxes (sales_activity_id, catalog_tax_id)
  WHERE catalog_tax_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_activity_checkout_taxes_activity_name_rate
  ON public.sales_activity_checkout_taxes (sales_activity_id, tax_name, amount_percent)
  WHERE catalog_tax_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sact_org_activity
  ON public.sales_activity_checkout_taxes (organization_id, sales_activity_id);

CREATE INDEX IF NOT EXISTS idx_sact_org_tax
  ON public.sales_activity_checkout_taxes (organization_id, catalog_tax_id);

ALTER TABLE public.sales_activity_checkout_taxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_activity_checkout_taxes_org_select" ON public.sales_activity_checkout_taxes;
CREATE POLICY "sales_activity_checkout_taxes_org_select"
  ON public.sales_activity_checkout_taxes FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_checkout_taxes_org_insert" ON public.sales_activity_checkout_taxes;
CREATE POLICY "sales_activity_checkout_taxes_org_insert"
  ON public.sales_activity_checkout_taxes FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_checkout_taxes_org_update" ON public.sales_activity_checkout_taxes;
CREATE POLICY "sales_activity_checkout_taxes_org_update"
  ON public.sales_activity_checkout_taxes FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_checkout_taxes_org_delete" ON public.sales_activity_checkout_taxes;
CREATE POLICY "sales_activity_checkout_taxes_org_delete"
  ON public.sales_activity_checkout_taxes FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.sales_activity_checkout_taxes IS
  'Bill-level tax applications per paid checkout for Tax Sales reporting.';

-- Approximate backfill from historical checkout_tax_amount (idempotent)
WITH candidates AS (
  SELECT
    sa.id AS sales_activity_id,
    sa.organization_id,
    sa.pos_outlet_id,
    COALESCE(sa.checkout_tax_amount, 0)::numeric AS checkout_tax_amount,
    GREATEST(COALESCE(sa.checkout_subtotal, 0), 0)::numeric AS checkout_subtotal,
    GREATEST(COALESCE(sa.checkout_gratuity_amount, 0), 0)::numeric AS checkout_gratuity_amount,
    COALESCE(sa.checkout_application_method, 'add') AS application_method
  FROM public.sales_activities sa
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.checkout_tax_amount, 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.sales_activity_checkout_taxes existing
      WHERE existing.sales_activity_id = sa.id
    )
),
outlet_taxes AS (
  SELECT
    cto.outlet_id,
    ct.id AS catalog_tax_id,
    btrim(ct.name) AS tax_name,
    COALESCE(ct.amount_percent, 0)::numeric AS amount_percent,
    COALESCE(ct.sort_order, 9999) AS sort_order,
    COUNT(*) OVER (PARTITION BY cto.outlet_id) AS tax_count,
    ROW_NUMBER() OVER (PARTITION BY cto.outlet_id ORDER BY ct.sort_order, ct.name) AS tax_rn
  FROM public.catalog_tax_outlets cto
  JOIN public.catalog_taxes ct ON ct.id = cto.tax_id AND ct.is_active = true
),
expanded AS (
  SELECT
    c.sales_activity_id,
    c.organization_id,
    c.checkout_tax_amount,
    c.application_method,
    ot.catalog_tax_id,
    COALESCE(ot.tax_name, 'Unknown / Legacy') AS tax_name,
    COALESCE(ot.amount_percent, 0)::numeric AS amount_percent,
    COALESCE(ot.sort_order, 9999) AS sort_order,
    COALESCE(ot.tax_count, 0) AS tax_count,
    COALESCE(ot.tax_rn, 1) AS tax_rn,
    (c.checkout_subtotal + c.checkout_gratuity_amount)::numeric AS tax_base
  FROM candidates c
  LEFT JOIN outlet_taxes ot ON ot.outlet_id = c.pos_outlet_id
),
raw_amounts AS (
  SELECT
    e.*,
    CASE
      WHEN e.tax_count = 0 THEN e.checkout_tax_amount
      WHEN e.tax_count = 1 THEN e.checkout_tax_amount
      WHEN e.application_method = 'include' THEN
        CASE
          WHEN SUM(e.amount_percent) OVER (PARTITION BY e.sales_activity_id) > 0 THEN
            e.checkout_tax_amount * e.amount_percent
              / SUM(e.amount_percent) OVER (PARTITION BY e.sales_activity_id)
          ELSE 0::numeric
        END
      ELSE ROUND(e.tax_base * e.amount_percent / 100)::numeric
    END AS raw_amount_rp
  FROM expanded e
),
scaled AS (
  SELECT
    r.*,
    COALESCE(SUM(r.raw_amount_rp) OVER (PARTITION BY r.sales_activity_id), 0)::numeric AS raw_sum,
    ROW_NUMBER() OVER (
      PARTITION BY r.sales_activity_id
      ORDER BY r.tax_rn DESC, r.sort_order DESC, r.tax_name DESC
    ) AS last_rn
  FROM raw_amounts r
  WHERE r.tax_count > 0 OR r.catalog_tax_id IS NULL
),
final_amounts AS (
  SELECT
    s.sales_activity_id,
    s.organization_id,
    s.catalog_tax_id,
    s.tax_name,
    s.amount_percent,
    s.application_method,
    s.tax_count,
    CASE
      WHEN s.tax_count = 0 THEN s.checkout_tax_amount
      WHEN s.raw_sum <= 0 AND s.tax_rn = 1 THEN s.checkout_tax_amount
      WHEN s.last_rn = 1 THEN
        GREATEST(
          s.checkout_tax_amount
            - COALESCE(
                SUM(
                  CASE
                    WHEN s.raw_sum > 0 THEN
                      ROUND(s.raw_amount_rp * s.checkout_tax_amount / s.raw_sum)::numeric
                    ELSE 0::numeric
                  END
                ) OVER (
                  PARTITION BY s.sales_activity_id
                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ),
                0
              ),
          0
        )::numeric
      WHEN s.raw_sum > 0 THEN
        ROUND(s.raw_amount_rp * s.checkout_tax_amount / s.raw_sum)::numeric
      ELSE 0::numeric
    END AS amount_rp
  FROM scaled s
)
INSERT INTO public.sales_activity_checkout_taxes (
  organization_id,
  sales_activity_id,
  catalog_tax_id,
  tax_name,
  amount_percent,
  amount_rp,
  rate_label,
  application_method
)
SELECT
  fa.organization_id,
  fa.sales_activity_id,
  fa.catalog_tax_id,
  fa.tax_name,
  fa.amount_percent,
  GREATEST(fa.amount_rp, 0)::numeric AS amount_rp,
  CASE
    WHEN fa.amount_percent > 0 THEN
      trim(to_char(fa.amount_percent, 'FM999,999,990.##')) || '%'
    ELSE '—'
  END AS rate_label,
  fa.application_method
FROM final_amounts fa
WHERE GREATEST(fa.amount_rp, 0) > 0
  AND fa.tax_count > 0;

INSERT INTO public.sales_activity_checkout_taxes (
  organization_id,
  sales_activity_id,
  catalog_tax_id,
  tax_name,
  amount_percent,
  amount_rp,
  rate_label,
  application_method
)
SELECT
  c.organization_id,
  c.sales_activity_id,
  NULL::uuid,
  'Unknown / Legacy',
  0::numeric,
  c.checkout_tax_amount,
  '—',
  COALESCE(c.application_method, 'add')
FROM (
  SELECT
    sa.id AS sales_activity_id,
    sa.organization_id,
    sa.pos_outlet_id,
    COALESCE(sa.checkout_tax_amount, 0)::numeric AS checkout_tax_amount,
    COALESCE(sa.checkout_application_method, 'add') AS application_method
  FROM public.sales_activities sa
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.checkout_tax_amount, 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.sales_activity_checkout_taxes existing
      WHERE existing.sales_activity_id = sa.id
    )
) c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.catalog_tax_outlets cto
  JOIN public.catalog_taxes ct ON ct.id = cto.tax_id AND ct.is_active = true
  WHERE cto.outlet_id = c.pos_outlet_id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.sales_activity_checkout_taxes existing
  WHERE existing.sales_activity_id = c.sales_activity_id
);

CREATE OR REPLACE FUNCTION public.pos_tax_sales_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  catalog_tax_id uuid,
  tax_name text,
  sort_order integer,
  times_applied numeric,
  gross_tax numeric,
  refund_amount numeric,
  net_tax numeric,
  summary_total_net_tax numeric
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
  WITH activity_tax_total AS (
    SELECT
      sact.sales_activity_id,
      COALESCE(SUM(COALESCE(sact.amount_rp, 0)), 0)::numeric AS tax_total
    FROM public.sales_activity_checkout_taxes sact
    GROUP BY sact.sales_activity_id
  ),
  sold AS (
    SELECT
      sact.catalog_tax_id AS tax_id,
      sact.tax_name AS t_name,
      COUNT(*)::numeric AS times_applied,
      COALESCE(SUM(COALESCE(sact.amount_rp, 0)), 0)::numeric AS gross_tax
    FROM public.sales_activity_checkout_taxes sact
    JOIN public.sales_activities sa ON sa.id = sact.sales_activity_id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
    GROUP BY sact.catalog_tax_id, sact.tax_name
  ),
  refund_activity_net AS (
    SELECT
      sa.id AS activity_id,
      COALESCE(sa.refund_amount, 0)::numeric AS refund_total
    FROM public.sales_activities sa
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND sa.refund_status = 'full'
      AND sa.refunded_at IS NOT NULL
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.refunded_at >= p_from)
      AND (p_to IS NULL OR sa.refunded_at < p_to)
  ),
  refund_lines AS (
    SELECT
      sact.catalog_tax_id AS tax_id,
      sact.tax_name AS t_name,
      CASE
        WHEN att.tax_total > 0 THEN
          COALESCE(sact.amount_rp, 0) / att.tax_total * ran.refund_total
        ELSE 0::numeric
      END AS refund_line_amount
    FROM refund_activity_net ran
    JOIN public.sales_activity_checkout_taxes sact ON sact.sales_activity_id = ran.activity_id
    JOIN activity_tax_total att ON att.sales_activity_id = ran.activity_id
  ),
  refund_grouped AS (
    SELECT
      rl.tax_id,
      rl.t_name,
      COALESCE(SUM(COALESCE(rl.refund_line_amount, 0)), 0)::numeric AS refund_amount
    FROM refund_lines rl
    GROUP BY rl.tax_id, rl.t_name
  ),
  merged AS (
    SELECT
      s.tax_id,
      s.t_name,
      COALESCE(s.times_applied, 0)::numeric AS times_applied,
      COALESCE(s.gross_tax, 0)::numeric AS gross_tax,
      COALESCE(rg.refund_amount, 0)::numeric AS refund_amount
    FROM sold s
    LEFT JOIN refund_grouped rg
      ON rg.tax_id IS NOT DISTINCT FROM s.tax_id
     AND rg.t_name = s.t_name
    UNION ALL
    SELECT
      rg.tax_id,
      rg.t_name,
      0::numeric AS times_applied,
      0::numeric AS gross_tax,
      rg.refund_amount
    FROM refund_grouped rg
    WHERE NOT EXISTS (
      SELECT 1
      FROM sold s
      WHERE s.tax_id IS NOT DISTINCT FROM rg.tax_id
        AND s.t_name = rg.t_name
    )
  ),
  rolled AS (
    SELECT
      m.tax_id,
      m.t_name,
      COALESCE(SUM(m.times_applied), 0)::numeric AS times_applied,
      COALESCE(SUM(m.gross_tax), 0)::numeric AS gross_tax,
      COALESCE(SUM(m.refund_amount), 0)::numeric AS refund_amount
    FROM merged m
    GROUP BY m.tax_id, m.t_name
  ),
  summary AS (
    SELECT
      COALESCE(SUM(r.gross_tax - r.refund_amount), 0)::numeric AS net_total
    FROM rolled r
  )
  SELECT
    r.tax_id AS catalog_tax_id,
    r.t_name AS tax_name,
    COALESCE(ct.sort_order, 9999)::integer AS sort_order,
    r.times_applied,
    r.gross_tax,
    r.refund_amount,
    (r.gross_tax - r.refund_amount)::numeric AS net_tax,
    s.net_total AS summary_total_net_tax
  FROM rolled r
  CROSS JOIN summary s
  LEFT JOIN public.catalog_taxes ct ON ct.id = r.tax_id
  WHERE r.times_applied > 0
     OR r.gross_tax > 0
     OR r.refund_amount > 0
  ORDER BY r.gross_tax DESC, r.t_name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_tax_sales_by_rate(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  catalog_tax_id uuid,
  tax_name text,
  tax_sort_order integer,
  rate_label text,
  rate_sort_order integer,
  times_applied numeric,
  gross_tax numeric,
  refund_amount numeric,
  net_tax numeric,
  summary_total_net_tax numeric
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
  WITH activity_tax_total AS (
    SELECT
      sact.sales_activity_id,
      COALESCE(SUM(COALESCE(sact.amount_rp, 0)), 0)::numeric AS tax_total
    FROM public.sales_activity_checkout_taxes sact
    GROUP BY sact.sales_activity_id
  ),
  sold AS (
    SELECT
      sact.catalog_tax_id AS tax_id,
      sact.tax_name AS t_name,
      sact.rate_label AS r_label,
      COALESCE(sact.amount_percent, 0)::numeric AS r_sort,
      COUNT(*)::numeric AS times_applied,
      COALESCE(SUM(COALESCE(sact.amount_rp, 0)), 0)::numeric AS gross_tax
    FROM public.sales_activity_checkout_taxes sact
    JOIN public.sales_activities sa ON sa.id = sact.sales_activity_id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
    GROUP BY sact.catalog_tax_id, sact.tax_name, sact.rate_label, sact.amount_percent
  ),
  refund_activity_net AS (
    SELECT
      sa.id AS activity_id,
      COALESCE(sa.refund_amount, 0)::numeric AS refund_total
    FROM public.sales_activities sa
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND sa.refund_status = 'full'
      AND sa.refunded_at IS NOT NULL
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.refunded_at >= p_from)
      AND (p_to IS NULL OR sa.refunded_at < p_to)
  ),
  refund_lines AS (
    SELECT
      sact.catalog_tax_id AS tax_id,
      sact.tax_name AS t_name,
      sact.rate_label AS r_label,
      COALESCE(sact.amount_percent, 0)::numeric AS r_sort,
      CASE
        WHEN att.tax_total > 0 THEN
          COALESCE(sact.amount_rp, 0) / att.tax_total * ran.refund_total
        ELSE 0::numeric
      END AS refund_line_amount
    FROM refund_activity_net ran
    JOIN public.sales_activity_checkout_taxes sact ON sact.sales_activity_id = ran.activity_id
    JOIN activity_tax_total att ON att.sales_activity_id = ran.activity_id
  ),
  refund_grouped AS (
    SELECT
      rl.tax_id,
      rl.t_name,
      rl.r_label,
      rl.r_sort,
      COALESCE(SUM(COALESCE(rl.refund_line_amount, 0)), 0)::numeric AS refund_amount
    FROM refund_lines rl
    GROUP BY rl.tax_id, rl.t_name, rl.r_label, rl.r_sort
  ),
  merged AS (
    SELECT
      s.tax_id,
      s.t_name,
      s.r_label,
      s.r_sort,
      COALESCE(s.times_applied, 0)::numeric AS times_applied,
      COALESCE(s.gross_tax, 0)::numeric AS gross_tax,
      COALESCE(rg.refund_amount, 0)::numeric AS refund_amount
    FROM sold s
    LEFT JOIN refund_grouped rg
      ON rg.tax_id IS NOT DISTINCT FROM s.tax_id
     AND rg.t_name = s.t_name
     AND rg.r_label = s.r_label
     AND rg.r_sort = s.r_sort
    UNION ALL
    SELECT
      rg.tax_id,
      rg.t_name,
      rg.r_label,
      rg.r_sort,
      0::numeric AS times_applied,
      0::numeric AS gross_tax,
      rg.refund_amount
    FROM refund_grouped rg
    WHERE NOT EXISTS (
      SELECT 1
      FROM sold s
      WHERE s.tax_id IS NOT DISTINCT FROM rg.tax_id
        AND s.t_name = rg.t_name
        AND s.r_label = rg.r_label
        AND s.r_sort = rg.r_sort
    )
  ),
  rolled AS (
    SELECT
      m.tax_id,
      m.t_name,
      m.r_label,
      m.r_sort,
      COALESCE(SUM(m.times_applied), 0)::numeric AS times_applied,
      COALESCE(SUM(m.gross_tax), 0)::numeric AS gross_tax,
      COALESCE(SUM(m.refund_amount), 0)::numeric AS refund_amount
    FROM merged m
    GROUP BY m.tax_id, m.t_name, m.r_label, m.r_sort
  ),
  summary AS (
    SELECT
      COALESCE(SUM(r.gross_tax - r.refund_amount), 0)::numeric AS net_total
    FROM rolled r
  )
  SELECT
    r.tax_id AS catalog_tax_id,
    r.t_name AS tax_name,
    COALESCE(ct.sort_order, 9999)::integer AS tax_sort_order,
    r.r_label AS rate_label,
    COALESCE(r.r_sort, 0)::integer AS rate_sort_order,
    r.times_applied,
    r.gross_tax,
    r.refund_amount,
    (r.gross_tax - r.refund_amount)::numeric AS net_tax,
    s.net_total AS summary_total_net_tax
  FROM rolled r
  CROSS JOIN summary s
  LEFT JOIN public.catalog_taxes ct ON ct.id = r.tax_id
  WHERE r.times_applied > 0
     OR r.gross_tax > 0
     OR r.refund_amount > 0
  ORDER BY COALESCE(ct.sort_order, 9999), r.gross_tax DESC, r.r_label ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_tax_sales_report(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_tax_sales_by_rate(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
