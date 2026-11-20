-- HR / org members can read attendance photos for any employee in their org(s).
-- Previous policy required the viewer to have an employees row (user_id = auth.uid()),
-- which blocked owners/admins who only have user_organization_ids() membership.

DROP POLICY IF EXISTS "attendance_photos_select_same_org" ON storage.objects;

CREATE POLICY "attendance_photos_select_same_org"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND EXISTS (
      SELECT 1
      FROM public.employees folder_owner
      WHERE folder_owner.id::text = split_part(name, '/', 1)
        AND folder_owner.organization_id IN (SELECT public.user_organization_ids())
    )
  );
