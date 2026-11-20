ALTER TABLE public.pos_outlets ADD COLUMN IF NOT EXISTS postal_code text;

CREATE TABLE IF NOT EXISTS public.pos_outlet_receipt_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  logo_storage_path text,
  footer_notes text,
  share_via_email boolean NOT NULL DEFAULT false,
  share_via_sms boolean NOT NULL DEFAULT false,
  website_url text,
  twitter_url text,
  facebook_url text,
  instagram_url text,
  tiktok_url text,
  whatsapp_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_outlet_receipt_settings_pkey PRIMARY KEY (id),
  CONSTRAINT pos_outlet_receipt_settings_outlet_unique UNIQUE (outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_outlet_receipt_settings_org
  ON public.pos_outlet_receipt_settings (organization_id);

ALTER TABLE public.pos_outlet_receipt_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_outlet_receipt_settings_org_select" ON public.pos_outlet_receipt_settings;
CREATE POLICY "pos_outlet_receipt_settings_org_select"
  ON public.pos_outlet_receipt_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_receipt_settings_org_insert" ON public.pos_outlet_receipt_settings;
CREATE POLICY "pos_outlet_receipt_settings_org_insert"
  ON public.pos_outlet_receipt_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_receipt_settings_org_update" ON public.pos_outlet_receipt_settings;
CREATE POLICY "pos_outlet_receipt_settings_org_update"
  ON public.pos_outlet_receipt_settings FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_outlet_receipt_settings_org_delete" ON public.pos_outlet_receipt_settings;
CREATE POLICY "pos_outlet_receipt_settings_org_delete"
  ON public.pos_outlet_receipt_settings FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP TRIGGER IF EXISTS update_pos_outlet_receipt_settings_updated_at ON public.pos_outlet_receipt_settings;
CREATE TRIGGER update_pos_outlet_receipt_settings_updated_at
  BEFORE UPDATE ON public.pos_outlet_receipt_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'outlet-receipt-assets',
  'outlet-receipt-assets',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "outlet_receipt_assets_storage_select" ON storage.objects;
CREATE POLICY "outlet_receipt_assets_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'outlet-receipt-assets'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "outlet_receipt_assets_storage_insert" ON storage.objects;
CREATE POLICY "outlet_receipt_assets_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'outlet-receipt-assets'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "outlet_receipt_assets_storage_update" ON storage.objects;
CREATE POLICY "outlet_receipt_assets_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'outlet-receipt-assets'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    bucket_id = 'outlet-receipt-assets'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "outlet_receipt_assets_storage_delete" ON storage.objects;
CREATE POLICY "outlet_receipt_assets_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'outlet-receipt-assets'
    AND (storage.foldername (name))[1] IN (
      SELECT o.id::text FROM public.organizations o
      WHERE o.id IN (SELECT public.user_organization_ids())
    )
  );

INSERT INTO public.permission_configuration_defaults (
  page_path, page_title, is_active, roles_allowed, job_levels_allowed, exceptions, exception_paths
)
VALUES (
  '/operations/settings/receipt',
  'Operations — Settings — Receipt',
  true,
  ARRAY['owner', 'admin']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  job_levels_allowed = EXCLUDED.job_levels_allowed,
  exceptions = EXCLUDED.exceptions,
  exception_paths = EXCLUDED.exception_paths,
  updated_at = now();

INSERT INTO public.permission_configurations (
  organization_id, page_path, page_title, is_active, roles_allowed, job_levels_allowed, exceptions, exception_paths
)
SELECT o.id, d.page_path, d.page_title, d.is_active, d.roles_allowed, d.job_levels_allowed, d.exceptions, d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE d.page_path = '/operations/settings/receipt'
  AND NOT EXISTS (
    SELECT 1 FROM public.permission_configurations p
    WHERE p.organization_id = o.id AND p.page_path = d.page_path
  );
