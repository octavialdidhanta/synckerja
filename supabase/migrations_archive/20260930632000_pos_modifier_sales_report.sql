-- Modifier Sales report: persist modifier selections per checkout line + aggregate RPCs

CREATE TABLE IF NOT EXISTS public.sales_activity_item_modifiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sales_activity_id uuid NOT NULL REFERENCES public.sales_activities (id) ON DELETE CASCADE,
  sales_activity_item_id uuid NULL REFERENCES public.sales_activity_items (id) ON DELETE SET NULL,
  modifier_group_id uuid NULL REFERENCES public.catalog_modifier_groups (id) ON DELETE SET NULL,
  modifier_option_id uuid NOT NULL,
  group_name text NOT NULL,
  option_name text NOT NULL,
  extra_price numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 0,
  line_quantity numeric NOT NULL DEFAULT 0,
  gross_sales numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_activity_item_modifiers_pkey PRIMARY KEY (id),
  CONSTRAINT sales_activity_item_modifiers_extra_price_check CHECK (extra_price >= 0),
  CONSTRAINT sales_activity_item_modifiers_quantity_check CHECK (quantity >= 0),
  CONSTRAINT sales_activity_item_modifiers_line_quantity_check CHECK (line_quantity >= 0),
  CONSTRAINT sales_activity_item_modifiers_gross_sales_check CHECK (gross_sales >= 0),
  CONSTRAINT sales_activity_item_modifiers_discount_amount_check CHECK (discount_amount >= 0),
  CONSTRAINT sales_activity_item_modifiers_group_name_check CHECK (btrim(group_name) <> ''),
  CONSTRAINT sales_activity_item_modifiers_option_name_check CHECK (btrim(option_name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_activity_item_modifiers_item_option
  ON public.sales_activity_item_modifiers (sales_activity_item_id, modifier_option_id)
  WHERE sales_activity_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saim_org_activity
  ON public.sales_activity_item_modifiers (organization_id, sales_activity_id);

CREATE INDEX IF NOT EXISTS idx_saim_org_group_option
  ON public.sales_activity_item_modifiers (organization_id, modifier_group_id, modifier_option_id);

CREATE INDEX IF NOT EXISTS idx_saim_item
  ON public.sales_activity_item_modifiers (sales_activity_item_id)
  WHERE sales_activity_item_id IS NOT NULL;

ALTER TABLE public.sales_activity_item_modifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_activity_item_modifiers_org_select" ON public.sales_activity_item_modifiers;
CREATE POLICY "sales_activity_item_modifiers_org_select"
  ON public.sales_activity_item_modifiers FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_item_modifiers_org_insert" ON public.sales_activity_item_modifiers;
CREATE POLICY "sales_activity_item_modifiers_org_insert"
  ON public.sales_activity_item_modifiers FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_item_modifiers_org_update" ON public.sales_activity_item_modifiers;
CREATE POLICY "sales_activity_item_modifiers_org_update"
  ON public.sales_activity_item_modifiers FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "sales_activity_item_modifiers_org_delete" ON public.sales_activity_item_modifiers;
CREATE POLICY "sales_activity_item_modifiers_org_delete"
  ON public.sales_activity_item_modifiers FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.sales_activity_item_modifiers IS
  'Structured modifier selections per paid checkout line for Modifier Sales reporting.';

-- Backfill from pos_table_sessions.cart_snapshot (idempotent: skip activities already populated)
INSERT INTO public.sales_activity_item_modifiers (
  organization_id,
  sales_activity_id,
  sales_activity_item_id,
  modifier_group_id,
  modifier_option_id,
  group_name,
  option_name,
  extra_price,
  quantity,
  line_quantity,
  gross_sales,
  discount_amount
)
SELECT
  sa.organization_id,
  sa.id AS sales_activity_id,
  NULL::uuid AS sales_activity_item_id,
  cmo.group_id AS modifier_group_id,
  (mod.elem ->> 'optionId')::uuid AS modifier_option_id,
  COALESCE(NULLIF(btrim(cmg.name), ''), 'Unknown') AS group_name,
  COALESCE(NULLIF(btrim(mod.elem ->> 'name'), ''), 'Unknown') AS option_name,
  GREATEST(COALESCE((mod.elem ->> 'extraPrice')::numeric, 0), 0)::numeric AS extra_price,
  GREATEST(COALESCE((line.elem ->> 'quantity')::numeric, 0), 0)::numeric AS quantity,
  GREATEST(COALESCE((line.elem ->> 'quantity')::numeric, 0), 0)::numeric AS line_quantity,
  (
    GREATEST(COALESCE((mod.elem ->> 'extraPrice')::numeric, 0), 0)
    * GREATEST(COALESCE((line.elem ->> 'quantity')::numeric, 0), 0)
  )::numeric AS gross_sales,
  CASE
    WHEN GREATEST(COALESCE((line.elem ->> 'quantity')::numeric, 0), 0) > 0
      AND GREATEST(COALESCE((line.elem ->> 'unitPrice')::numeric, 0), 0)
        * GREATEST(COALESCE((line.elem ->> 'quantity')::numeric, 0), 0) > 0
    THEN ROUND(
      (
        GREATEST(COALESCE((mod.elem ->> 'extraPrice')::numeric, 0), 0)
        * GREATEST(COALESCE((line.elem ->> 'quantity')::numeric, 0), 0)
      )
      / NULLIF(
        GREATEST(COALESCE((line.elem ->> 'unitPrice')::numeric, 0), 0)
        * GREATEST(COALESCE((line.elem ->> 'quantity')::numeric, 0), 0),
        0
      )
      * GREATEST(COALESCE((line.elem -> 'lineDiscount' ->> 'amountRp')::numeric, 0), 0),
      0
    )::numeric
    ELSE 0::numeric
  END AS discount_amount
FROM public.pos_table_sessions pts
JOIN public.sales_activities sa ON sa.id = pts.sales_activity_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pts.cart_snapshot, '[]'::jsonb)) AS line(elem)
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(line.elem -> 'modifiers', '[]'::jsonb)) AS mod(elem)
LEFT JOIN public.catalog_modifier_options cmo
  ON cmo.id = (mod.elem ->> 'optionId')::uuid
