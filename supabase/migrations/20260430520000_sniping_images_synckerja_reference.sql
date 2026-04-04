-- Sniping images: from synckerja-reference/supabase/migrations/create_sniping_images_table.sql
-- Requires: public.social_media_plans, public.link_comments, auth.users
-- Idempotent: safe to re-run in SQL Editor (drops trigger/policies before recreate).

-- Ensure trigger helper exists (matches hardened project style)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.sniping_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_media_plan_id uuid NOT NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  link_url text NOT NULL,
  image_path text NOT NULL,
  image_name text NOT NULL,
  image_type text,
  image_size bigint,
  link_comments_id uuid REFERENCES public.link_comments (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sniping_images_social_media_plan_id ON public.sniping_images (social_media_plan_id);
CREATE INDEX IF NOT EXISTS idx_sniping_images_link_url ON public.sniping_images (link_url);
CREATE INDEX IF NOT EXISTS idx_sniping_images_link_comments_id ON public.sniping_images (link_comments_id);
CREATE INDEX IF NOT EXISTS idx_sniping_images_created_by ON public.sniping_images (created_by);
CREATE INDEX IF NOT EXISTS idx_sniping_images_social_media_plan_link ON public.sniping_images (social_media_plan_id, link_url);

DROP TRIGGER IF EXISTS update_sniping_images_updated_at ON public.sniping_images;
CREATE TRIGGER update_sniping_images_updated_at
  BEFORE UPDATE ON public.sniping_images
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sniping_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view images in same organization" ON public.sniping_images;
CREATE POLICY "Users can view images in same organization"
  ON public.sniping_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.social_media_plans AS smp
      JOIN public.profiles AS current_user_profile ON current_user_profile.user_id = auth.uid()
      WHERE smp.id = sniping_images.social_media_plan_id
        AND current_user_profile.active_organization_id IS NOT NULL
        AND current_user_profile.active_organization_id = smp.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert images in same organization" ON public.sniping_images;
CREATE POLICY "Users can insert images in same organization"
  ON public.sniping_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.social_media_plans AS smp
      JOIN public.profiles AS current_user_profile ON current_user_profile.user_id = auth.uid()
      WHERE smp.id = sniping_images.social_media_plan_id
        AND current_user_profile.active_organization_id IS NOT NULL
        AND current_user_profile.active_organization_id = smp.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update their own images" ON public.sniping_images;
CREATE POLICY "Users can update their own images"
  ON public.sniping_images
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own images" ON public.sniping_images;
CREATE POLICY "Users can delete their own images"
  ON public.sniping_images
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

COMMENT ON TABLE public.sniping_images IS 'Stores metadata for images attached to comments in social media plans. RLS enabled: users can view images in their organization, insert/update/delete their own images.';
COMMENT ON COLUMN public.sniping_images.social_media_plan_id IS 'Reference to the social media plan this image belongs to';
COMMENT ON COLUMN public.sniping_images.link_url IS 'The URL/link this image is associated with (e.g., Google Drive link)';
COMMENT ON COLUMN public.sniping_images.image_path IS 'Path to the image file in Supabase storage bucket';
COMMENT ON COLUMN public.sniping_images.link_comments_id IS 'Optional reference to a specific comment this image is attached to';
COMMENT ON COLUMN public.sniping_images.created_by IS 'User who uploaded the image';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sniping_images TO authenticated;
GRANT ALL ON public.sniping_images TO service_role;

-- Hint PostgREST to refresh schema (hosted Supabase usually picks up DDL quickly)
NOTIFY pgrst, 'reload schema';
