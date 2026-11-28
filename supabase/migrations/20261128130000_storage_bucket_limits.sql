-- Storage P1 "Rem biaya": upload size and file type limits per bucket, approved by the owner on 28 Nov 2026.
-- Values match src/shared/storage/bucketLimits.ts (a test keeps them in step). Measured beforehand: largest files are
-- a 45 MB PDF and a 9.6 MB video in whatsapp-media (customer messages); every other bucket stays under 5 MB.
-- Limits apply to every upload, edge functions included, so whatsapp-media allows any type up to 100 MB.
-- Buckets that already had limits (catalog-media, blog-media, ai-employee-references, ...) are not touched.
-- Existing files are not checked again.

UPDATE storage.buckets SET file_size_limit = 104857600, allowed_mime_types = NULL WHERE id = 'whatsapp-media';
UPDATE storage.buckets SET file_size_limit = 52428800, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/wave']::text[] WHERE id = 'brief-visual-images';
UPDATE storage.buckets SET file_size_limit = 52428800, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'video/mp4', 'video/quicktime']::text[] WHERE id = 'social-media-story';
UPDATE storage.buckets SET file_size_limit = 26214400, allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']::text[] WHERE id = 'lead-magnet-assets';
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/csv', 'application/zip', 'application/x-zip-compressed', 'application/vnd.rar', 'application/x-rar-compressed', 'audio/*', 'video/*', 'application/octet-stream']::text[] WHERE id = 'task-files';
UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'application/octet-stream']::text[] WHERE id = 'recruitment-files';
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp']::text[] WHERE id = 'social-media-carousel';
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp']::text[] WHERE id = 'digital-asset-character-images';
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp']::text[] WHERE id = 'catalog-product-photos';
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'application/pdf']::text[] WHERE id = 'expense-receipts';
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'application/pdf']::text[] WHERE id = 'income-receipts';
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'application/pdf']::text[] WHERE id = 'debt-payment-receipts';
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'application/pdf']::text[] WHERE id = 'purchase-documents';
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'application/pdf']::text[] WHERE id = 'sales-receipts';
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/csv', 'application/octet-stream']::text[] WHERE id = 'employee-documents';
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/csv', 'application/octet-stream']::text[] WHERE id = 'company-files';
UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp']::text[] WHERE id = 'kol-profile-photos';
UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp']::text[] WHERE id = 'employee-profiles';
UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp']::text[] WHERE id = 'company-profiles';
UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp']::text[] WHERE id = 'invoice-template-logos';
UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp']::text[] WHERE id = 'sniping-images';
UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/bmp']::text[] WHERE id = 'digital-asset-company-logos';
UPDATE storage.buckets SET file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[] WHERE id = 'attendance-photos';

-- employee-profiles: any signed-in user could list and read every organization's employee photos.
-- Now: your own folder (<user_id>/...) or the folder of a user who shares one of your organizations.
-- The bucket stays public for now, so photo links already shown in the app keep working.
DROP POLICY IF EXISTS employee_profiles_select_authenticated ON storage.objects;
DROP POLICY IF EXISTS employee_profiles_select_same_org ON storage.objects;
CREATE POLICY employee_profiles_select_same_org
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'employee-profiles'
    AND (
      split_part(name, '/', 1) = (SELECT auth.uid())::text
      OR EXISTS (
        SELECT 1
        FROM public.user_organizations uo
        WHERE uo.user_id::text = split_part(name, '/', 1)
          AND uo.organization_id IN (SELECT public.user_organization_ids())
      )
    )
  );

-- brief-visual-images: two copies of the read and write policies. Keep one set; compare the folder as text so a
-- folder that is not a UUID is simply refused instead of raising a cast error.
DROP POLICY IF EXISTS brief_visual_images_select_public ON storage.objects;
DROP POLICY IF EXISTS brief_visual_images_insert_org ON storage.objects;
DROP POLICY IF EXISTS brief_visual_images_delete_org ON storage.objects;

DROP POLICY IF EXISTS brief_visual_images_authenticated_insert_org ON storage.objects;
CREATE POLICY brief_visual_images_authenticated_insert_org
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'brief-visual-images'
    AND (storage.foldername(name))[1] IN (SELECT public.user_organization_ids()::text)
  );

DROP POLICY IF EXISTS brief_visual_images_authenticated_update_org ON storage.objects;
CREATE POLICY brief_visual_images_authenticated_update_org
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'brief-visual-images'
    AND (storage.foldername(name))[1] IN (SELECT public.user_organization_ids()::text)
  )
  WITH CHECK (
    bucket_id = 'brief-visual-images'
    AND (storage.foldername(name))[1] IN (SELECT public.user_organization_ids()::text)
  );

DROP POLICY IF EXISTS brief_visual_images_authenticated_delete_org ON storage.objects;
CREATE POLICY brief_visual_images_authenticated_delete_org
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'brief-visual-images'
    AND (storage.foldername(name))[1] IN (SELECT public.user_organization_ids()::text)
  );
