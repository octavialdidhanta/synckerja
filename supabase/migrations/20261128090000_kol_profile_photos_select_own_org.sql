-- kol-profile-photos: storage remove() reads the object before deleting it, so DELETE also needs a SELECT
-- policy. Without one, Remove in the Office answered 200 but deleted nothing (also before 20261128080000).
-- Members may read rows only inside their own organization folder; public links keep working (public bucket).

DROP POLICY IF EXISTS kol_profile_photos_select_own_org ON storage.objects;
CREATE POLICY kol_profile_photos_select_own_org
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kol-profile-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT public.user_organization_ids()::text
    )
  );
