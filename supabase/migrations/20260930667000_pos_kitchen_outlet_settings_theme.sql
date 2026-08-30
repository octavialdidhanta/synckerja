-- KDS theme prefs: font size + order/status colors.

ALTER TABLE public.pos_kitchen_outlet_settings
  ADD COLUMN IF NOT EXISTS font_size text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS colors jsonb NOT NULL DEFAULT '{"order_types":{"dine_in":"#9fb6ff","takeaway":"#84b4e3","delivery":"#9374e1","pickup":"#9fdb60"},"status":{"on_time":"#14b768","caution":"#fdc200","late":"#d0021b"}}'::jsonb;

ALTER TABLE public.pos_kitchen_outlet_settings
  DROP CONSTRAINT IF EXISTS pos_kitchen_outlet_settings_font_size_check;
ALTER TABLE public.pos_kitchen_outlet_settings
  ADD CONSTRAINT pos_kitchen_outlet_settings_font_size_check
  CHECK (font_size IN ('default', 'small', 'medium', 'large'));

COMMENT ON COLUMN public.pos_kitchen_outlet_settings.font_size IS
  'KDS ticket card text scale: default | small | medium | large.';
COMMENT ON COLUMN public.pos_kitchen_outlet_settings.colors IS
  'KDS theme colors: order_types (4 buckets) + status (on_time/caution/late) as #RRGGBB.';
