-- A signed-in member may upload a location photo from Content Studio.
-- The object must stay in that organization's photos folder.
-- Thumbnails and 480p previews stay on the service role. There is no delete policy.

DROP POLICY IF EXISTS catalog_media_photos_insert ON storage.objects;
CREATE POLICY catalog_media_photos_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'catalog-media'
    AND (storage.foldername(name))[1] IN (
      SELECT public.user_organization_ids()::text
    )
    AND (storage.foldername(name))[2] = 'photos'
    AND array_length(storage.foldername(name), 1) = 2
  );

DROP POLICY IF EXISTS catalog_media_photos_update ON storage.objects;
CREATE POLICY catalog_media_photos_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'catalog-media'
    AND (storage.foldername(name))[1] IN (
      SELECT public.user_organization_ids()::text
    )
    AND (storage.foldername(name))[2] = 'photos'
    AND array_length(storage.foldername(name), 1) = 2
  )
  WITH CHECK (
    bucket_id = 'catalog-media'
    AND (storage.foldername(name))[1] IN (
      SELECT public.user_organization_ids()::text
    )
    AND (storage.foldername(name))[2] = 'photos'
    AND array_length(storage.foldername(name), 1) = 2
  );
