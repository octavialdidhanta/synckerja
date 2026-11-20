-- Per-template company logo for invoice PDF (storage path in invoice-template-logos bucket).

ALTER TABLE public.invoice_templates
  ADD COLUMN IF NOT EXISTS company_logo_path text NULL;

COMMENT ON COLUMN public.invoice_templates.company_logo_path IS
  'Storage object path in bucket invoice-template-logos ({organization_id}/...).';

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-template-logos', 'invoice-template-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "invoice_template_logos_storage_insert" ON storage.objects;
CREATE POLICY "invoice_template_logos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoice-template-logos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "invoice_template_logos_storage_select" ON storage.objects;
CREATE POLICY "invoice_template_logos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoice-template-logos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "invoice_template_logos_storage_update" ON storage.objects;
CREATE POLICY "invoice_template_logos_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'invoice-template-logos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "invoice_template_logos_storage_delete" ON storage.objects;
CREATE POLICY "invoice_template_logos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'invoice-template-logos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );
