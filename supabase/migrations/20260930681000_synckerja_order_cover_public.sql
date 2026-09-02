-- Public read for Synckerja Order cover/logo objects only.
-- Path: {organization_id}/synckerja-order/{filename}

DROP POLICY IF EXISTS catalog_product_photos_public_order_branding ON storage.objects;
CREATE POLICY catalog_product_photos_public_order_branding
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'catalog-product-photos'
    AND (storage.foldername(name))[2] = 'synckerja-order'
  );
