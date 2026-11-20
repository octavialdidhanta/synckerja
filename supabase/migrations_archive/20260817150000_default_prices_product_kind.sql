-- Catalog: Service vs Product on default_prices, link tracked products to inventory SKUs.

ALTER TABLE public.default_prices
  ALTER COLUMN service_id DROP NOT NULL;

ALTER TABLE public.default_prices
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS name text NULL,
  ADD COLUMN IF NOT EXISTS photo_path text NULL,
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_sku_id uuid NULL REFERENCES public.inventory_skus (id) ON DELETE SET NULL;

UPDATE public.default_prices
SET kind = 'service'
WHERE kind IS NULL OR btrim(kind) = '';

ALTER TABLE public.default_prices
  DROP CONSTRAINT IF EXISTS default_prices_kind_check;

ALTER TABLE public.default_prices
  ADD CONSTRAINT default_prices_kind_check CHECK (kind IN ('service', 'product'));

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
      AND photo_path IS NOT NULL
      AND btrim(photo_path) <> ''
    )
  );

ALTER TABLE public.default_prices
  DROP CONSTRAINT IF EXISTS default_prices_track_stock_check;

ALTER TABLE public.default_prices
  ADD CONSTRAINT default_prices_track_stock_check CHECK (
    track_stock = false
    OR (
      kind = 'product'
      AND inventory_sku_id IS NOT NULL
    )
  );

ALTER TABLE public.default_prices
  DROP CONSTRAINT IF EXISTS uq_default_prices_org_service_sub;

DROP INDEX IF EXISTS uq_default_prices_org_service_sub;

CREATE UNIQUE INDEX IF NOT EXISTS uq_default_prices_org_service_sub
  ON public.default_prices (organization_id, service_id, sub_service_id)
  WHERE kind = 'service';

CREATE UNIQUE INDEX IF NOT EXISTS uq_default_prices_org_tracked_sku
  ON public.default_prices (organization_id, inventory_sku_id)
  WHERE kind = 'product' AND inventory_sku_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_default_prices_org_kind
  ON public.default_prices (organization_id, kind);

CREATE INDEX IF NOT EXISTS idx_default_prices_inventory_sku
  ON public.default_prices (inventory_sku_id)
  WHERE inventory_sku_id IS NOT NULL;

COMMENT ON COLUMN public.default_prices.kind IS 'service = jasa (lead conversion); product = retail/F&B catalog.';
COMMENT ON COLUMN public.default_prices.track_stock IS 'If true, POS decrements inventory_skus via stock-management offlineSale.';

ALTER TABLE public.sales_activity_items
  ADD COLUMN IF NOT EXISTS item_kind text NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS inventory_sku_id uuid NULL REFERENCES public.inventory_skus (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false;

ALTER TABLE public.sales_activity_items
  DROP CONSTRAINT IF EXISTS sales_activity_items_item_kind_check;

ALTER TABLE public.sales_activity_items
  ADD CONSTRAINT sales_activity_items_item_kind_check CHECK (item_kind IN ('service', 'product'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-product-photos', 'catalog-product-photos', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "catalog_product_photos_storage_select" ON storage.objects;
CREATE POLICY "catalog_product_photos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'catalog-product-photos'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "catalog_product_photos_storage_insert" ON storage.objects;
CREATE POLICY "catalog_product_photos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'catalog-product-photos'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "catalog_product_photos_storage_update" ON storage.objects;
CREATE POLICY "catalog_product_photos_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'catalog-product-photos'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    bucket_id = 'catalog-product-photos'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "catalog_product_photos_storage_delete" ON storage.objects;
CREATE POLICY "catalog_product_photos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'catalog-product-photos'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );
