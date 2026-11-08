-- Anon visitors on the public order page (including Vercel) sign the outlet receipt logo.
-- The previous policy read synckerja_order_outlet_settings directly, and that table
-- is not readable by anon, so the signed URL failed outside a logged-in office session.

CREATE OR REPLACE FUNCTION public.synckerja_order_receipt_logo_is_public(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (storage.foldername(p_name))[2] = 'outlets'
    AND split_part(p_name, '/', 4) LIKE 'logo.%'
    AND (storage.foldername(p_name))[3] IN (
      SELECT s.outlet_id::text
      FROM public.synckerja_order_outlet_settings s
      WHERE s.enabled IS TRUE
    );
$$;

REVOKE ALL ON FUNCTION public.synckerja_order_receipt_logo_is_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.synckerja_order_receipt_logo_is_public(text) TO anon, authenticated;

DROP POLICY IF EXISTS "outlet_receipt_logo_public_order" ON storage.objects;
CREATE POLICY "outlet_receipt_logo_public_order"
  ON storage.objects FOR SELECT TO anon
  USING (
    bucket_id = 'outlet-receipt-assets'
    AND public.synckerja_order_receipt_logo_is_public(name)
  );
