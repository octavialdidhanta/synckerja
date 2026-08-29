-- Gross profit: persist line COGS snapshot columns + report RPC

ALTER TABLE public.sales_activity_items
  ADD COLUMN IF NOT EXISTS catalog_product_id uuid,
  ADD COLUMN IF NOT EXISTS catalog_variant_id uuid,
  ADD COLUMN IF NOT EXISTS unit_cogs numeric,
  ADD COLUMN IF NOT EXISTS cogs_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_activity_items_catalog_product_id_fkey'
  ) THEN
    ALTER TABLE public.sales_activity_items
      ADD CONSTRAINT sales_activity_items_catalog_product_id_fkey
      FOREIGN KEY (catalog_product_id)
      REFERENCES public.default_prices (id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'catalog_product_variants'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_activity_items_catalog_variant_id_fkey'
  ) THEN
    ALTER TABLE public.sales_activity_items
      ADD CONSTRAINT sales_activity_items_catalog_variant_id_fkey
      FOREIGN KEY (catalog_variant_id)
      REFERENCES public.catalog_product_variants (id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_activity_items_cogs_source_check'
  ) THEN
    ALTER TABLE public.sales_activity_items
      ADD CONSTRAINT sales_activity_items_cogs_source_check
      CHECK (
        cogs_source IS NULL
        OR cogs_source = ANY (
          ARRAY['finished_goods'::text, 'recipe_bom'::text, 'estimated'::text, 'none'::text]
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_activity_items_cogs_snapshot
  ON public.sales_activity_items (sales_activity_id)
  WHERE unit_cogs IS NOT NULL;

COMMENT ON COLUMN public.sales_activity_items.unit_cogs IS
  'HPP per unit at sale time (snapshot). Null = legacy / unknown.';
COMMENT ON COLUMN public.sales_activity_items.cogs_source IS
  'finished_goods | recipe_bom | estimated | none';

-- Estimate current unit COGS for a catalog product at an outlet (logic C).
CREATE OR REPLACE FUNCTION public.pos_estimate_line_unit_cogs(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_product_id uuid,
  p_variant_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost numeric := NULL;
  v_track boolean := false;
  v_bom numeric := 0;
  v_has_bom boolean := false;
BEGIN
  IF p_organization_id IS NULL OR p_outlet_id IS NULL OR p_product_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Prefer variant finished-goods avg_cost when tracked
  IF p_variant_id IS NOT NULL THEN
    SELECT COALESCE(vo.track_cogs, false), COALESCE(vo.avg_cost, 0)
    INTO v_track, v_cost
    FROM public.catalog_product_variant_outlets vo
    WHERE vo.organization_id = p_organization_id
      AND vo.outlet_id = p_outlet_id
      AND vo.variant_id = p_variant_id
    LIMIT 1;

    IF v_track AND v_cost IS NOT NULL THEN
      RETURN ROUND(v_cost::numeric, 2);
    END IF;
  END IF;

  -- Product finished-goods avg_cost when tracked
  SELECT COALESCE(po.track_cogs, false), COALESCE(po.avg_cost, 0)
  INTO v_track, v_cost
  FROM public.catalog_product_outlets po
  WHERE po.organization_id = p_organization_id
    AND po.outlet_id = p_outlet_id
    AND po.product_id = p_product_id
  LIMIT 1;

  IF v_track AND v_cost IS NOT NULL THEN
    RETURN ROUND(v_cost::numeric, 2);
  END IF;

  -- Fallback: base product recipe BOM (modifier_option_id IS NULL)
  SELECT
    COALESCE(SUM(
      CASE
        WHEN COALESCE(io.track_cogs, false) THEN COALESCE(rl.quantity, 0) * COALESCE(io.avg_cost, 0)
        ELSE 0
      END
    ), 0),
    EXISTS (
      SELECT 1
      FROM public.catalog_product_recipes r2
      JOIN public.catalog_product_recipe_lines rl2 ON rl2.recipe_id = r2.id
      WHERE r2.organization_id = p_organization_id
        AND r2.product_id = p_product_id
        AND r2.modifier_option_id IS NULL
    )
  INTO v_bom, v_has_bom
  FROM public.catalog_product_recipes r
  JOIN public.catalog_product_recipe_lines rl ON rl.recipe_id = r.id
  LEFT JOIN public.catalog_ingredient_outlets io
    ON io.ingredient_id = rl.ingredient_id
   AND io.outlet_id = p_outlet_id
   AND io.organization_id = p_organization_id
  WHERE r.organization_id = p_organization_id
    AND r.product_id = p_product_id
    AND r.modifier_option_id IS NULL;

  IF v_has_bom AND v_bom > 0 THEN
    RETURN ROUND(v_bom::numeric, 2);
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_estimate_line_unit_cogs(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_estimate_line_unit_cogs(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_estimate_line_unit_cogs(uuid, uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.pos_gross_profit_report(
  p_organization_id uuid,
  p_outlet_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  gross_sales numeric,
  discounts numeric,
  refunds numeric,
  net_sales numeric,
  gratuity numeric,
  tax numeric,
  cogs numeric,
  gross_profit numeric,
  gross_profit_margin numeric,
  cogs_incomplete boolean,
  transaction_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net numeric := 0;
  v_discounts numeric := 0;
  v_gratuity numeric := 0;
  v_tax numeric := 0;
  v_count bigint := 0;
  v_refunds numeric := 0;
  v_cogs numeric := 0;
  v_incomplete boolean := false;
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

  SELECT
    COALESCE(SUM(COALESCE(sa.checkout_subtotal, 0)), 0),
    COALESCE(SUM(COALESCE(sa.checkout_discount_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sa.checkout_gratuity_amount, 0)), 0),
    COALESCE(SUM(COALESCE(sa.checkout_tax_amount, 0)), 0),
    COUNT(*)::bigint
  INTO v_net, v_discounts, v_gratuity, v_tax, v_count
  FROM public.sales_activities sa
  WHERE sa.organization_id = p_organization_id
    AND sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
    AND (p_from IS NULL OR sa.created_at >= p_from)
    AND (p_to IS NULL OR sa.created_at < p_to);

  SELECT COALESCE(SUM(COALESCE(sa.refund_amount, 0)), 0)
  INTO v_refunds
  FROM public.sales_activities sa
  WHERE sa.organization_id = p_organization_id
    AND sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'full'
    AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
    AND sa.refunded_at IS NOT NULL
    AND (p_from IS NULL OR sa.refunded_at >= p_from)
    AND (p_to IS NULL OR sa.refunded_at < p_to);

  WITH sold AS (
    SELECT
      sa.pos_outlet_id AS outlet_id,
      sai.quantity,
      sai.catalog_product_id,
      sai.catalog_variant_id,
      sai.unit_cogs
    FROM public.sales_activities sa
    JOIN public.sales_activity_items sai ON sai.sales_activity_id = sa.id
    WHERE sa.organization_id = p_organization_id
      AND sa.activity_type = 'Store Checkout'
      AND sa.status = 'Converted'
      AND COALESCE(sa.refund_status, 'none') = 'none'
      AND (p_outlet_id IS NULL OR sa.pos_outlet_id = p_outlet_id)
      AND (p_from IS NULL OR sa.created_at >= p_from)
      AND (p_to IS NULL OR sa.created_at < p_to)
      AND sai.item_kind = 'product'
  ),
  priced AS (
    SELECT
      s.quantity,
      CASE
        WHEN s.unit_cogs IS NOT NULL THEN s.unit_cogs
        WHEN s.catalog_product_id IS NOT NULL AND s.outlet_id IS NOT NULL THEN
          public.pos_estimate_line_unit_cogs(
            p_organization_id,
            s.outlet_id,
            s.catalog_product_id,
            s.catalog_variant_id
          )
        ELSE NULL
      END AS resolved_unit_cogs
    FROM sold s
  )
  SELECT
    COALESCE(SUM(COALESCE(p.resolved_unit_cogs, 0) * COALESCE(p.quantity, 0)), 0),
    COALESCE(BOOL_OR(p.resolved_unit_cogs IS NULL), false)
  INTO v_cogs, v_incomplete
  FROM priced p;

  RETURN QUERY
  SELECT
    (v_net + v_discounts)::numeric AS gross_sales,
    v_discounts::numeric AS discounts,
    v_refunds::numeric AS refunds,
    v_net::numeric AS net_sales,
    v_gratuity::numeric AS gratuity,
    v_tax::numeric AS tax,
    v_cogs::numeric AS cogs,
    (v_net - v_cogs)::numeric AS gross_profit,
    CASE
      WHEN v_net > 0 THEN ROUND(((v_net - v_cogs) / v_net) * 100, 2)
      ELSE 0::numeric
    END AS gross_profit_margin,
    COALESCE(v_incomplete, false) AS cogs_incomplete,
    v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_gross_profit_report(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_gross_profit_report(uuid, uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_gross_profit_report(uuid, uuid, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.pos_gross_profit_report(uuid, uuid, timestamptz, timestamptz) IS
  'Sales summary metrics + COGS / gross profit for Store Checkout Converted in window.';
