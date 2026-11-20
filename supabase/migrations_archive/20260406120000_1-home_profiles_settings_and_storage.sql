-- Settings: extended profile fields, preferred locale, public bucket employee-profiles

-- 1) profiles — personal fields + photo + UI language (per user)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS preferred_locale text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_preferred_locale_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_locale_check
      CHECK (preferred_locale IS NULL OR preferred_locale IN ('en', 'id'));
  END IF;
END $$;

-- 2) Storage bucket (public URLs for profile photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-profiles', 'employee-profiles', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 3) Storage RLS policies (objects live under "{user_id}/...")
DROP POLICY IF EXISTS "employee_profiles_public_read" ON storage.objects;
CREATE POLICY "employee_profiles_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-profiles');

DROP POLICY IF EXISTS "employee_profiles_authenticated_insert_own" ON storage.objects;
CREATE POLICY "employee_profiles_authenticated_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-profiles'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "employee_profiles_authenticated_update_own" ON storage.objects;
CREATE POLICY "employee_profiles_authenticated_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-profiles'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'employee-profiles'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "employee_profiles_authenticated_delete_own" ON storage.objects;
CREATE POLICY "employee_profiles_authenticated_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-profiles'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );
