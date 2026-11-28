-- Storage P0 (audit 27 Nov 2026): close two cross-organization holes. No data is moved.
--
-- 1) kol-profile-photos: the old INSERT/DELETE policies only checked bucket_id, so any signed-in user
--    could upload or delete KOL photos of another organization. A member may now write only inside
--    <their org id>/... . The Office uploads to <org_id>/kol-profiles/<file>.
--    The two older files under kol-profiles/ stay readable through their public links (public bucket);
--    nobody can delete them from the browser any more.
--
-- 2) ai_employee_install_design_story_shell(p_employee_id, p_organization_id) is SECURITY DEFINER and wrote
--    ai_employee_sops for any organization id passed in, while authenticated could execute it directly.
--    Its only caller is ai_employee_install_content_plan, run by the trigger install_ai_employee_built_job
--    (SECURITY DEFINER, owner postgres), so direct execute is revoked like ai_employee_install_content_plan.
--    The trigger keeps working: it runs as postgres, not as the signed-in user.

-- 1) kol-profile-photos -------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated upload KOL photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete KOL photos" ON storage.objects;

DROP POLICY IF EXISTS kol_profile_photos_insert_own_org ON storage.objects;
CREATE POLICY kol_profile_photos_insert_own_org
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'kol-profile-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT public.user_organization_ids()::text
    )
  );

DROP POLICY IF EXISTS kol_profile_photos_update_own_org ON storage.objects;
CREATE POLICY kol_profile_photos_update_own_org
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'kol-profile-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT public.user_organization_ids()::text
    )
  )
  WITH CHECK (
    bucket_id = 'kol-profile-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT public.user_organization_ids()::text
    )
  );

DROP POLICY IF EXISTS kol_profile_photos_delete_own_org ON storage.objects;
CREATE POLICY kol_profile_photos_delete_own_org
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'kol-profile-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT public.user_organization_ids()::text
    )
  );

-- 2) ai_employee_install_design_story_shell ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.ai_employee_install_design_story_shell(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_employee_install_design_story_shell(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ai_employee_install_design_story_shell(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ai_employee_install_design_story_shell(uuid, uuid) TO service_role;