LEFT JOIN public.catalog_modifier_groups cmg
  ON cmg.id = cmo.group_id
WHERE pts.sales_activity_id IS NOT NULL
  AND COALESCE(line.elem ->> 'isCustomAmount', 'false')::boolean IS NOT TRUE
  AND COALESCE(line.elem ->> 'kind', 'product') = 'product'
  AND (mod.elem ->> 'optionId') IS NOT NULL
  AND btrim(mod.elem ->> 'optionId') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.sales_activity_item_modifiers existing
    WHERE existing.sales_activity_id = sa.id
  );

-- Modifier Sales by group

CREATE OR REPLACE FUNCTION public.pos_modifier_sales_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  group_id uuid,
  group_name text,
  sort_order integer,
  qty_sold numeric,
  gross_sales numeric,
  discount_amount numeric,
  refund_amount numeric,
  net_sales numeric,
  summary_modifier_net_sales numeric
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
  WITH activity_gross AS (
    SELECT
      sai.sales_activity_id,
      COALESCE(SUM(COALESCE(sai.total_price, 0)), 0)::numeric AS lines_gross
    FROM public.sales_activity_items sai
    GROUP BY sai.sales_activity_id
  ),
  sold AS (
    SELECT
      saim.modifier_group_id AS grp_id,
      COALESCE(SUM(COALESCE(saim.quantity, 0)), 0)::numeric AS qty_sold,
      COALESCE(SUM(COALESCE(saim.gross_sales, 0)), 0)::numeric AS gross_sales,
      COALESCE(SUM(COALESCE(saim.discount_amount, 0)), 0)::numeric AS discount_amount
    FROM public.sales_activity_item_modifiers saim
    JOIN public.sales_activities sa ON sa.id = saim.sales_activity_id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
    GROUP BY saim.modifier_group_id
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
      saim.modifier_group_id AS grp_id,
      CASE
        WHEN ag.lines_gross > 0 THEN
          COALESCE(saim.gross_sales, 0) / ag.lines_gross * ran.refund_total
        ELSE 0::numeric
      END AS refund_line_amount
    FROM refund_activity_net ran
    JOIN public.sales_activity_item_modifiers saim ON saim.sales_activity_id = ran.activity_id
    JOIN activity_gross ag ON ag.sales_activity_id = ran.activity_id
  ),
  refund_grouped AS (
    SELECT
      rl.grp_id,
      COALESCE(SUM(COALESCE(rl.refund_line_amount, 0)), 0)::numeric AS refund_amount
    FROM refund_lines rl
    GROUP BY rl.grp_id
  ),
  merged AS (
    SELECT
      s.grp_id,
      COALESCE(s.qty_sold, 0)::numeric AS qty_sold,
      COALESCE(s.gross_sales, 0)::numeric AS gross_sales,
      COALESCE(s.discount_amount, 0)::numeric AS discount_amount,
      COALESCE(rg.refund_amount, 0)::numeric AS refund_amount
    FROM sold s
    LEFT JOIN refund_grouped rg ON rg.grp_id IS NOT DISTINCT FROM s.grp_id
    UNION ALL
    SELECT
      rg.grp_id,
      0::numeric AS qty_sold,
      0::numeric AS gross_sales,
      0::numeric AS discount_amount,
      rg.refund_amount
    FROM refund_grouped rg
    WHERE NOT EXISTS (
      SELECT 1 FROM sold s WHERE s.grp_id IS NOT DISTINCT FROM rg.grp_id
    )
  ),
  rolled AS (
    SELECT
      m.grp_id,
      COALESCE(SUM(m.qty_sold), 0)::numeric AS qty_sold,
      COALESCE(SUM(m.gross_sales), 0)::numeric AS gross_sales,
      COALESCE(SUM(m.discount_amount), 0)::numeric AS discount_amount,
      COALESCE(SUM(m.refund_amount), 0)::numeric AS refund_amount
    FROM merged m
    GROUP BY m.grp_id
  ),
  summary AS (
    SELECT
      COALESCE(SUM(r.gross_sales - r.discount_amount - r.refund_amount), 0)::numeric AS net_total
    FROM rolled r
  )
  SELECT
    r.grp_id AS group_id,
    COALESCE(
      NULLIF(btrim(g.name), ''),
      NULLIF(
        btrim(
          (
            SELECT sn.group_name
            FROM public.sales_activity_item_modifiers sn
            WHERE sn.modifier_group_id IS NOT DISTINCT FROM r.grp_id
            ORDER BY sn.created_at DESC
            LIMIT 1
          )
        ),
        ''
      ),
      'Unknown'
    )::text AS group_name,
    COALESCE(g.sort_order, 9999)::integer AS sort_order,
    r.qty_sold,
    r.gross_sales,
    r.discount_amount,
    r.refund_amount,
    (r.gross_sales - r.discount_amount - r.refund_amount)::numeric AS net_sales,
    s.net_total AS summary_modifier_net_sales
  FROM rolled r
  CROSS JOIN summary s
  LEFT JOIN public.catalog_modifier_groups g ON g.id = r.grp_id
  WHERE r.qty_sold > 0
     OR r.gross_sales > 0
     OR r.refund_amount > 0
  ORDER BY r.gross_sales DESC, COALESCE(g.name, 'Unknown') ASC;
