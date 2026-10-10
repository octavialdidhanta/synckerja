-- Optional product photo for an organization sub category.

ALTER TABLE public.sub_services
  ADD COLUMN IF NOT EXISTS image_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sub-service-photos',
  'sub-service-photos',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Path convention: `{organizationId}/{subServiceId}.{ext}`

DROP POLICY IF EXISTS "sub_service_photos_storage_insert" ON storage.objects;
CREATE POLICY "sub_service_photos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sub-service-photos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "sub_service_photos_storage_select" ON storage.objects;
CREATE POLICY "sub_service_photos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sub-service-photos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "sub_service_photos_storage_update" ON storage.objects;
CREATE POLICY "sub_service_photos_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sub-service-photos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  )
  WITH CHECK (
    bucket_id = 'sub-service-photos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "sub_service_photos_storage_delete" ON storage.objects;
CREATE POLICY "sub_service_photos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sub-service-photos'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );
