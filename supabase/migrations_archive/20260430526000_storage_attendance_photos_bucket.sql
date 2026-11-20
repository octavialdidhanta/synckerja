-- Bucket + RLS for attendance check-in/out photos (useSimpleAttendance: {employee_id}/check_in_*.jpg)
-- App stores object path in attendance_records; uploads use authenticated client.

INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Read: anyone in the same organization as the employee folder (split_part name = employees.id)
DROP POLICY IF EXISTS "attendance_photos_select_same_org" ON storage.objects;
CREATE POLICY "attendance_photos_select_same_org"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND EXISTS (
      SELECT 1
      FROM public.employees viewer
      JOIN public.employees folder_owner ON folder_owner.organization_id = viewer.organization_id
      WHERE viewer.user_id = (SELECT auth.uid())
        AND folder_owner.id::text = split_part(name, '/', 1)
    )
  );

-- Upload only into own employee folder (first path segment = employees.id for auth user)
DROP POLICY IF EXISTS "attendance_photos_insert_own_employee" ON storage.objects;
CREATE POLICY "attendance_photos_insert_own_employee"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-photos'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = (SELECT auth.uid())
        AND e.id::text = split_part(name, '/', 1)
    )
  );

DROP POLICY IF EXISTS "attendance_photos_update_own_employee" ON storage.objects;
CREATE POLICY "attendance_photos_update_own_employee"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = (SELECT auth.uid())
        AND e.id::text = split_part(name, '/', 1)
    )
  )
  WITH CHECK (
    bucket_id = 'attendance-photos'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = (SELECT auth.uid())
        AND e.id::text = split_part(name, '/', 1)
    )
  );

DROP POLICY IF EXISTS "attendance_photos_delete_own_employee" ON storage.objects;
CREATE POLICY "attendance_photos_delete_own_employee"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = (SELECT auth.uid())
        AND e.id::text = split_part(name, '/', 1)
    )
  );
