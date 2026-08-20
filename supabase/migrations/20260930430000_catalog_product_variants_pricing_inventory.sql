-- Product variants, per-sales-type prices, and outlet-scoped inventory/COGS.
-- POS checkout deduction is a later phase.

ALTER TABLE public.default_prices
  ADD COLUMN IF NOT EXISTS use_sales_type_prices boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sku text;

COMMENT ON COLUMN public.default_prices.sku IS
  'Catalog SKU for a product with no variants. Variant SKUs live on catalog_product_variants.';

-- Catalog inventory lives on product/variant outlet rows; Stock Management SKU is optional.
ALTER TABLE public.default_prices
  DROP CONSTRAINT IF EXISTS default_prices_track_stock_check;
ALTER TABLE public.default_prices
  ADD CONSTRAINT default_prices_track_stock_check CHECK (
    track_stock = false OR kind = 'product'
  );

CREATE TABLE IF NOT EXISTS public.catalog_product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.default_prices (id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  price numeric(14, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_product_variants_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT catalog_product_variants_price_check CHECK (price >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_product_variants_name
  ON public.catalog_product_variants (product_id, lower(btrim(name)));

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_product_variants_org_sku
  ON public.catalog_product_variants (organization_id, lower(btrim(sku)))
  WHERE sku IS NOT NULL AND btrim(sku) <> '';

CREATE INDEX IF NOT EXISTS idx_catalog_product_variants_product
  ON public.catalog_product_variants (product_id, sort_order);

ALTER TABLE public.catalog_product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_product_variants_org_select" ON public.catalog_product_variants;
CREATE POLICY "catalog_product_variants_org_select"
  ON public.catalog_product_variants FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_variants_org_insert" ON public.catalog_product_variants;
CREATE POLICY "catalog_product_variants_org_insert"
  ON public.catalog_product_variants FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_variants_org_update" ON public.catalog_product_variants;
CREATE POLICY "catalog_product_variants_org_update"
  ON public.catalog_product_variants FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_variants_org_delete" ON public.catalog_product_variants;
CREATE POLICY "catalog_product_variants_org_delete"
  ON public.catalog_product_variants FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_catalog_product_variants_updated_at ON public.catalog_product_variants;
CREATE TRIGGER update_catalog_product_variants_updated_at
  BEFORE UPDATE ON public.catalog_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.catalog_product_sales_type_prices (
  product_id uuid NOT NULL REFERENCES public.default_prices (id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.catalog_product_variants (id) ON DELETE CASCADE,
  sales_type_id uuid NOT NULL REFERENCES public.catalog_sales_types (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  price numeric(14, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_product_sales_type_prices_price_check CHECK (price >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_product_sales_type_prices
  ON public.catalog_product_sales_type_prices (
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    sales_type_id
  );

CREATE INDEX IF NOT EXISTS idx_catalog_product_sales_type_prices_org
  ON public.catalog_product_sales_type_prices (organization_id);

ALTER TABLE public.catalog_product_sales_type_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_product_stp_org_select" ON public.catalog_product_sales_type_prices;
CREATE POLICY "catalog_product_stp_org_select"
  ON public.catalog_product_sales_type_prices FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_stp_org_insert" ON public.catalog_product_sales_type_prices;
CREATE POLICY "catalog_product_stp_org_insert"
  ON public.catalog_product_sales_type_prices FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_stp_org_update" ON public.catalog_product_sales_type_prices;
CREATE POLICY "catalog_product_stp_org_update"
  ON public.catalog_product_sales_type_prices FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_stp_org_delete" ON public.catalog_product_sales_type_prices;
CREATE POLICY "catalog_product_stp_org_delete"
  ON public.catalog_product_sales_type_prices FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

ALTER TABLE public.catalog_product_outlets
  ADD COLUMN IF NOT EXISTS in_stock numeric(14, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_at numeric(14, 3),
  ADD COLUMN IF NOT EXISTS track_cogs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avg_cost numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.catalog_product_outlets
  DROP CONSTRAINT IF EXISTS catalog_product_outlets_in_stock_check;
ALTER TABLE public.catalog_product_outlets
  ADD CONSTRAINT catalog_product_outlets_in_stock_check CHECK (in_stock >= 0);
ALTER TABLE public.catalog_product_outlets
  DROP CONSTRAINT IF EXISTS catalog_product_outlets_alert_at_check;
ALTER TABLE public.catalog_product_outlets
  ADD CONSTRAINT catalog_product_outlets_alert_at_check CHECK (alert_at IS NULL OR alert_at >= 0);
ALTER TABLE public.catalog_product_outlets
  DROP CONSTRAINT IF EXISTS catalog_product_outlets_avg_cost_check;
ALTER TABLE public.catalog_product_outlets
  ADD CONSTRAINT catalog_product_outlets_avg_cost_check CHECK (avg_cost >= 0);

CREATE TABLE IF NOT EXISTS public.catalog_product_variant_outlets (
  variant_id uuid NOT NULL REFERENCES public.catalog_product_variants (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  in_stock numeric(14, 3) NOT NULL DEFAULT 0,
  alert_enabled boolean NOT NULL DEFAULT false,
  alert_at numeric(14, 3),
  track_cogs boolean NOT NULL DEFAULT false,
  avg_cost numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_product_variant_outlets_pkey PRIMARY KEY (variant_id, outlet_id),
  CONSTRAINT catalog_product_variant_outlets_in_stock_check CHECK (in_stock >= 0),
  CONSTRAINT catalog_product_variant_outlets_alert_at_check CHECK (alert_at IS NULL OR alert_at >= 0),
  CONSTRAINT catalog_product_variant_outlets_avg_cost_check CHECK (avg_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_catalog_product_variant_outlets_org
  ON public.catalog_product_variant_outlets (organization_id);

CREATE INDEX IF NOT EXISTS idx_catalog_product_variant_outlets_outlet
  ON public.catalog_product_variant_outlets (outlet_id);

ALTER TABLE public.catalog_product_variant_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_product_variant_outlets_org_select" ON public.catalog_product_variant_outlets;
CREATE POLICY "catalog_product_variant_outlets_org_select"
  ON public.catalog_product_variant_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_variant_outlets_org_insert" ON public.catalog_product_variant_outlets;
CREATE POLICY "catalog_product_variant_outlets_org_insert"
  ON public.catalog_product_variant_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_variant_outlets_org_update" ON public.catalog_product_variant_outlets;
CREATE POLICY "catalog_product_variant_outlets_org_update"
  ON public.catalog_product_variant_outlets FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "catalog_product_variant_outlets_org_delete" ON public.catalog_product_variant_outlets;
CREATE POLICY "catalog_product_variant_outlets_org_delete"
  ON public.catalog_product_variant_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));
