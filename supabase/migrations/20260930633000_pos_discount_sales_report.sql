-- Discount Sales report: persist line-level discount applications + aggregate RPCs

CREATE TABLE IF NOT EXISTS public.sales_activity_line_discounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sales_activity_id uuid NOT NULL REFERENCES public.sales_activities (id) ON DELETE CASCADE,
  sales_activity_item_id uuid NULL REFERENCES public.sales_activity_items (id) ON DELETE SET NULL,
  catalog_discount_id uuid NULL REFERENCES public.catalog_discounts (id) ON DELETE SET NULL,
  discount_name text NOT NULL,
  amount_rp numeric NOT NULL DEFAULT 0,
  line_quantity numeric NOT NULL DEFAULT 0,
  input_configuration text NULL,
  amount_unit text NULL,
  amount_value numeric NULL,
  value_label text NOT NULL DEFAULT '—',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_activity_line_discounts_pkey PRIMARY KEY (id),
  CONSTRAINT sales_activity_line_discounts_amount_rp_check CHECK (amount_rp >= 0),
  CONSTRAINT sales_activity_line_discounts_line_quantity_check CHECK (line_quantity >= 0),
  CONSTRAINT sales_activity_line_discounts_discount_name_check CHECK (btrim(discount_name) <> ''),
  CONSTRAINT sales_activity_line_discounts_value_label_check CHECK (btrim(value_label) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_activity_line_discounts_item_discount
  ON public.sales_activity_line_discounts (sales_activity_item_id, catalog_discount_id)
  WHERE sales_activity_item_id IS NOT NULL AND catalog_discount_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sald_org_activity
  ON public.sales_activity_line_discounts (organization_id, sales_activity_id);

CREATE INDEX IF NOT EXISTS idx_sald_org_discount
  ON public.sales_activity_line_discounts (organization_id, catalog_discount_id);

CREATE INDEX IF NOT EXISTS idx_sald_item
  ON public.sales_activity_line_discounts (sales_activity_item_id)
  WHERE sales_activity_item_id IS NOT NULL;

ALTER TABLE public.sales_activity_line_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_activity_line_discounts_org_select" ON public.sales_activity_line_discounts;
CREATE POLICY "sales_activity_line_discounts_org_select"
  ON public.sales_activity_line_discounts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_line_discounts_org_insert" ON public.sales_activity_line_discounts;
CREATE POLICY "sales_activity_line_discounts_org_insert"
  ON public.sales_activity_line_discounts FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_line_discounts_org_update" ON public.sales_activity_line_discounts;
CREATE POLICY "sales_activity_line_discounts_org_update"
  ON public.sales_activity_line_discounts FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_line_discounts_org_delete" ON public.sales_activity_line_discounts;
CREATE POLICY "sales_activity_line_discounts_org_delete"
  ON public.sales_activity_line_discounts FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.sales_activity_line_discounts IS
  'Line-level discount applications per paid checkout for Discount Sales reporting.';

-- Backfill from pos_table_sessions.cart_snapshot (idempotent: skip activities already populated)
INSERT INTO public.sales_activity_line_discounts (
  organization_id,
  sales_activity_id,
  sales_activity_item_id,
  catalog_discount_id,
  discount_name,
  amount_rp,
  line_quantity,
  input_configuration,
  amount_unit,
  amount_value,
  value_label
)
SELECT
  sa.organization_id,
  sa.id AS sales_activity_id,
  NULL::uuid AS sales_activity_item_id,
  cd.id AS catalog_discount_id,
  COALESCE(
    NULLIF(btrim(line.elem -> 'lineDiscount' ->> 'name'), ''),
    NULLIF(btrim(cd.name), ''),
    'Unknown'
  ) AS discount_name,
  GREATEST(COALESCE((line.elem -> 'lineDiscount' ->> 'amountRp')::numeric, 0), 0)::numeric AS amount_rp,
  GREATEST(COALESCE((line.elem ->> 'quantity')::numeric, 0), 0)::numeric AS line_quantity,
  cd.input_configuration,
  cd.amount_unit,
  cd.amount_value,
  CASE
    WHEN cd.input_configuration = 'customizable' THEN
      'Custom · Rp ' || to_char(
        GREATEST(COALESCE((line.elem -> 'lineDiscount' ->> 'amountRp')::numeric, 0), 0),
        'FM999,999,999'
      )
    WHEN cd.amount_unit = 'percent' AND cd.amount_value IS NOT NULL THEN
      trim(to_char(cd.amount_value, 'FM999,999,990.##')) || '%'
    WHEN cd.amount_unit = 'rp' AND cd.amount_value IS NOT NULL THEN
      'Rp ' || to_char(cd.amount_value, 'FM999,999,999')
    WHEN GREATEST(COALESCE((line.elem -> 'lineDiscount' ->> 'amountRp')::numeric, 0), 0) > 0 THEN
      'Custom · Rp ' || to_char(
        GREATEST(COALESCE((line.elem -> 'lineDiscount' ->> 'amountRp')::numeric, 0), 0),
        'FM999,999,999'
      )
    ELSE '—'
  END AS value_label
FROM public.pos_table_sessions pts
JOIN public.sales_activities sa ON sa.id = pts.sales_activity_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pts.cart_snapshot, '[]'::jsonb)) AS line(elem)
LEFT JOIN public.catalog_discounts cd
  ON cd.id = NULLIF(btrim(line.elem -> 'lineDiscount' ->> 'id'), '')::uuid
