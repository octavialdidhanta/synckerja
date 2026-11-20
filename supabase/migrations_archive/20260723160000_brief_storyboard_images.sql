-- Brief storyboard images for the image-only second storyboard column.
-- Storage path convention: {organization_id}/{social_media_plan_id}/{row_index}/{uuid}.{ext}

CREATE TABLE IF NOT EXISTS public.brief_storyboard_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans(id) ON DELETE CASCADE,
  row_index integer NOT NULL CHECK (row_index >= 0),
  column_index smallint NOT NULL DEFAULT 1 CHECK (column_index >= 0),
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL CHECK (file_size > 0),
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brief_storyboard_images_unique_position
    UNIQUE (social_media_plan_id, row_index, column_index, sort_order)
);

CREATE INDEX IF NOT EXISTS brief_storyboard_images_plan_row_col_idx
  ON public.brief_storyboard_images (social_media_plan_id, row_index, column_index, sort_order);

DROP TRIGGER IF EXISTS set_brief_storyboard_images_updated_at ON public.brief_storyboard_images;
CREATE TRIGGER set_brief_storyboard_images_updated_at
BEFORE UPDATE ON public.brief_storyboard_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.brief_storyboard_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brief_storyboard_images_org_all" ON public.brief_storyboard_images;
CREATE POLICY "brief_storyboard_images_org_all" ON public.brief_storyboard_images
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.social_media_plans smp
      WHERE smp.id = brief_storyboard_images.social_media_plan_id
        AND smp.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.social_media_plans smp
      WHERE smp.id = brief_storyboard_images.social_media_plan_id
        AND smp.organization_id IN (SELECT public.user_organization_ids())
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('brief-visual-images', 'brief-visual-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "brief_visual_images_public_read" ON storage.objects;
CREATE POLICY "brief_visual_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brief-visual-images');

DROP POLICY IF EXISTS "brief_visual_images_authenticated_insert_org" ON storage.objects;
CREATE POLICY "brief_visual_images_authenticated_insert_org"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brief-visual-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "brief_visual_images_authenticated_update_org" ON storage.objects;
CREATE POLICY "brief_visual_images_authenticated_update_org"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brief-visual-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    bucket_id = 'brief-visual-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "brief_visual_images_authenticated_delete_org" ON storage.objects;
CREATE POLICY "brief_visual_images_authenticated_delete_org"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'brief-visual-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.user_organization_ids())
  );
