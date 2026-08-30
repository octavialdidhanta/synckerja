-- QA: pos_kitchen_outlet_settings
SELECT to_regclass('public.pos_kitchen_outlet_settings') AS settings_tbl;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pos_kitchen_outlet_settings'
  AND column_name IN (
    'organization_id',
    'outlet_id',
    'display_mode',
    'order_type_visibility',
    'font_size',
    'colors'
  )
ORDER BY 1;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.pos_kitchen_outlet_settings'::regclass
  AND contype IN ('c', 'u')
ORDER BY 1;

SELECT polname
FROM pg_policy
WHERE polrelid = 'public.pos_kitchen_outlet_settings'::regclass
ORDER BY 1;
