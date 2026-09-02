-- Menu photo SELECT for storefront guests used a subquery on synckerja_order_org_settings.
-- That table has RLS with SELECT only for authenticated org members, so anon always saw
-- zero rows and createSignedUrl returned 400. Cover worked because branding policy
-- only checks the path segment "synckerja-order".

CREATE OR REPLACE FUNCTION public.synckerja_order_activated_org_ids()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.organization_id::text
  FROM public.synckerja_order_org_settings s
  WHERE s.terms_accepted_at IS NOT NULL;
$$;

COMMENT ON FUNCTION public.synckerja_order_activated_org_ids() IS
  'Org ids with Synckerja Order activated; SECURITY DEFINER so storage policies can authorize anon signed reads.';

REVOKE ALL ON FUNCTION public.synckerja_order_activated_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.synckerja_order_activated_org_ids() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS catalog_product_photos_public_synckerja_order_menu ON storage.objects;

CREATE POLICY catalog_product_photos_public_synckerja_order_menu
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'catalog-product-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT public.synckerja_order_activated_org_ids()
    )
  );
