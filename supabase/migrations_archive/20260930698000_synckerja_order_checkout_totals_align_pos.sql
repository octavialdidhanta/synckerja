-- Align guest-order checkout totals with POS cashier (computeCatalogCheckoutTotals):
-- - application_method = add: tax base = subtotal + gratuity
-- - application_method = include: back-calculate from inclusive subtotal
-- - Optional outlet / sales-type filters match BO assignments

DROP FUNCTION IF EXISTS public._synckerja_order_checkout_totals(uuid, numeric);

CREATE OR REPLACE FUNCTION public._synckerja_order_checkout_totals(
  p_org uuid,
  p_subtotal numeric,
  p_outlet_id uuid DEFAULT NULL,
  p_sales_type_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric := GREATEST(0, round(COALESCE(p_subtotal, 0)));
  v_settings public.catalog_checkout_settings%ROWTYPE;
  v_method text := 'add';
  v_tax_enabled boolean := false;
  v_grat_enabled boolean := false;
  v_sales_type_id uuid := p_sales_type_id;
  v_grat_lines jsonb := '[]'::jsonb;
  v_tax_lines jsonb := '[]'::jsonb;
  v_grat numeric := 0;
  v_tax numeric := 0;
  v_tax_base numeric := 0;
  v_grat_pct numeric := 0;
  v_tax_pct numeric := 0;
  v_pre_tax numeric := 0;
  v_grand numeric := 0;
BEGIN
  SELECT * INTO v_settings
  FROM public.catalog_checkout_settings
  WHERE organization_id = p_org;

  v_method := CASE
    WHEN COALESCE(v_settings.application_method, 'add') = 'include' THEN 'include'
    ELSE 'add'
  END;
  v_tax_enabled := COALESCE(v_settings.tax_enabled, false);
  v_grat_enabled := COALESCE(v_settings.gratuity_enabled, false);

  -- Default dine-in sales type when outlet known but sales type omitted (guest preview).
  IF v_sales_type_id IS NULL AND p_outlet_id IS NOT NULL THEN
    SELECT st.id INTO v_sales_type_id
    FROM public.catalog_sales_types st
    JOIN public.catalog_sales_type_outlets sto
      ON sto.sales_type_id = st.id AND sto.outlet_id = p_outlet_id
    WHERE st.organization_id = p_org
      AND st.is_active
      AND lower(st.name) LIKE '%dine%'
    ORDER BY st.sort_order
    LIMIT 1;
  END IF;

  IF v_grat_enabled THEN
    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'name', g.name,
          'amount', 0,
          'amount_percent', g.amount_percent
        )
        ORDER BY g.sort_order, g.name
      ), '[]'::jsonb),
      COALESCE(SUM(g.amount_percent), 0)
    INTO v_grat_lines, v_grat_pct
    FROM public.catalog_gratuities g
    WHERE g.organization_id = p_org
      AND g.is_active = true
      AND g.amount_percent > 0
      AND (
        p_outlet_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.catalog_gratuity_outlets go
          WHERE go.gratuity_id = g.id AND go.outlet_id = p_outlet_id
        )
      )
      AND (
        v_sales_type_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.catalog_sales_type_gratuities gst
          WHERE gst.gratuity_id = g.id AND gst.sales_type_id = v_sales_type_id
        )
      );
  END IF;

  IF v_tax_enabled THEN
    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'name', t.name,
          'amount', 0,
          'amount_percent', t.amount_percent
        )
        ORDER BY t.sort_order, t.name
      ), '[]'::jsonb),
      COALESCE(SUM(t.amount_percent), 0)
    INTO v_tax_lines, v_tax_pct
    FROM public.catalog_taxes t
    WHERE t.organization_id = p_org
      AND t.is_active = true
      AND t.amount_percent > 0
      AND (
        p_outlet_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.catalog_tax_outlets txo
          WHERE txo.tax_id = t.id AND txo.outlet_id = p_outlet_id
        )
      );
  END IF;

  v_grat_lines := COALESCE(v_grat_lines, '[]'::jsonb);
  v_tax_lines := COALESCE(v_tax_lines, '[]'::jsonb);
  v_grat_pct := COALESCE(v_grat_pct, 0);
  v_tax_pct := COALESCE(v_tax_pct, 0);

  IF v_method = 'include' THEN
    IF (v_grat_pct + v_tax_pct) > 0 AND v_subtotal > 0 THEN
      v_pre_tax := round(v_subtotal / (1 + (v_grat_pct + v_tax_pct) / 100.0));
    ELSE
      v_pre_tax := v_subtotal;
    END IF;

    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'name', line ->> 'name',
          'amount', round(v_pre_tax * (line ->> 'amount_percent')::numeric / 100.0),
          'amount_percent', (line ->> 'amount_percent')::numeric
        )
      ), '[]'::jsonb),
      COALESCE(SUM(round(v_pre_tax * (line ->> 'amount_percent')::numeric / 100.0)), 0)
    INTO v_grat_lines, v_grat
    FROM jsonb_array_elements(v_grat_lines) AS line;

    v_tax_base := v_pre_tax + v_grat;

    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'name', line ->> 'name',
          'amount', round(v_tax_base * (line ->> 'amount_percent')::numeric / 100.0),
          'amount_percent', (line ->> 'amount_percent')::numeric
        )
      ), '[]'::jsonb),
      COALESCE(SUM(round(v_tax_base * (line ->> 'amount_percent')::numeric / 100.0)), 0)
    INTO v_tax_lines, v_tax
    FROM jsonb_array_elements(v_tax_lines) AS line;

    v_grand := v_subtotal;
  ELSE
    -- add: service/gratuity on subtotal, tax on (subtotal + gratuity) — same as POS cashier
    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'name', line ->> 'name',
          'amount', round(v_subtotal * (line ->> 'amount_percent')::numeric / 100.0),
          'amount_percent', (line ->> 'amount_percent')::numeric
        )
      ), '[]'::jsonb),
      COALESCE(SUM(round(v_subtotal * (line ->> 'amount_percent')::numeric / 100.0)), 0)
    INTO v_grat_lines, v_grat
    FROM jsonb_array_elements(v_grat_lines) AS line;

    v_tax_base := v_subtotal + v_grat;

    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'name', line ->> 'name',
          'amount', round(v_tax_base * (line ->> 'amount_percent')::numeric / 100.0),
          'amount_percent', (line ->> 'amount_percent')::numeric
        )
      ), '[]'::jsonb),
      COALESCE(SUM(round(v_tax_base * (line ->> 'amount_percent')::numeric / 100.0)), 0)
    INTO v_tax_lines, v_tax
    FROM jsonb_array_elements(v_tax_lines) AS line;

    v_grand := v_subtotal + v_grat + v_tax;
  END IF;

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'taxBase', v_tax_base,
    'taxLines', COALESCE(v_tax_lines, '[]'::jsonb),
    'gratuityLines', COALESCE(v_grat_lines, '[]'::jsonb),
    'taxTotal', COALESCE(v_tax, 0),
    'gratuityTotal', COALESCE(v_grat, 0),
    'grandTotal', v_grand,
    'applicationMethod', v_method
  );
END;
$$;

REVOKE ALL ON FUNCTION public._synckerja_order_checkout_totals(uuid, numeric, uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_checkout_preview(
  p_code text,
  p_subtotal numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_totals jsonb;
  v_st_id uuid;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT st.id INTO v_st_id
  FROM public.catalog_sales_types st
  JOIN public.catalog_sales_type_outlets sto
    ON sto.sales_type_id = st.id AND sto.outlet_id = v_out.outlet_id
  WHERE st.organization_id = v_out.organization_id
    AND st.is_active
    AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order
  LIMIT 1;

  v_totals := public._synckerja_order_checkout_totals(
    v_out.organization_id,
    GREATEST(0, COALESCE(p_subtotal, 0)),
    v_out.outlet_id,
    v_st_id
  );
  RETURN jsonb_build_object('ok', true) || COALESCE(v_totals, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public._synckerja_order_checkout_totals(uuid, numeric, uuid, uuid) IS
  'Guest-order totals aligned with POS computeCatalogCheckoutTotals (tax on subtotal+gratuity when application_method=add).';
