-- One saved color set per catalog. The brief hides Add once that row exists.

CREATE UNIQUE INDEX IF NOT EXISTS digital_asset_brand_colors_one_catalog
  ON public.digital_asset_brand_colors (organization_id, service_id)
  WHERE service_id IS NOT NULL;