WHERE pts.sales_activity_id IS NOT NULL
  AND line.elem -> 'lineDiscount' IS NOT NULL
  AND btrim(COALESCE(line.elem -> 'lineDiscount' ->> 'name', '')) <> ''
  AND GREATEST(COALESCE((line.elem -> 'lineDiscount' ->> 'amountRp')::numeric, 0), 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.sales_activity_line_discounts existing
    WHERE existing.sales_activity_id = sa.id
  );

-- Discount Sales by discount (parent rows)

CREATE OR REPLACE FUNCTION public.pos_discount_sales_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  catalog_discount_id uuid,
  discount_name text,
  sort_order integer,
  times_applied numeric,
  gross_discount numeric,
  refund_amount numeric,
  net_discount numeric,
  summary_total_net_discount numeric
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
  WITH activity_discount_total AS (
    SELECT
      sld.sales_activity_id,
      COALESCE(SUM(COALESCE(sld.amount_rp, 0)), 0)::numeric AS discount_total
    FROM public.sales_activity_line_discounts sld
    GROUP BY sld.sales_activity_id
  ),
  sold AS (
    SELECT
      sld.catalog_discount_id AS disc_id,
      sld.discount_name AS disc_name,
      COUNT(*)::numeric AS times_applied,
      COALESCE(SUM(COALESCE(sld.amount_rp, 0)), 0)::numeric AS gross_discount
    FROM public.sales_activity_line_discounts sld
    JOIN public.sales_activities sa ON sa.id = sld.sales_activity_id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
    GROUP BY sld.catalog_discount_id, sld.discount_name
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
      sld.catalog_discount_id AS disc_id,
      sld.discount_name AS disc_name,
      CASE
        WHEN adt.discount_total > 0 THEN
          COALESCE(sld.amount_rp, 0) / adt.discount_total * ran.refund_total
        ELSE 0::numeric
      END AS refund_line_amount
    FROM refund_activity_net ran
    JOIN public.sales_activity_line_discounts sld ON sld.sales_activity_id = ran.activity_id
    JOIN activity_discount_total adt ON adt.sales_activity_id = ran.activity_id
  ),
  refund_grouped AS (
    SELECT
      rl.disc_id,
      rl.disc_name,
      COALESCE(SUM(COALESCE(rl.refund_line_amount, 0)), 0)::numeric AS refund_amount
    FROM refund_lines rl
    GROUP BY rl.disc_id, rl.disc_name
  ),
  merged AS (
    SELECT
      s.disc_id,
      s.disc_name,
      COALESCE(s.times_applied, 0)::numeric AS times_applied,
      COALESCE(s.gross_discount, 0)::numeric AS gross_discount,
      COALESCE(rg.refund_amount, 0)::numeric AS refund_amount
    FROM sold s
    LEFT JOIN refund_grouped rg
      ON rg.disc_id IS NOT DISTINCT FROM s.disc_id
     AND rg.disc_name = s.disc_name
    UNION ALL
    SELECT
      rg.disc_id,
      rg.disc_name,
      0::numeric AS times_applied,
      0::numeric AS gross_discount,
      rg.refund_amount
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
      COALESCE(SUM(m.gross_discount), 0)::numeric AS gross_discount,
      COALESCE(SUM(m.refund_amount), 0)::numeric AS refund_amount
    FROM merged m
    GROUP BY m.disc_id, m.disc_name
  ),
  summary AS (
    SELECT
      COALESCE(SUM(r.gross_discount - r.refund_amount), 0)::numeric AS net_total
    FROM rolled r
  )
  SELECT
    r.disc_id AS catalog_discount_id,
    r.disc_name AS discount_name,
    COALESCE(cd.sort_order, 9999)::integer AS sort_order,
    r.times_applied,
    r.gross_discount,
    r.refund_amount,
    (r.gross_discount - r.refund_amount)::numeric AS net_discount,
    s.net_total AS summary_total_net_discount
  FROM rolled r
  CROSS JOIN summary s
  LEFT JOIN public.catalog_discounts cd ON cd.id = r.disc_id
  WHERE r.times_applied > 0
     OR r.gross_discount > 0
     OR r.refund_amount > 0
  ORDER BY r.gross_discount DESC, r.disc_name ASC;
