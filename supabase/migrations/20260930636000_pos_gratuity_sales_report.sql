-- Gratuity Sales report: persist bill-level gratuity applications + aggregate RPCs

CREATE TABLE IF NOT EXISTS public.sales_activity_checkout_gratuities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sales_activity_id uuid NOT NULL REFERENCES public.sales_activities (id) ON DELETE CASCADE,
  catalog_gratuity_id uuid NULL REFERENCES public.catalog_gratuities (id) ON DELETE SET NULL,
  gratuity_name text NOT NULL,
  amount_percent numeric NOT NULL DEFAULT 0,
  amount_rp numeric NOT NULL DEFAULT 0,
  rate_label text NOT NULL DEFAULT '—',
  application_method text NULL,
  is_backfill_estimate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_activity_checkout_gratuities_pkey PRIMARY KEY (id),
  CONSTRAINT sales_activity_checkout_gratuities_amount_rp_check CHECK (amount_rp >= 0),
  CONSTRAINT sales_activity_checkout_gratuities_amount_percent_check CHECK (amount_percent >= 0),
  CONSTRAINT sales_activity_checkout_gratuities_gratuity_name_check CHECK (btrim(gratuity_name) <> ''),
  CONSTRAINT sales_activity_checkout_gratuities_rate_label_check CHECK (btrim(rate_label) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_activity_checkout_gratuities_activity_gratuity
  ON public.sales_activity_checkout_gratuities (sales_activity_id, catalog_gratuity_id)
  WHERE catalog_gratuity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_activity_checkout_gratuities_activity_name_rate
  ON public.sales_activity_checkout_gratuities (sales_activity_id, gratuity_name, amount_percent)
  WHERE catalog_gratuity_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sacg_org_activity
  ON public.sales_activity_checkout_gratuities (organization_id, sales_activity_id);

CREATE INDEX IF NOT EXISTS idx_sacg_org_gratuity
  ON public.sales_activity_checkout_gratuities (organization_id, catalog_gratuity_id);

ALTER TABLE public.sales_activity_checkout_gratuities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_activity_checkout_gratuities_org_select" ON public.sales_activity_checkout_gratuities;
CREATE POLICY "sales_activity_checkout_gratuities_org_select"
  ON public.sales_activity_checkout_gratuities FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_checkout_gratuities_org_insert" ON public.sales_activity_checkout_gratuities;
CREATE POLICY "sales_activity_checkout_gratuities_org_insert"
  ON public.sales_activity_checkout_gratuities FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_checkout_gratuities_org_update" ON public.sales_activity_checkout_gratuities;
CREATE POLICY "sales_activity_checkout_gratuities_org_update"
  ON public.sales_activity_checkout_gratuities FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_checkout_gratuities_org_delete" ON public.sales_activity_checkout_gratuities;
CREATE POLICY "sales_activity_checkout_gratuities_org_delete"
  ON public.sales_activity_checkout_gratuities FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.sales_activity_checkout_gratuities IS
  'Bill-level gratuity applications per paid checkout for Gratuity Sales reporting.';

-- Approximate backfill from historical checkout_gratuity_amount (idempotent)
WITH candidates AS (
  SELECT
    sa.id AS sales_activity_id,
    sa.organization_id,
    sa.pos_outlet_id,
    sa.catalog_sales_type_id,
    COALESCE(sa.checkout_gratuity_amount, 0)::numeric AS checkout_gratuity_amount,
    GREATEST(COALESCE(sa.checkout_subtotal, 0), 0)::numeric AS checkout_subtotal,
    COALESCE(sa.checkout_application_method, 'add') AS application_method
  FROM public.sales_activities sa
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.checkout_gratuity_amount, 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.sales_activity_checkout_gratuities existing
      WHERE existing.sales_activity_id = sa.id
    )
),
outlet_gratuities AS (
  SELECT
    cgo.outlet_id,
    cg.id AS catalog_gratuity_id,
    btrim(cg.name) AS gratuity_name,
    COALESCE(cg.amount_percent, 0)::numeric AS amount_percent,
    COALESCE(cg.sort_order, 9999) AS sort_order
  FROM public.catalog_gratuity_outlets cgo
  JOIN public.catalog_gratuities cg ON cg.id = cgo.gratuity_id AND cg.is_active = true
),
type_gratuities AS (
  SELECT
    cstg.sales_type_id,
    cstg.gratuity_id
  FROM public.catalog_sales_type_gratuities cstg
),
expanded AS (
  SELECT
    c.sales_activity_id,
    c.organization_id,
    c.checkout_gratuity_amount,
    c.checkout_subtotal,
    c.application_method,
    og.catalog_gratuity_id,
    COALESCE(og.gratuity_name, 'Unknown / Legacy') AS gratuity_name,
    COALESCE(og.amount_percent, 0)::numeric AS amount_percent,
    COALESCE(og.sort_order, 9999) AS sort_order,
    COUNT(*) OVER (PARTITION BY c.sales_activity_id) AS gratuity_count
  FROM candidates c
  LEFT JOIN outlet_gratuities og ON og.outlet_id = c.pos_outlet_id
  LEFT JOIN type_gratuities tg
    ON tg.sales_type_id = c.catalog_sales_type_id
   AND tg.gratuity_id = og.catalog_gratuity_id
  WHERE og.catalog_gratuity_id IS NULL
     OR c.catalog_sales_type_id IS NULL
     OR tg.gratuity_id IS NOT NULL
),
raw_amounts AS (
  SELECT
    e.*,
    CASE
      WHEN e.gratuity_count = 0 THEN e.checkout_gratuity_amount
      WHEN e.application_method = 'include' AND e.checkout_subtotal > 0 THEN
        ROUND(
          (
            e.checkout_subtotal
            / (1 + SUM(e.amount_percent) OVER (PARTITION BY e.sales_activity_id) / 100)
          ) * e.amount_percent / 100
        )::numeric
      WHEN e.checkout_subtotal > 0 AND e.amount_percent > 0 THEN
        ROUND(e.checkout_subtotal * e.amount_percent / 100)::numeric
      ELSE 0::numeric
    END AS raw_amount
  FROM expanded e
),
normalized AS (
  SELECT
    ra.sales_activity_id,
    ra.organization_id,
    ra.application_method,
    ra.checkout_gratuity_amount,
    ra.catalog_gratuity_id,
    ra.gratuity_name,
    ra.amount_percent,
    ra.gratuity_count,
    ra.raw_amount,
    SUM(COALESCE(ra.raw_amount, 0)) OVER (PARTITION BY ra.sales_activity_id) AS raw_total
  FROM raw_amounts ra
),
final_amounts AS (
  SELECT
    n.sales_activity_id,
    n.organization_id,
    n.application_method,
    n.catalog_gratuity_id,
    n.gratuity_name,
    n.amount_percent,
    CASE
      WHEN n.gratuity_count = 0 THEN n.checkout_gratuity_amount
      WHEN COALESCE(n.raw_total, 0) > 0 THEN
        ROUND(n.raw_amount / n.raw_total * n.checkout_gratuity_amount)::numeric
      ELSE 0::numeric
    END AS amount_rp
  FROM normalized n
)
INSERT INTO public.sales_activity_checkout_gratuities (
  organization_id,
  sales_activity_id,
  catalog_gratuity_id,
  gratuity_name,
  amount_percent,
  amount_rp,
  rate_label,
  application_method,
  is_backfill_estimate
)
SELECT
  fa.organization_id,
  fa.sales_activity_id,
  fa.catalog_gratuity_id,
  fa.gratuity_name,
  fa.amount_percent,
  GREATEST(COALESCE(fa.amount_rp, 0), 0)::numeric AS amount_rp,
  CASE
    WHEN fa.amount_percent > 0 THEN
      trim(trailing '.' from trim(trailing '0' from fa.amount_percent::text)) || '%'
    ELSE '—'
  END AS rate_label,
  fa.application_method,
  true AS is_backfill_estimate
