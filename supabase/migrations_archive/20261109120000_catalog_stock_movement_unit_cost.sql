-- Inventory Adjustment: keep the value of each adjustment in rupiah.
--
-- The Adjustment page showed Expense/Income as Rp 0 because no price was stored with the movement.
-- avg_cost on the outlet rows changes after every purchase order, so the price must be captured
-- when the adjustment is recorded; otherwise past adjustments would be revalued later.
--
-- unit_cost = outlet avg_cost of the ingredient / variant / product at insert time.
-- NULL means "no buy price yet" (avg_cost missing or 0); the UI shows that instead of Rp 0.
-- Only adjustment movements are stamped. The value is for the Adjustment report only; it is not
-- written to finance expenses (the purchase order already records the spend).

ALTER TABLE public.catalog_stock_movements
  ADD COLUMN IF NOT EXISTS unit_cost numeric(14,2);

COMMENT ON COLUMN public.catalog_stock_movements.unit_cost IS
  'Outlet avg_cost per unit when the adjustment was recorded. NULL = no buy price yet.';

CREATE OR REPLACE FUNCTION public.catalog_stock_movement_outlet_unit_cost(
  p_outlet_id uuid,
  p_item_kind text,
  p_product_id uuid,
  p_variant_id uuid,
  p_ingredient_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT NULLIF(
    CASE
      WHEN p_item_kind = 'ingredient' THEN (
        SELECT io.avg_cost FROM public.catalog_ingredient_outlets io
        WHERE io.ingredient_id = p_ingredient_id AND io.outlet_id = p_outlet_id
      )
      WHEN p_item_kind = 'product' AND p_variant_id IS NOT NULL THEN (
        SELECT vo.avg_cost FROM public.catalog_product_variant_outlets vo
        WHERE vo.variant_id = p_variant_id AND vo.outlet_id = p_outlet_id
      )
      WHEN p_item_kind = 'product' THEN (
        SELECT po.avg_cost FROM public.catalog_product_outlets po
        WHERE po.product_id = p_product_id AND po.outlet_id = p_outlet_id
      )
    END,
    0
  );
$fn$;

REVOKE ALL ON FUNCTION public.catalog_stock_movement_outlet_unit_cost(uuid,text,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_stock_movement_outlet_unit_cost(uuid,text,uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.catalog_stock_movements_stamp_unit_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.movement_type = 'adjustment' AND NEW.unit_cost IS NULL THEN
    NEW.unit_cost := public.catalog_stock_movement_outlet_unit_cost(
      NEW.outlet_id, NEW.item_kind, NEW.product_id, NEW.variant_id, NEW.ingredient_id
    );
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.catalog_stock_movements_stamp_unit_cost() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_catalog_stock_movements_stamp_unit_cost ON public.catalog_stock_movements;
CREATE TRIGGER trg_catalog_stock_movements_stamp_unit_cost
  BEFORE INSERT ON public.catalog_stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.catalog_stock_movements_stamp_unit_cost();

-- Existing adjustments: stamp once with today's avg_cost (best available estimate).
UPDATE public.catalog_stock_movements m
SET unit_cost = public.catalog_stock_movement_outlet_unit_cost(
  m.outlet_id, m.item_kind, m.product_id, m.variant_id, m.ingredient_id
)
WHERE m.movement_type = 'adjustment' AND m.unit_cost IS NULL;

NOTIFY pgrst, 'reload schema';
