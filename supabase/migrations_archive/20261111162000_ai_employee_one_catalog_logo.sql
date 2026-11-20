-- One saved logo per catalog. Active or not is the brief selection, not a second row.

CREATE UNIQUE INDEX IF NOT EXISTS digital_asset_company_logos_one_catalog
  ON public.digital_asset_company_logos (organization_id, service_id)
  WHERE service_id IS NOT NULL;
