-- Storage bucket for social media carousel JPG uploads (content review / Vidprompter).
-- App paths: {organization_id}/{social_media_plan_id}/{uuid}.jpg
-- Used by: src/6-1-dashboard/hook/useCarouselImages.ts (CAROUSEL_BUCKET)
-- Public read so PublicContentReviewPage can render carousel previews via getPublicUrl.

INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media-carousel', 'social-media-carousel', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "social_media_carousel_public_read" ON storage.objects;
CREATE POLICY "social_media_carousel_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'social-media-carousel');

DROP POLICY IF EXISTS "social_media_carousel_authenticated_insert_org" ON storage.objects;
CREATE POLICY "social_media_carousel_authenticated_insert_org"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'social-media-carousel'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "social_media_carousel_authenticated_update_org" ON storage.objects;
CREATE POLICY "social_media_carousel_authenticated_update_org"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'social-media-carousel'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    bucket_id = 'social-media-carousel'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "social_media_carousel_authenticated_delete_org" ON storage.objects;
CREATE POLICY "social_media_carousel_authenticated_delete_org"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'social-media-carousel'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  );
