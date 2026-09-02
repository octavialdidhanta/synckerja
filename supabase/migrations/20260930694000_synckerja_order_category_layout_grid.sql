-- Synckerja Order: add grid_2col category section layout (2-column vertical grid).

ALTER TABLE public.synckerja_order_category_layouts
  DROP CONSTRAINT IF EXISTS synckerja_order_category_layouts_layout_check;

ALTER TABLE public.synckerja_order_category_layouts
  ADD CONSTRAINT synckerja_order_category_layouts_layout_check
  CHECK (layout IN ('list', 'slider_bleed', 'grid_2col'));
