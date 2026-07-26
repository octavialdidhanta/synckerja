-- Character reference images for Digital Assets / Detect from Image.
-- Fixes: {"statusCode":"404","error":"Bucket not found"} on Save to Character.

INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-asset-character-images', 'digital-asset-character-images', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: `{organizationId}/{characterId}.{ext}`

DROP POLICY IF EXISTS "digital_asset_character_images_storage_insert" ON storage.objects;
CREATE POLICY "digital_asset_character_images_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'digital-asset-character-images'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "digital_asset_character_images_storage_select" ON storage.objects;
CREATE POLICY "digital_asset_character_images_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'digital-asset-character-images'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "digital_asset_character_images_storage_update" ON storage.objects;
CREATE POLICY "digital_asset_character_images_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'digital-asset-character-images'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  )
  WITH CHECK (
    bucket_id = 'digital-asset-character-images'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "digital_asset_character_images_storage_delete" ON storage.objects;
CREATE POLICY "digital_asset_character_images_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'digital-asset-character-images'
    AND (storage.foldername(name))[1] = (
      SELECT active_organization_id::text
      FROM public.profiles
      WHERE user_id = auth.uid() AND active_organization_id IS NOT NULL
      LIMIT 1
    )
  );