END;
$$;

-- Discount Sales by value label (child rows for collapse)

CREATE OR REPLACE FUNCTION public.pos_discount_sales_by_value(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  catalog_discount_id uuid,
  discount_name text,
  discount_sort_order integer,
  value_label text,
  value_sort_order integer,
  times_applied numeric,
  gross_discount numeric,
  refund_amount numeric,
  net_discount numeric,
  summary_total_net_discount numeric
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
  WITH activity_discount_total AS (
    SELECT
      sld.sales_activity_id,
      COALESCE(SUM(COALESCE(sld.amount_rp, 0)), 0)::numeric AS discount_total
    FROM public.sales_activity_line_discounts sld
    GROUP BY sld.sales_activity_id
  ),
  sold AS (
    SELECT
      sld.catalog_discount_id AS disc_id,
      sld.discount_name AS disc_name,
      sld.value_label AS val_label,
      COALESCE(sld.amount_value, sld.amount_rp, 0)::numeric AS val_sort,
      COUNT(*)::numeric AS times_applied,
      COALESCE(SUM(COALESCE(sld.amount_rp, 0)), 0)::numeric AS gross_discount
    FROM public.sales_activity_line_discounts sld
    JOIN public.sales_activities sa ON sa.id = sld.sales_activity_id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
    GROUP BY sld.catalog_discount_id, sld.discount_name, sld.value_label, sld.amount_value, sld.amount_rp
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
      sld.catalog_discount_id AS disc_id,
      sld.discount_name AS disc_name,
      sld.value_label AS val_label,
      COALESCE(sld.amount_value, sld.amount_rp, 0)::numeric AS val_sort,
      CASE
        WHEN adt.discount_total > 0 THEN
          COALESCE(sld.amount_rp, 0) / adt.discount_total * ran.refund_total
        ELSE 0::numeric
      END AS refund_line_amount
    FROM refund_activity_net ran
    JOIN public.sales_activity_line_discounts sld ON sld.sales_activity_id = ran.activity_id
    JOIN activity_discount_total adt ON adt.sales_activity_id = ran.activity_id
  ),
  refund_grouped AS (
    SELECT
      rl.disc_id,
      rl.disc_name,
      rl.val_label,
      rl.val_sort,
      COALESCE(SUM(COALESCE(rl.refund_line_amount, 0)), 0)::numeric AS refund_amount
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
      COALESCE(s.gross_discount, 0)::numeric AS gross_discount,
      COALESCE(rg.refund_amount, 0)::numeric AS refund_amount
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
      0::numeric AS gross_discount,
      rg.refund_amount
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
      COALESCE(SUM(m.gross_discount), 0)::numeric AS gross_discount,
      COALESCE(SUM(m.refund_amount), 0)::numeric AS refund_amount
    FROM merged m
    GROUP BY m.disc_id, m.disc_name, m.val_label, m.val_sort
  ),
  summary AS (
    SELECT
      COALESCE(SUM(r.gross_discount - r.refund_amount), 0)::numeric AS net_total
    FROM rolled r
  )
  SELECT
    r.disc_id AS catalog_discount_id,
    r.disc_name AS discount_name,
    COALESCE(cd.sort_order, 9999)::integer AS discount_sort_order,
    r.val_label AS value_label,
    COALESCE(r.val_sort, 0)::integer AS value_sort_order,
    r.times_applied,
    r.gross_discount,
    r.refund_amount,
    (r.gross_discount - r.refund_amount)::numeric AS net_discount,
    s.net_total AS summary_total_net_discount
  FROM rolled r
  CROSS JOIN summary s
  LEFT JOIN public.catalog_discounts cd ON cd.id = r.disc_id
  WHERE r.times_applied > 0
     OR r.gross_discount > 0
     OR r.refund_amount > 0
  ORDER BY COALESCE(cd.sort_order, 9999), r.gross_discount DESC, r.val_label ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_discount_sales_report(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_discount_sales_by_value(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
