-- Office shows the still-preview sheet the Agent uploads (<org>/render-stills/<job>.jpg) in the render queue:
-- members of the organization may read that folder too (read only; only the Agent writes it, with a signed URL).
DROP POLICY IF EXISTS catalog_media_select ON storage.objects;
CREATE POLICY catalog_media_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'catalog-media'
    AND (storage.foldername(name))[1] IN (
      SELECT public.user_organization_ids()::text
    )
    AND (storage.foldername(name))[2] IN ('thumbs', 'photos', 'previews', 'render-stills')
  );
