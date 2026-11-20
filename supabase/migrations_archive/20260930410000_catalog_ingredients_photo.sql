-- Optional ingredient photo stored in catalog-product-photos bucket.

ALTER TABLE public.catalog_ingredients
  ADD COLUMN IF NOT EXISTS photo_path text;

COMMENT ON COLUMN public.catalog_ingredients.photo_path IS
  'Storage object path under catalog-product-photos (org/ingredients/{id}/...).';
