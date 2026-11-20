-- Allow product inventory tracking without an inventory_skus link.
-- Outlet/variant stock is the source of truth for this catalog UX.

ALTER TABLE public.default_prices
  DROP CONSTRAINT IF EXISTS default_prices_track_stock_check;

ALTER TABLE public.default_prices
  ADD CONSTRAINT default_prices_track_stock_check CHECK (
    track_stock = false OR kind = 'product'
  );
