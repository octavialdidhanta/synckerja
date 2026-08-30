-- QA: kitchen_fire_by_sales_type on pos_kitchen_outlet_settings
-- Paste into Supabase SQL Editor.

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pos_kitchen_outlet_settings'
  AND column_name = 'kitchen_fire_by_sales_type';

SELECT outlet_id, kitchen_fire_by_sales_type
FROM public.pos_kitchen_outlet_settings
ORDER BY updated_at DESC
LIMIT 10;
