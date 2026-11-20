-- POS quick create may omit photo; BO form can still require one in UI.
ALTER TABLE public.default_prices
  DROP CONSTRAINT IF EXISTS default_prices_kind_shape_check;

ALTER TABLE public.default_prices
  ADD CONSTRAINT default_prices_kind_shape_check CHECK (
    (
      kind = 'service'
      AND service_id IS NOT NULL
    )
    OR (
      kind = 'product'
      AND name IS NOT NULL
      AND btrim(name) <> ''
    )
  );