END;
$$;

-- Modifier Sales by option (under group)

CREATE OR REPLACE FUNCTION public.pos_modifier_sales_by_option(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  group_id uuid,
  group_name text,
  group_sort_order integer,
  option_id uuid,
  option_name text,
  option_sort_order integer,
  qty_sold numeric,
  gross_sales numeric,
  discount_amount numeric,
  refund_amount numeric,
  net_sales numeric,
  summary_modifier_net_sales numeric
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
  WITH activity_gross AS (
    SELECT
      sai.sales_activity_id,
      COALESCE(SUM(COALESCE(sai.total_price, 0)), 0)::numeric AS lines_gross
    FROM public.sales_activity_items sai
    GROUP BY sai.sales_activity_id
  ),
  sold AS (
    SELECT
      saim.modifier_group_id AS grp_id,
      saim.modifier_option_id AS opt_id,
      COALESCE(SUM(COALESCE(saim.quantity, 0)), 0)::numeric AS qty_sold,
      COALESCE(SUM(COALESCE(saim.gross_sales, 0)), 0)::numeric AS gross_sales,
      COALESCE(SUM(COALESCE(saim.discount_amount, 0)), 0)::numeric AS discount_amount
    FROM public.sales_activity_item_modifiers saim
    JOIN public.sales_activities sa ON sa.id = saim.sales_activity_id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
    GROUP BY saim.modifier_group_id, saim.modifier_option_id
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
      saim.modifier_group_id AS grp_id,
      saim.modifier_option_id AS opt_id,
      CASE
        WHEN ag.lines_gross > 0 THEN
          COALESCE(saim.gross_sales, 0) / ag.lines_gross * ran.refund_total
        ELSE 0::numeric
      END AS refund_line_amount
    FROM refund_activity_net ran
    JOIN public.sales_activity_item_modifiers saim ON saim.sales_activity_id = ran.activity_id
    JOIN activity_gross ag ON ag.sales_activity_id = ran.activity_id
  ),
  refund_grouped AS (
    SELECT
      rl.grp_id,
      rl.opt_id,
      COALESCE(SUM(COALESCE(rl.refund_line_amount, 0)), 0)::numeric AS refund_amount
    FROM refund_lines rl
    GROUP BY rl.grp_id, rl.opt_id
  ),
  merged AS (
    SELECT
      s.grp_id,
      s.opt_id,
      COALESCE(s.qty_sold, 0)::numeric AS qty_sold,
      COALESCE(s.gross_sales, 0)::numeric AS gross_sales,
      COALESCE(s.discount_amount, 0)::numeric AS discount_amount,
      COALESCE(rg.refund_amount, 0)::numeric AS refund_amount
    FROM sold s
    LEFT JOIN refund_grouped rg
      ON rg.grp_id IS NOT DISTINCT FROM s.grp_id
     AND rg.opt_id = s.opt_id
    UNION ALL
    SELECT
      rg.grp_id,
      rg.opt_id,
      0::numeric AS qty_sold,
      0::numeric AS gross_sales,
      0::numeric AS discount_amount,
      rg.refund_amount
    FROM refund_grouped rg
    WHERE NOT EXISTS (
      SELECT 1
      FROM sold s
      WHERE s.grp_id IS NOT DISTINCT FROM rg.grp_id
        AND s.opt_id = rg.opt_id
    )
  ),
  rolled AS (
    SELECT
      m.grp_id,
      m.opt_id,
      COALESCE(SUM(m.qty_sold), 0)::numeric AS qty_sold,
      COALESCE(SUM(m.gross_sales), 0)::numeric AS gross_sales,
      COALESCE(SUM(m.discount_amount), 0)::numeric AS discount_amount,
      COALESCE(SUM(m.refund_amount), 0)::numeric AS refund_amount
    FROM merged m
    GROUP BY m.grp_id, m.opt_id
  ),
  summary AS (
    SELECT
      COALESCE(SUM(r.gross_sales - r.discount_amount - r.refund_amount), 0)::numeric AS net_total
    FROM rolled r
  )
  SELECT
    r.grp_id AS group_id,
    COALESCE(
      NULLIF(btrim(g.name), ''),
      NULLIF(
        btrim(
          (
            SELECT sn.group_name
            FROM public.sales_activity_item_modifiers sn
            WHERE sn.modifier_group_id IS NOT DISTINCT FROM r.grp_id
            ORDER BY sn.created_at DESC
            LIMIT 1
          )
        ),
        ''
      ),
      'Unknown'
    )::text AS group_name,
    COALESCE(g.sort_order, 9999)::integer AS group_sort_order,
    r.opt_id AS option_id,
    COALESCE(
      NULLIF(btrim(o.name), ''),
      NULLIF(
        btrim(
          (
            SELECT sn.option_name
            FROM public.sales_activity_item_modifiers sn
            WHERE sn.modifier_option_id = r.opt_id
            ORDER BY sn.created_at DESC
            LIMIT 1
          )
        ),
        ''
      ),
      'Unknown'
    )::text AS option_name,
    COALESCE(o.sort_order, 9999)::integer AS option_sort_order,
    r.qty_sold,
    r.gross_sales,
    r.discount_amount,
    r.refund_amount,
    (r.gross_sales - r.discount_amount - r.refund_amount)::numeric AS net_sales,
    s.net_total AS summary_modifier_net_sales
  FROM rolled r
  CROSS JOIN summary s
  LEFT JOIN public.catalog_modifier_groups g ON g.id = r.grp_id
  LEFT JOIN public.catalog_modifier_options o ON o.id = r.opt_id
  WHERE r.qty_sold > 0
     OR r.gross_sales > 0
     OR r.refund_amount > 0
  ORDER BY COALESCE(g.sort_order, 9999), r.gross_sales DESC, COALESCE(o.name, 'Unknown') ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_modifier_sales_report(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pos_modifier_sales_by_option(uuid, uuid, timestamptz, timestamptz) TO authenticated, service_role;
