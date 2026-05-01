-- Storage: debt-payment-receipts (first path segment = organization_id; matches submitDebtPayment upload)
INSERT INTO storage.buckets (id, name, public)
VALUES ('debt-payment-receipts', 'debt-payment-receipts', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "debt_payment_receipts_storage_select" ON storage.objects;
CREATE POLICY "debt_payment_receipts_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'debt-payment-receipts'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "debt_payment_receipts_storage_insert" ON storage.objects;
CREATE POLICY "debt_payment_receipts_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'debt-payment-receipts'
    AND (storage.foldername (name))[1] = (
      SELECT p.active_organization_id::text
      FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "debt_payment_receipts_storage_update" ON storage.objects;
CREATE POLICY "debt_payment_receipts_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'debt-payment-receipts'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    bucket_id = 'debt-payment-receipts'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "debt_payment_receipts_storage_delete" ON storage.objects;
CREATE POLICY "debt_payment_receipts_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'debt-payment-receipts'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );
