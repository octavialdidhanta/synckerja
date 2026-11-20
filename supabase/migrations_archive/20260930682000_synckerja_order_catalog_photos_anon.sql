-- Guests on order.synckerja.com need signed reads of catalog photos
-- for orgs that activated Synckerja Order.

DROP POLICY IF EXISTS catalog_product_photos_anon_synckerja_order ON storage.objects;
CREATE POLICY catalog_product_photos_anon_synckerja_order
  ON storage.objects FOR SELECT TO anon
  USING (
    bucket_id = 'catalog-product-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT s.organization_id::text
      FROM public.synckerja_order_org_settings s
      WHERE s.terms_accepted_at IS NOT NULL
    )
  );
