-- Bucket + RLS for social media comment sniping images (OptimizedCommentPanel upload path: {auth.uid()}/file)
-- Mirrors pattern from 20260406120000_1-home_profiles_settings_and_storage.sql (employee-profiles).

INSERT INTO storage.buckets (id, name, public)
VALUES ('sniping-images', 'sniping-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "sniping_images_public_read" ON storage.objects;
CREATE POLICY "sniping_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sniping-images');

DROP POLICY IF EXISTS "sniping_images_authenticated_insert_own" ON storage.objects;
CREATE POLICY "sniping_images_authenticated_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sniping-images'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "sniping_images_authenticated_update_own" ON storage.objects;
CREATE POLICY "sniping_images_authenticated_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sniping-images'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'sniping-images'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "sniping_images_authenticated_delete_own" ON storage.objects;
CREATE POLICY "sniping_images_authenticated_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sniping-images'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );
