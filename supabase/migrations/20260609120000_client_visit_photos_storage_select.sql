-- Allow org members to read legacy client visit photos stored under:
--   visits/{user_id}/{file}.jpg
--   {user_id}/{file}.jpg
-- (older mobile saved paths without employee-id folder upload)

DROP POLICY IF EXISTS "attendance_photos_select_same_org" ON storage.objects;

CREATE POLICY "attendance_photos_select_same_org"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND (
      EXISTS (
        SELECT 1
        FROM public.employees folder_owner
        WHERE folder_owner.id::text = split_part(name, '/', 1)
          AND folder_owner.organization_id IN (SELECT public.user_organization_ids())
      )
      OR EXISTS (
        SELECT 1
        FROM public.employees folder_owner
        WHERE folder_owner.user_id::text = split_part(name, '/', 1)
          AND folder_owner.organization_id IN (SELECT public.user_organization_ids())
      )
      OR (
        split_part(name, '/', 1) = 'visits'
        AND EXISTS (
          SELECT 1
          FROM public.employees folder_owner
          WHERE folder_owner.user_id::text = split_part(name, '/', 2)
            AND folder_owner.organization_id IN (SELECT public.user_organization_ids())
        )
      )
    )
  );
