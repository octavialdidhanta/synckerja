-- Bundle prices per sales type (Library settings; POS checkout is a later phase).

ALTER TABLE public.catalog_bundles
  ADD COLUMN IF NOT EXISTS use_sales_type_prices boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.catalog_bundle_sales_type_prices (
  bundle_id uuid NOT NULL REFERENCES public.catalog_bundles (id) ON DELETE CASCADE,
  sales_type_id uuid NOT NULL REFERENCES public.catalog_sales_types (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  price numeric(14, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_bundle_sales_type_prices_pkey PRIMARY KEY (bundle_id, sales_type_id),
  CONSTRAINT catalog_bundle_sales_type_prices_price_check CHECK (price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_catalog_bundle_sales_type_prices_org
  ON public.catalog_bundle_sales_type_prices (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_bundle_sales_type_prices_sales_type
  ON public.catalog_bundle_sales_type_prices (sales_type_id);

ALTER TABLE public.catalog_bundle_sales_type_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_bundle_sales_type_prices_org_select" ON public.catalog_bundle_sales_type_prices;
CREATE POLICY "catalog_bundle_sales_type_prices_org_select"
  ON public.catalog_bundle_sales_type_prices FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundle_sales_type_prices_org_insert" ON public.catalog_bundle_sales_type_prices;
CREATE POLICY "catalog_bundle_sales_type_prices_org_insert"
  ON public.catalog_bundle_sales_type_prices FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundle_sales_type_prices_org_update" ON public.catalog_bundle_sales_type_prices;
CREATE POLICY "catalog_bundle_sales_type_prices_org_update"
  ON public.catalog_bundle_sales_type_prices FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_bundle_sales_type_prices_org_delete" ON public.catalog_bundle_sales_type_prices;
CREATE POLICY "catalog_bundle_sales_type_prices_org_delete"
  ON public.catalog_bundle_sales_type_prices FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.catalog_bundle_sales_type_prices IS
  'Bundle package price per sales type when use_sales_type_prices is true. POS checkout is a later phase.';
