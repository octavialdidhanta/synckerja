-- Storefront customize: public item options, bundle opt-in, variant+modifier sanitize, kitchen text.

ALTER TABLE public.synckerja_order_catalog_items
  ALTER COLUMN catalog_item_id DROP NOT NULL;

ALTER TABLE public.synckerja_order_catalog_items
  ADD COLUMN IF NOT EXISTS bundle_id uuid NULL REFERENCES public.catalog_bundles (id) ON DELETE CASCADE;

ALTER TABLE public.synckerja_order_catalog_items
  DROP CONSTRAINT IF EXISTS synckerja_order_catalog_items_unique;

ALTER TABLE public.synckerja_order_catalog_items
  DROP CONSTRAINT IF EXISTS synckerja_order_catalog_items_product_or_bundle;

ALTER TABLE public.synckerja_order_catalog_items
  ADD CONSTRAINT synckerja_order_catalog_items_product_or_bundle
  CHECK (
    (catalog_item_id IS NOT NULL AND bundle_id IS NULL)
    OR (catalog_item_id IS NULL AND bundle_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_synckerja_order_catalog_items_product
  ON public.synckerja_order_catalog_items (outlet_id, catalog_item_id)
  WHERE catalog_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_synckerja_order_catalog_items_bundle
  ON public.synckerja_order_catalog_items (outlet_id, bundle_id)
  WHERE bundle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_synckerja_order_catalog_items_bundle
  ON public.synckerja_order_catalog_items (bundle_id)
  WHERE bundle_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public._synckerja_order_modifier_option_oos(
  p_outlet uuid,
  p_group_id uuid,
  p_option_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock boolean;
BEGIN
  SELECT COALESCE(g.stock_enabled, false)
  INTO v_stock
  FROM public.catalog_modifier_groups g
  WHERE g.id = p_group_id;
  IF NOT COALESCE(v_stock, false) THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.catalog_modifier_option_ingredients i
    WHERE i.option_id = p_option_id
  ) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.catalog_modifier_option_ingredients i
    JOIN public.catalog_ingredients ing ON ing.id = i.ingredient_id
    LEFT JOIN public.catalog_ingredient_outlets io
      ON io.ingredient_id = i.ingredient_id
     AND io.outlet_id = p_outlet
    WHERE i.option_id = p_option_id
      AND COALESCE(ing.track_inventory, false) = true
      AND COALESCE(io.in_stock, 0) < i.quantity
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._synckerja_order_line_modifiers_text(p_line jsonb)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    concat_ws(
      ', ',
      NULLIF(btrim(COALESCE(p_line ->> 'variantName', '')), ''),
      (
        SELECT string_agg(txt, ', ' ORDER BY ord)
        FROM (
          SELECT
            NULLIF(btrim(COALESCE(m ->> 'name', m ->> 'option_name', '')), '') AS txt,
            ord
          FROM jsonb_array_elements(COALESCE(p_line -> 'modifiers', '[]'::jsonb)) WITH ORDINALITY AS t(m, ord)
        ) named
        WHERE txt IS NOT NULL
      )
    ),
    ''
  );
$$;

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

  SELECT COALESCE(jsonb_agg(item ORDER BY sort_order, name), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      ci.sort_order,
      dp.name,
      jsonb_build_object(
        'id', dp.id,
        'name', COALESCE(dp.name, 'Item'),
        'description', dp.description,
        'unit_price', COALESCE(dp.unit_price, 0),
        'photo_path', dp.photo_path,
        'product_category_id', dp.product_category_id,
        'product_category_name', c.name,
        'pos_status', COALESCE(cpo.pos_status, dp.pos_status, 'available'),
        'kind', COALESCE(dp.kind, 'product'),
        'service_id', dp.service_id,
        'sub_service_id', dp.sub_service_id,
        'track_stock', COALESCE(dp.track_stock, false),
        'inventory_sku_id', dp.inventory_sku_id,
        'available_qty', NULL,
        'has_modifiers', EXISTS (
          SELECT 1
          FROM public.catalog_product_modifiers cpm
          JOIN public.catalog_modifier_groups g ON g.id = cpm.group_id AND g.is_active
          WHERE cpm.product_id = dp.id
            AND (
              NOT EXISTS (SELECT 1 FROM public.catalog_modifier_outlets mo WHERE mo.group_id = g.id)
              OR EXISTS (
                SELECT 1 FROM public.catalog_modifier_outlets mo
                WHERE mo.group_id = g.id AND mo.outlet_id = ci.outlet_id
              )
            )
        ),
        'variant_count', (
          SELECT count(*)::int FROM public.catalog_product_variants v WHERE v.product_id = dp.id
        ),
        'variants', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price', v.price) ORDER BY v.sort_order)
          FROM public.catalog_product_variants v
          WHERE v.product_id = dp.id
        ), '[]'::jsonb)
      ) AS item
    FROM public.synckerja_order_catalog_items ci
    JOIN public.default_prices dp ON dp.id = ci.catalog_item_id AND dp.organization_id = v_out.organization_id
    JOIN public.catalog_product_outlets cpo
      ON cpo.product_id = dp.id
     AND cpo.outlet_id = ci.outlet_id
     AND cpo.organization_id = v_out.organization_id
    LEFT JOIN public.catalog_product_categories c ON c.id = dp.product_category_id
    WHERE ci.outlet_id = v_out.outlet_id
      AND ci.catalog_item_id IS NOT NULL
      AND COALESCE(cpo.pos_status, dp.pos_status, 'available') <> 'hidden'
    UNION ALL
    SELECT
      ci.sort_order,
      cb.name,
      jsonb_build_object(
        'id', cb.id,
        'name', COALESCE(cb.name, 'Bundle'),
        'description', NULL,
        'unit_price', COALESCE(cb.bundle_price, 0),
        'photo_path', cb.photo_path,
        'product_category_id', NULL,
        'product_category_name', NULL,
        'pos_status', 'available',
        'kind', 'bundle',
        'service_id', NULL,
        'sub_service_id', NULL,
        'track_stock', false,
        'inventory_sku_id', NULL,
        'available_qty', NULL,
        'has_modifiers', false,
        'variant_count', 0,
        'variants', '[]'::jsonb
      ) AS item
    FROM public.synckerja_order_catalog_items ci
    JOIN public.catalog_bundles cb
      ON cb.id = ci.bundle_id
     AND cb.organization_id = v_out.organization_id
     AND cb.is_active
     AND COALESCE(cb.is_deleted, false) = false
    JOIN public.catalog_bundle_outlets cbo
      ON cbo.bundle_id = cb.id
     AND cbo.outlet_id = ci.outlet_id
    WHERE ci.outlet_id = v_out.outlet_id
      AND ci.bundle_id IS NOT NULL
  ) listed;

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
    JOIN public.catalog_product_outlets cpo
      ON cpo.product_id = dp.id
     AND cpo.outlet_id = ci.outlet_id
    JOIN public.catalog_product_categories c ON c.id = dp.product_category_id
    LEFT JOIN public.synckerja_order_category_layouts lay
      ON lay.outlet_id = ci.outlet_id
     AND lay.category_id = c.id
    WHERE ci.outlet_id = v_out.outlet_id
      AND ci.catalog_item_id IS NOT NULL
      AND COALESCE(cpo.pos_status, dp.pos_status, 'available') <> 'hidden'
    GROUP BY c.id, c.name, c.sort_order
  ) grouped_cats;

  RETURN jsonb_build_object(
    'ok', true,
    'categories', COALESCE(v_cats, '[]'::jsonb),
    'items', COALESCE(v_items, '[]'::jsonb),
    'dine_in_sales_type_id', v_st_id,
    'dine_in_sales_type_label', COALESCE(v_st_name, 'Dine In')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_item_options(
  p_code text,
  p_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out record;
  v_product public.default_prices%ROWTYPE;
  v_bundle public.catalog_bundles%ROWTYPE;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT dp.* INTO v_product
  FROM public.default_prices dp
  JOIN public.synckerja_order_catalog_items ci
    ON ci.catalog_item_id = dp.id
   AND ci.outlet_id = v_out.outlet_id
   AND ci.organization_id = v_out.organization_id
  JOIN public.catalog_product_outlets cpo
    ON cpo.product_id = dp.id
   AND cpo.outlet_id = v_out.outlet_id
  WHERE dp.id = p_item_id
    AND dp.organization_id = v_out.organization_id
    AND COALESCE(cpo.pos_status, dp.pos_status, 'available') <> 'hidden'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'kind', 'product',
      'id', v_product.id,
      'name', COALESCE(v_product.name, 'Item'),
      'description', v_product.description,
      'unit_price', COALESCE(v_product.unit_price, 0),
      'photo_path', v_product.photo_path,
      'variants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', v.id,
          'name', v.name,
          'price', v.price,
          'out_of_stock', COALESCE((
            SELECT vo.in_stock <= 0
            FROM public.catalog_product_variant_outlets vo
            WHERE vo.variant_id = v.id AND vo.outlet_id = v_out.outlet_id
          ), false)
        ) ORDER BY v.sort_order)
        FROM public.catalog_product_variants v
        WHERE v.product_id = v_product.id
      ), '[]'::jsonb),
      'modifier_groups', COALESCE((
        SELECT jsonb_agg(grp.obj ORDER BY grp.sort_order)
        FROM (
          SELECT
            g.sort_order,
            jsonb_build_object(
              'id', g.id,
              'name', g.name,
              'is_required', (g.limit_enabled AND g.is_required),
              'min_selected', CASE
                WHEN g.limit_enabled AND g.is_required THEN LEAST(
                  GREATEST(1, g.max_selected),
                  GREATEST(1, COALESCE(g.min_selected, 1))
                )
                ELSE 0
              END,
              'max_selected', CASE
                WHEN g.limit_enabled THEN GREATEST(1, g.max_selected)
                ELSE GREATEST(1, (
                  SELECT count(*)::int
                  FROM public.catalog_modifier_options o
                  WHERE o.group_id = g.id AND o.is_active
                ))
              END,
              'single_select', g.limit_enabled AND GREATEST(1, g.max_selected) = 1,
              'options', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', o.id,
                  'name', o.name,
                  'extra_price', COALESCE(o.extra_price, 0),
                  'out_of_stock', public._synckerja_order_modifier_option_oos(v_out.outlet_id, g.id, o.id)
                ) ORDER BY o.sort_order, o.name)
                FROM public.catalog_modifier_options o
                WHERE o.group_id = g.id AND o.is_active
              ), '[]'::jsonb)
            ) AS obj
          FROM public.catalog_product_modifiers cpm
          JOIN public.catalog_modifier_groups g ON g.id = cpm.group_id
          WHERE cpm.product_id = v_product.id
            AND g.is_active
            AND (
              NOT EXISTS (SELECT 1 FROM public.catalog_modifier_outlets mo WHERE mo.group_id = g.id)
              OR EXISTS (
                SELECT 1 FROM public.catalog_modifier_outlets mo
                WHERE mo.group_id = g.id AND mo.outlet_id = v_out.outlet_id
              )
            )
        ) grp
        WHERE jsonb_array_length(COALESCE(grp.obj -> 'options', '[]'::jsonb)) > 0
      ), '[]'::jsonb),
      'included_items', '[]'::jsonb
    );
  END IF;

  SELECT cb.* INTO v_bundle
  FROM public.catalog_bundles cb
  JOIN public.synckerja_order_catalog_items ci
    ON ci.bundle_id = cb.id
   AND ci.outlet_id = v_out.outlet_id
   AND ci.organization_id = v_out.organization_id
  JOIN public.catalog_bundle_outlets cbo
    ON cbo.bundle_id = cb.id
   AND cbo.outlet_id = v_out.outlet_id
  WHERE cb.id = p_item_id
    AND cb.organization_id = v_out.organization_id
    AND cb.is_active
    AND COALESCE(cb.is_deleted, false) = false
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'kind', 'bundle',
    'id', v_bundle.id,
    'name', COALESCE(v_bundle.name, 'Bundle'),
    'description', NULL,
    'unit_price', COALESCE(v_bundle.bundle_price, 0),
    'photo_path', v_bundle.photo_path,
    'variants', '[]'::jsonb,
    'modifier_groups', '[]'::jsonb,
    'included_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', COALESCE(dp.name, 'Item'),
        'quantity', bi.quantity
      ) ORDER BY bi.sort_order)
      FROM public.catalog_bundle_items bi
      JOIN public.default_prices dp ON dp.id = bi.product_id
      WHERE bi.bundle_id = v_bundle.id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_catalog(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_synckerja_order_item_options(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_item_options(text, uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public._synckerja_order_modifier_option_oos(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._synckerja_order_line_modifiers_text(jsonb) FROM PUBLIC;
