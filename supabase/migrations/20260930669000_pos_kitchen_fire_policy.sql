-- Per-outlet KDS fire trigger per sales type bucket (save_bill vs on_pay).

ALTER TABLE public.pos_kitchen_outlet_settings
  ADD COLUMN IF NOT EXISTS kitchen_fire_by_sales_type jsonb NOT NULL DEFAULT
    '{"dine_in":"save_bill","takeaway":"on_pay","delivery":"on_pay","pickup":"on_pay"}'::jsonb;

ALTER TABLE public.pos_kitchen_outlet_settings
  DROP CONSTRAINT IF EXISTS pos_kitchen_outlet_settings_fire_policy_check;

ALTER TABLE public.pos_kitchen_outlet_settings
  ADD CONSTRAINT pos_kitchen_outlet_settings_fire_policy_check CHECK (
    kitchen_fire_by_sales_type ? 'dine_in'
    AND kitchen_fire_by_sales_type ? 'takeaway'
    AND kitchen_fire_by_sales_type ? 'delivery'
    AND kitchen_fire_by_sales_type ? 'pickup'
    AND (kitchen_fire_by_sales_type ->> 'dine_in') IN ('save_bill', 'on_pay')
    AND (kitchen_fire_by_sales_type ->> 'takeaway') IN ('save_bill', 'on_pay')
    AND (kitchen_fire_by_sales_type ->> 'delivery') IN ('save_bill', 'on_pay')
    AND (kitchen_fire_by_sales_type ->> 'pickup') IN ('save_bill', 'on_pay')
  );

COMMENT ON COLUMN public.pos_kitchen_outlet_settings.kitchen_fire_by_sales_type IS
  'When to send KDS tickets per order type: save_bill (Simpan Bill) or on_pay (after payment).';
