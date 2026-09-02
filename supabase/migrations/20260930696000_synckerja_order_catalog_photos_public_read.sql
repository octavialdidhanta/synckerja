-- Storefront guests (anon) must read catalog product photos for activated Synckerja Order orgs.
-- Cover/logo already use catalog_product_photos_public_order_branding; menu photos live under {org_id}/{product_id}/...

DROP POLICY IF EXISTS catalog_product_photos_anon_synckerja_order ON storage.objects;
DROP POLICY IF EXISTS catalog_product_photos_public_synckerja_order_menu ON storage.objects;

CREATE POLICY catalog_product_photos_public_synckerja_order_menu
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'catalog-product-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT s.organization_id::text
      FROM public.synckerja_order_org_settings s
      WHERE s.terms_accepted_at IS NOT NULL
    )
  );
