-- Preserve store-checkout grand total when sales_activity_items change.
-- Store checkouts set checkout_subtotal / tax / gratuity; SUM(items) is pre-tax only
-- and must not overwrite total_amount.

CREATE OR REPLACE FUNCTION public.update_sales_activity_total_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_id uuid;
  v_checkout_subtotal numeric;
  v_tax numeric;
  v_gratuity numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.sales_activity_id;
  ELSE
    target_id := NEW.sales_activity_id;
  END IF;

  SELECT
    sa.checkout_subtotal,
    sa.checkout_tax_amount,
    sa.checkout_gratuity_amount
  INTO
    v_checkout_subtotal,
    v_tax,
    v_gratuity
  FROM public.sales_activities sa
  WHERE sa.id = target_id;

  -- Store checkout: keep grand total from checkout breakdown (not line-item sum).
  IF v_checkout_subtotal IS NOT NULL THEN
    UPDATE public.sales_activities sa
    SET
      total_amount = ROUND(
        COALESCE(v_checkout_subtotal, 0)
        + COALESCE(v_tax, 0)
        + COALESCE(v_gratuity, 0),
        2
      ),
      updated_at = NOW()
    WHERE sa.id = target_id;
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.sales_activities sa
  SET
    total_amount = COALESCE((
      SELECT SUM(i.total_price)
      FROM public.sales_activity_items i
      WHERE i.sales_activity_id = sa.id
    ), 0),
    updated_at = NOW()
  WHERE sa.id = target_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;