FROM final_amounts fa
WHERE GREATEST(COALESCE(fa.amount_rp, 0), 0) > 0
ON CONFLICT DO NOTHING;

-- Legacy fallback: activities with gratuity total but no resolvable catalog rules
INSERT INTO public.sales_activity_checkout_gratuities (
  organization_id,
  sales_activity_id,
  catalog_gratuity_id,
  gratuity_name,
  amount_percent,
  amount_rp,
  rate_label,
  application_method,
  is_backfill_estimate
)
SELECT
  sa.organization_id,
  sa.id AS sales_activity_id,
  NULL AS catalog_gratuity_id,
  'Unknown / Legacy' AS gratuity_name,
  0::numeric AS amount_percent,
  COALESCE(sa.checkout_gratuity_amount, 0)::numeric AS amount_rp,
  '—' AS rate_label,
  COALESCE(sa.checkout_application_method, 'add') AS application_method,
  true AS is_backfill_estimate
FROM public.sales_activities sa
WHERE sa.activity_type = 'Store Checkout'
  AND sa.status = 'Converted'
  AND COALESCE(sa.checkout_gratuity_amount, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.sales_activity_checkout_gratuities existing
    WHERE existing.sales_activity_id = sa.id
  )
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.pos_gratuity_sales_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  catalog_gratuity_id uuid,
  gratuity_name text,
  sort_order integer,
  times_applied numeric,
  gratuity_collected numeric,
  gross_gratuity numeric,
  refund_amount numeric,
  net_gratuity numeric,
  summary_total_net_gratuity numeric,
  has_backfill_estimate boolean
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
  WITH activity_gratuity_total AS (
    SELECT
      sacg.sales_activity_id,
      COALESCE(SUM(COALESCE(sacg.amount_rp, 0)), 0)::numeric AS gratuity_total
    FROM public.sales_activity_checkout_gratuities sacg
    GROUP BY sacg.sales_activity_id
  ),
  sold AS (
    SELECT
      sacg.catalog_gratuity_id AS disc_id,
      sacg.gratuity_name AS disc_name,
      COUNT(*)::numeric AS times_applied,
      COALESCE(SUM(COALESCE(sacg.amount_rp, 0)), 0)::numeric AS gratuity_collected,
      BOOL_OR(sacg.is_backfill_estimate) AS has_backfill_estimate
    FROM public.sales_activity_checkout_gratuities sacg
    JOIN public.sales_activities sa ON sa.id = sacg.sales_activity_id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
    GROUP BY sacg.catalog_gratuity_id, sacg.gratuity_name
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
      sacg.catalog_gratuity_id AS disc_id,
      sacg.gratuity_name AS disc_name,
      CASE
        WHEN agt.gratuity_total > 0 THEN
          COALESCE(sacg.amount_rp, 0) / agt.gratuity_total * ran.refund_total
        ELSE 0::numeric
      END AS refund_collected
    FROM refund_activity_net ran
    JOIN public.sales_activity_checkout_gratuities sacg ON sacg.sales_activity_id = ran.activity_id
    JOIN activity_gratuity_total agt ON agt.sales_activity_id = ran.activity_id
  ),
  refund_grouped AS (
    SELECT
      rl.disc_id,
      rl.disc_name,
      COALESCE(SUM(COALESCE(rl.refund_collected, 0)), 0)::numeric AS refund_amount
    FROM refund_lines rl
    GROUP BY rl.disc_id, rl.disc_name
  ),
  merged AS (
    SELECT
      s.disc_id,
      s.disc_name,
      COALESCE(s.times_applied, 0)::numeric AS times_applied,
      COALESCE(s.gratuity_collected, 0)::numeric AS gratuity_collected,
      COALESCE(rg.refund_amount, 0)::numeric AS refund_amount,
      COALESCE(s.has_backfill_estimate, false) AS has_backfill_estimate
    FROM sold s
    LEFT JOIN refund_grouped rg
      ON rg.disc_id IS NOT DISTINCT FROM s.disc_id
     AND rg.disc_name = s.disc_name
    UNION ALL
    SELECT
      rg.disc_id,
      rg.disc_name,
      0::numeric AS times_applied,
      0::numeric AS gratuity_collected,
      rg.refund_amount,
      false AS has_backfill_estimate
    FROM refund_grouped rg
    WHERE NOT EXISTS (
      SELECT 1
      FROM sold s
      WHERE s.disc_id IS NOT DISTINCT FROM rg.disc_id
        AND s.disc_name = rg.disc_name
    )
  ),
  rolled AS (
    SELECT
      m.disc_id,
      m.disc_name,
      COALESCE(SUM(m.times_applied), 0)::numeric AS times_applied,
      COALESCE(SUM(m.gratuity_collected), 0)::numeric AS gratuity_collected,
      COALESCE(SUM(m.refund_amount), 0)::numeric AS refund_amount,
      BOOL_OR(m.has_backfill_estimate) AS has_backfill_estimate
    FROM merged m
    GROUP BY m.disc_id, m.disc_name
  ),
  summary AS (
    SELECT
      COALESCE(SUM(r.gratuity_collected - r.refund_amount), 0)::numeric AS net_total
    FROM rolled r
  )
  SELECT
    r.disc_id AS catalog_gratuity_id,
    r.disc_name AS gratuity_name,
    COALESCE(cg.sort_order, 9999)::integer AS sort_order,
    r.times_applied,
    r.gratuity_collected,
    r.gratuity_collected AS gross_gratuity,
    r.refund_amount,
    (r.gratuity_collected - r.refund_amount)::numeric AS net_gratuity,
    s.net_total AS summary_total_net_gratuity,
    r.has_backfill_estimate
  FROM rolled r
  CROSS JOIN summary s
  LEFT JOIN public.catalog_gratuities cg ON cg.id = r.disc_id
  WHERE r.times_applied > 0
     OR r.gratuity_collected > 0
     OR r.refund_amount > 0
  ORDER BY r.gratuity_collected DESC, r.disc_name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.pos_gratuity_sales_by_rate(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  catalog_gratuity_id uuid,
  gratuity_name text,
  gratuity_sort_order integer,
  rate_label text,
  rate_sort_order integer,
  times_applied numeric,
  gratuity_collected numeric,
  gross_gratuity numeric,
  refund_amount numeric,
  net_gratuity numeric,
  summary_total_net_gratuity numeric,
  has_backfill_estimate boolean
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
  WITH activity_gratuity_total AS (
    SELECT
      sacg.sales_activity_id,
      COALESCE(SUM(COALESCE(sacg.amount_rp, 0)), 0)::numeric AS gratuity_total
    FROM public.sales_activity_checkout_gratuities sacg
    GROUP BY sacg.sales_activity_id
  ),
  sold AS (
    SELECT
      sacg.catalog_gratuity_id AS disc_id,
      sacg.gratuity_name AS disc_name,
      sacg.rate_label AS val_label,
      COALESCE(sacg.amount_percent, 0)::numeric AS val_sort,
      COUNT(*)::numeric AS times_applied,
      COALESCE(SUM(COALESCE(sacg.amount_rp, 0)), 0)::numeric AS gratuity_collected,
      BOOL_OR(sacg.is_backfill_estimate) AS has_backfill_estimate
    FROM public.sales_activity_checkout_gratuities sacg
    JOIN public.sales_activities sa ON sa.id = sacg.sales_activity_id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
    GROUP BY sacg.catalog_gratuity_id, sacg.gratuity_name, sacg.rate_label, sacg.amount_percent
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
      sacg.catalog_gratuity_id AS disc_id,
      sacg.gratuity_name AS disc_name,
      sacg.rate_label AS val_label,
      COALESCE(sacg.amount_percent, 0)::numeric AS val_sort,
      CASE
        WHEN agt.gratuity_total > 0 THEN
          COALESCE(sacg.amount_rp, 0) / agt.gratuity_total * ran.refund_total
        ELSE 0::numeric
      END AS refund_collected
    FROM refund_activity_net ran
    JOIN public.sales_activity_checkout_gratuities sacg ON sacg.sales_activity_id = ran.activity_id
    JOIN activity_gratuity_total agt ON agt.sales_activity_id = ran.activity_id
  ),
  refund_grouped AS (
    SELECT
      rl.disc_id,
      rl.disc_name,
      rl.val_label,
      rl.val_sort,
      COALESCE(SUM(COALESCE(rl.refund_collected, 0)), 0)::numeric AS refund_amount
    FROM refund_lines rl
    GROUP BY rl.disc_id, rl.disc_name, rl.val_label, rl.val_sort
  ),
  merged AS (
    SELECT
      s.disc_id,
      s.disc_name,
      s.val_label,
      s.val_sort,
      COALESCE(s.times_applied, 0)::numeric AS times_applied,
      COALESCE(s.gratuity_collected, 0)::numeric AS gratuity_collected,
      COALESCE(rg.refund_amount, 0)::numeric AS refund_amount,
      COALESCE(s.has_backfill_estimate, false) AS has_backfill_estimate
    FROM sold s
    LEFT JOIN refund_grouped rg
      ON rg.disc_id IS NOT DISTINCT FROM s.disc_id
     AND rg.disc_name = s.disc_name
     AND rg.val_label = s.val_label
     AND rg.val_sort = s.val_sort
    UNION ALL
    SELECT
      rg.disc_id,
      rg.disc_name,
      rg.val_label,
      rg.val_sort,
      0::numeric AS times_applied,
      0::numeric AS gratuity_collected,
      rg.refund_amount,
      false AS has_backfill_estimate
    FROM refund_grouped rg
    WHERE NOT EXISTS (
      SELECT 1
      FROM sold s
      WHERE s.disc_id IS NOT DISTINCT FROM rg.disc_id
        AND s.disc_name = rg.disc_name
        AND s.val_label = rg.val_label
        AND s.val_sort = rg.val_sort
    )
  ),
  rolled AS (
    SELECT
      m.disc_id,
      m.disc_name,
      m.val_label,
      m.val_sort,
      COALESCE(SUM(m.times_applied), 0)::numeric AS times_applied,
      COALESCE(SUM(m.gratuity_collected), 0)::numeric AS gratuity_collected,
      COALESCE(SUM(m.refund_amount), 0)::numeric AS refund_amount,
      BOOL_OR(m.has_backfill_estimate) AS has_backfill_estimate
    FROM merged m
    GROUP BY m.disc_id, m.disc_name, m.val_label, m.val_sort
  ),
  summary AS (
    SELECT
      COALESCE(SUM(r.gratuity_collected - r.refund_amount), 0)::numeric AS net_total
    FROM rolled r
  )
  SELECT
    r.disc_id AS catalog_gratuity_id,
    r.disc_name AS gratuity_name,
    COALESCE(cg.sort_order, 9999)::integer AS gratuity_sort_order,
    r.val_label AS rate_label,
    COALESCE(r.val_sort, 0)::integer AS rate_sort_order,
    r.times_applied,
    r.gratuity_collected,
    r.gratuity_collected AS gross_gratuity,
    r.refund_amount,
    (r.gratuity_collected - r.refund_amount)::numeric AS net_gratuity,
    s.net_total AS summary_total_net_gratuity,
    r.has_backfill_estimate
  FROM rolled r
  CROSS JOIN summary s
  LEFT JOIN public.catalog_gratuities cg ON cg.id = r.disc_id
  WHERE r.times_applied > 0
     OR r.gratuity_collected > 0
     OR r.refund_amount > 0
  ORDER BY COALESCE(cg.sort_order, 9999), r.gratuity_collected DESC, r.val_label ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_gratuity_sales_report(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_gratuity_sales_by_rate(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
