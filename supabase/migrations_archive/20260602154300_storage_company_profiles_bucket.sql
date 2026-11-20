-- Company profile logo storage bucket (public URLs).
-- Fix "Bucket not found" on Company Profile photo upload.

INSERT INTO storage.buckets (id, name, public)
VALUES ('company-profiles', 'company-profiles', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Public read for logos (rendered in app UI)
DROP POLICY IF EXISTS "company_profiles_public_read" ON storage.objects;
CREATE POLICY "company_profiles_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-profiles');

-- Authenticated writes: only for active org and only for object names starting with "{orgId}-..."
-- Current app convention: `${organizationId}-${Date.now()}.${ext}`
DROP POLICY IF EXISTS "company_profiles_authenticated_insert_org" ON storage.objects;
CREATE POLICY "company_profiles_authenticated_insert_org"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-profiles'
    AND substring(name from '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')::uuid
      IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "company_profiles_authenticated_update_org" ON storage.objects;
CREATE POLICY "company_profiles_authenticated_update_org"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-profiles'
    AND substring(name from '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')::uuid
      IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    bucket_id = 'company-profiles'
    AND substring(name from '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')::uuid
      IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "company_profiles_authenticated_delete_org" ON storage.objects;
CREATE POLICY "company_profiles_authenticated_delete_org"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-profiles'
    AND substring(name from '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')::uuid
      IN (SELECT public.user_organization_ids())
  );

