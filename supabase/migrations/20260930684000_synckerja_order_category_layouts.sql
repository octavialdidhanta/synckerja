-- Synckerja Order: per-outlet category section layout (list | slider_bleed).

CREATE TABLE IF NOT EXISTS public.synckerja_order_category_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.catalog_product_categories (id) ON DELETE CASCADE,
  layout text NOT NULL DEFAULT 'list',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT synckerja_order_category_layouts_unique UNIQUE (outlet_id, category_id),
  CONSTRAINT synckerja_order_category_layouts_layout_check CHECK (layout IN ('list', 'slider_bleed'))
);

CREATE INDEX IF NOT EXISTS idx_synckerja_order_category_layouts_org_outlet
  ON public.synckerja_order_category_layouts (organization_id, outlet_id);

DROP TRIGGER IF EXISTS update_synckerja_order_category_layouts_updated_at
  ON public.synckerja_order_category_layouts;
CREATE TRIGGER update_synckerja_order_category_layouts_updated_at
  BEFORE UPDATE ON public.synckerja_order_category_layouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.synckerja_order_category_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS synckerja_order_category_layouts_select ON public.synckerja_order_category_layouts;
CREATE POLICY synckerja_order_category_layouts_select
  ON public.synckerja_order_category_layouts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS synckerja_order_category_layouts_ins ON public.synckerja_order_category_layouts;
CREATE POLICY synckerja_order_category_layouts_ins
  ON public.synckerja_order_category_layouts FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS synckerja_order_category_layouts_upd ON public.synckerja_order_category_layouts;
CREATE POLICY synckerja_order_category_layouts_upd
  ON public.synckerja_order_category_layouts FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS synckerja_order_category_layouts_del ON public.synckerja_order_category_layouts;
CREATE POLICY synckerja_order_category_layouts_del
  ON public.synckerja_order_category_layouts FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_catalog(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_items jsonb;
  v_cats jsonb;
  v_st_id uuid;
  v_st_name text := 'Dine In';
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'categories', '[]'::jsonb, 'items', '[]'::jsonb);
  END IF;
  SELECT st.id, st.name INTO v_st_id, v_st_name
  FROM public.catalog_sales_types st
  WHERE st.organization_id = v_out.organization_id
    AND st.is_active = true
    AND lower(st.name) LIKE '%dine%'
  ORDER BY st.sort_order
  LIMIT 1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', dp.id,
    'name', COALESCE(dp.name, 'Item'),
    'description', dp.description,
    'unit_price', COALESCE(dp.unit_price, 0),
    'photo_path', dp.photo_path,
    'product_category_id', dp.product_category_id,
    'product_category_name', c.name,
    'pos_status', COALESCE(dp.pos_status, 'available'),
    'kind', COALESCE(dp.kind, 'product'),
    'service_id', dp.service_id,
    'sub_service_id', dp.sub_service_id,
    'track_stock', COALESCE(dp.track_stock, false),
    'inventory_sku_id', dp.inventory_sku_id,
    'available_qty', NULL,
    'variants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price', v.price) ORDER BY v.sort_order)
      FROM public.catalog_product_variants v
      WHERE v.product_id = dp.id
    ), '[]'::jsonb)
  ) ORDER BY ci.sort_order, dp.name), '[]'::jsonb)
  INTO v_items
  FROM public.synckerja_order_catalog_items ci
  JOIN public.default_prices dp ON dp.id = ci.catalog_item_id AND dp.organization_id = v_out.organization_id
  LEFT JOIN public.catalog_product_categories c ON c.id = dp.product_category_id
  WHERE ci.outlet_id = v_out.outlet_id
    AND COALESCE(dp.pos_status, 'available') <> 'hidden';

  SELECT COALESCE(jsonb_agg(cat ORDER BY (cat->>'sort_order')::int, cat->>'name'), '[]'::jsonb)
  INTO v_cats
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'sort_order', c.sort_order,
      'layout', COALESCE(MAX(lay.layout), 'list')
    ) AS cat
    FROM public.synckerja_order_catalog_items ci
    JOIN public.default_prices dp ON dp.id = ci.catalog_item_id
    JOIN public.catalog_product_categories c ON c.id = dp.product_category_id
    LEFT JOIN public.synckerja_order_category_layouts lay
      ON lay.outlet_id = ci.outlet_id
     AND lay.category_id = c.id
    WHERE ci.outlet_id = v_out.outlet_id
      AND COALESCE(dp.pos_status, 'available') <> 'hidden'
    GROUP BY c.id, c.name, c.sort_order
  ) grouped_cats;

  RETURN jsonb_build_object(
    'ok', true,
    'categories', COALESCE(v_cats, '[]'::jsonb),
    'items', v_items,
    'dine_in_sales_type_id', v_st_id,
    'dine_in_sales_type_label', COALESCE(v_st_name, 'Dine In')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_catalog(text) TO anon, authenticated;
