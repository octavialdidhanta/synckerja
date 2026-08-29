-- Tax Sales Moka accuracy: persist DPP (taxable base) + RPC taxable_amount / tax_collected

ALTER TABLE public.sales_activity_checkout_taxes
  ADD COLUMN IF NOT EXISTS taxable_base_rp numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_backfill_estimate boolean NOT NULL DEFAULT false;

ALTER TABLE public.sales_activity_checkout_taxes
  DROP CONSTRAINT IF EXISTS sales_activity_checkout_taxes_taxable_base_rp_check;

ALTER TABLE public.sales_activity_checkout_taxes
  ADD CONSTRAINT sales_activity_checkout_taxes_taxable_base_rp_check
  CHECK (taxable_base_rp >= 0);

-- Backfill DPP from stored tax + rate (estimate for historical rows)
UPDATE public.sales_activity_checkout_taxes sact
SET
  taxable_base_rp = CASE
    WHEN sact.amount_percent > 0 THEN
      ROUND(sact.amount_rp / (sact.amount_percent / 100))::numeric
    ELSE 0::numeric
  END,
  is_backfill_estimate = true
WHERE sact.taxable_base_rp = 0
  AND sact.amount_rp > 0;

DROP FUNCTION IF EXISTS public.pos_tax_sales_report(uuid, uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.pos_tax_sales_by_rate(uuid, uuid, timestamptz, timestamptz);

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
  taxable_amount numeric,
  tax_collected numeric,
  gross_tax numeric,
  refund_amount numeric,
  refund_taxable_amount numeric,
  net_tax numeric,
  net_taxable_amount numeric,
  summary_total_net_tax numeric,
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
  WITH activity_tax_total AS (
    SELECT
      sact.sales_activity_id,
      COALESCE(SUM(COALESCE(sact.amount_rp, 0)), 0)::numeric AS tax_total,
      COALESCE(MAX(COALESCE(sact.taxable_base_rp, 0)), 0)::numeric AS activity_taxable_base
    FROM public.sales_activity_checkout_taxes sact
    GROUP BY sact.sales_activity_id
  ),
  sold AS (
    SELECT
      sact.catalog_tax_id AS disc_id,
      sact.tax_name AS disc_name,
      COUNT(*)::numeric AS times_applied,
      COALESCE(SUM(COALESCE(sact.taxable_base_rp, 0)), 0)::numeric AS taxable_amount,
      COALESCE(SUM(COALESCE(sact.amount_rp, 0)), 0)::numeric AS tax_collected,
      BOOL_OR(sact.is_backfill_estimate) AS has_backfill_estimate
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
      sact.catalog_tax_id AS disc_id,
      sact.tax_name AS disc_name,
      CASE
        WHEN adt.tax_total > 0 THEN
          COALESCE(sact.amount_rp, 0) / adt.tax_total * ran.refund_total
        ELSE 0::numeric
      END AS refund_collected,
      CASE
        WHEN adt.tax_total > 0 THEN
          adt.activity_taxable_base * COALESCE(sact.amount_rp, 0) / adt.tax_total
        ELSE 0::numeric
      END AS refund_taxable
    FROM refund_activity_net ran
    JOIN public.sales_activity_checkout_taxes sact ON sact.sales_activity_id = ran.activity_id
    JOIN activity_tax_total adt ON adt.sales_activity_id = ran.activity_id
  ),
  refund_grouped AS (
    SELECT
      rl.disc_id,
      rl.disc_name,
      COALESCE(SUM(COALESCE(rl.refund_collected, 0)), 0)::numeric AS refund_amount,
      COALESCE(SUM(COALESCE(rl.refund_taxable, 0)), 0)::numeric AS refund_taxable_amount
    FROM refund_lines rl
    GROUP BY rl.disc_id, rl.disc_name
  ),
  merged AS (
    SELECT
      s.disc_id,
      s.disc_name,
      COALESCE(s.times_applied, 0)::numeric AS times_applied,
      COALESCE(s.taxable_amount, 0)::numeric AS taxable_amount,
      COALESCE(s.tax_collected, 0)::numeric AS tax_collected,
      COALESCE(rg.refund_amount, 0)::numeric AS refund_amount,
      COALESCE(rg.refund_taxable_amount, 0)::numeric AS refund_taxable_amount,
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
      0::numeric AS taxable_amount,
      0::numeric AS tax_collected,
      rg.refund_amount,
      rg.refund_taxable_amount,
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
      COALESCE(SUM(m.taxable_amount), 0)::numeric AS taxable_amount,
      COALESCE(SUM(m.tax_collected), 0)::numeric AS tax_collected,
      COALESCE(SUM(m.refund_amount), 0)::numeric AS refund_amount,
      COALESCE(SUM(m.refund_taxable_amount), 0)::numeric AS refund_taxable_amount,
      BOOL_OR(m.has_backfill_estimate) AS has_backfill_estimate
    FROM merged m
    GROUP BY m.disc_id, m.disc_name
  ),
  summary AS (
    SELECT
      COALESCE(SUM(r.tax_collected - r.refund_amount), 0)::numeric AS net_total
    FROM rolled r
  )
  SELECT
    r.disc_id AS catalog_tax_id,
    r.disc_name AS tax_name,
    COALESCE(ct.sort_order, 9999)::integer AS sort_order,
    r.times_applied,
    r.taxable_amount,
    r.tax_collected,
    r.tax_collected AS gross_tax,
    r.refund_amount,
    r.refund_taxable_amount,
    (r.tax_collected - r.refund_amount)::numeric AS net_tax,
    (r.taxable_amount - r.refund_taxable_amount)::numeric AS net_taxable_amount,
    s.net_total AS summary_total_net_tax,
    r.has_backfill_estimate
  FROM rolled r
  CROSS JOIN summary s
  LEFT JOIN public.catalog_taxes ct ON ct.id = r.disc_id
  WHERE r.times_applied > 0
     OR r.tax_collected > 0
     OR r.refund_amount > 0
  ORDER BY r.tax_collected DESC, r.disc_name ASC;
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
  taxable_amount numeric,
  tax_collected numeric,
  gross_tax numeric,
  refund_amount numeric,
  refund_taxable_amount numeric,
  net_tax numeric,
  net_taxable_amount numeric,
  summary_total_net_tax numeric,
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
  WITH activity_tax_total AS (
    SELECT
      sact.sales_activity_id,
      COALESCE(SUM(COALESCE(sact.amount_rp, 0)), 0)::numeric AS tax_total,
      COALESCE(MAX(COALESCE(sact.taxable_base_rp, 0)), 0)::numeric AS activity_taxable_base
    FROM public.sales_activity_checkout_taxes sact
    GROUP BY sact.sales_activity_id
  ),
  sold AS (
    SELECT
      sact.catalog_tax_id AS disc_id,
      sact.tax_name AS disc_name,
      sact.rate_label AS val_label,
      COALESCE(sact.amount_percent, 0)::numeric AS val_sort,
      COUNT(*)::numeric AS times_applied,
      COALESCE(SUM(COALESCE(sact.taxable_base_rp, 0)), 0)::numeric AS taxable_amount,
      COALESCE(SUM(COALESCE(sact.amount_rp, 0)), 0)::numeric AS tax_collected,
      BOOL_OR(sact.is_backfill_estimate) AS has_backfill_estimate
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
      sact.catalog_tax_id AS disc_id,
      sact.tax_name AS disc_name,
      sact.rate_label AS val_label,
      COALESCE(sact.amount_percent, 0)::numeric AS val_sort,
      CASE
        WHEN adt.tax_total > 0 THEN
          COALESCE(sact.amount_rp, 0) / adt.tax_total * ran.refund_total
        ELSE 0::numeric
      END AS refund_collected,
      CASE
        WHEN adt.tax_total > 0 THEN
          adt.activity_taxable_base * COALESCE(sact.amount_rp, 0) / adt.tax_total
        ELSE 0::numeric
      END AS refund_taxable
    FROM refund_activity_net ran
    JOIN public.sales_activity_checkout_taxes sact ON sact.sales_activity_id = ran.activity_id
    JOIN activity_tax_total adt ON adt.sales_activity_id = ran.activity_id
  ),
  refund_grouped AS (
    SELECT
      rl.disc_id,
      rl.disc_name,
      rl.val_label,
      rl.val_sort,
      COALESCE(SUM(COALESCE(rl.refund_collected, 0)), 0)::numeric AS refund_amount,
      COALESCE(SUM(COALESCE(rl.refund_taxable, 0)), 0)::numeric AS refund_taxable_amount
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
      COALESCE(s.taxable_amount, 0)::numeric AS taxable_amount,
      COALESCE(s.tax_collected, 0)::numeric AS tax_collected,
      COALESCE(rg.refund_amount, 0)::numeric AS refund_amount,
      COALESCE(rg.refund_taxable_amount, 0)::numeric AS refund_taxable_amount,
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
      0::numeric AS taxable_amount,
      0::numeric AS tax_collected,
      rg.refund_amount,
      rg.refund_taxable_amount,
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
      COALESCE(SUM(m.taxable_amount), 0)::numeric AS taxable_amount,
      COALESCE(SUM(m.tax_collected), 0)::numeric AS tax_collected,
      COALESCE(SUM(m.refund_amount), 0)::numeric AS refund_amount,
      COALESCE(SUM(m.refund_taxable_amount), 0)::numeric AS refund_taxable_amount,
      BOOL_OR(m.has_backfill_estimate) AS has_backfill_estimate
    FROM merged m
    GROUP BY m.disc_id, m.disc_name, m.val_label, m.val_sort
  ),
  summary AS (
    SELECT
      COALESCE(SUM(r.tax_collected - r.refund_amount), 0)::numeric AS net_total
    FROM rolled r
  )
  SELECT
    r.disc_id AS catalog_tax_id,
    r.disc_name AS tax_name,
    COALESCE(ct.sort_order, 9999)::integer AS tax_sort_order,
    r.val_label AS rate_label,
    COALESCE(r.val_sort, 0)::integer AS rate_sort_order,
    r.times_applied,
    r.taxable_amount,
    r.tax_collected,
    r.tax_collected AS gross_tax,
    r.refund_amount,
    r.refund_taxable_amount,
    (r.tax_collected - r.refund_amount)::numeric AS net_tax,
    (r.taxable_amount - r.refund_taxable_amount)::numeric AS net_taxable_amount,
    s.net_total AS summary_total_net_tax,
    r.has_backfill_estimate
  FROM rolled r
  CROSS JOIN summary s
  LEFT JOIN public.catalog_taxes ct ON ct.id = r.disc_id
  WHERE r.times_applied > 0
     OR r.tax_collected > 0
     OR r.refund_amount > 0
  ORDER BY COALESCE(ct.sort_order, 9999), r.tax_collected DESC, r.val_label ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_tax_sales_report(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_tax_sales_by_rate(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
