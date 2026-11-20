-- Multi-pose character reference images (max 12 per character, one primary).
-- Keeps digital_asset_characters.reference_image_path as primary path (backward compatible).

CREATE OR REPLACE FUNCTION public.update_digital_asset_character_images_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.digital_asset_character_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  character_id uuid NOT NULL,
  storage_path text NOT NULL,
  pose_key text NOT NULL,
  label_custom text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT digital_asset_character_images_pkey PRIMARY KEY (id),
  CONSTRAINT digital_asset_character_images_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT digital_asset_character_images_character_id_fkey
    FOREIGN KEY (character_id) REFERENCES public.digital_asset_characters (id) ON DELETE CASCADE,
  CONSTRAINT digital_asset_character_images_pose_key_check
    CHECK (
      pose_key IN (
        'front_closeup',
        'face_left',
        'face_right',
        'looking_down',
        'looking_up',
        'sitting',
        'from_behind',
        'laughing',
        'neutral',
        'full_body',
        'custom'
      )
    ),
  CONSTRAINT digital_asset_character_images_custom_label_check
    CHECK (
      (pose_key = 'custom' AND label_custom IS NOT NULL AND length(trim(label_custom)) > 0)
      OR (pose_key <> 'custom')
    )
);

CREATE INDEX IF NOT EXISTS idx_digital_asset_character_images_character_id
  ON public.digital_asset_character_images USING btree (character_id);

CREATE INDEX IF NOT EXISTS idx_digital_asset_character_images_organization_id
  ON public.digital_asset_character_images USING btree (organization_id);

-- At most one primary image per character
CREATE UNIQUE INDEX IF NOT EXISTS digital_asset_character_images_one_primary
  ON public.digital_asset_character_images (character_id)
  WHERE is_primary = true;

-- Non-custom pose keys unique per character
CREATE UNIQUE INDEX IF NOT EXISTS digital_asset_character_images_unique_preset_pose
  ON public.digital_asset_character_images (character_id, pose_key)
  WHERE pose_key <> 'custom';

DROP TRIGGER IF EXISTS trigger_digital_asset_character_images_updated_at
  ON public.digital_asset_character_images;
CREATE TRIGGER trigger_digital_asset_character_images_updated_at
  BEFORE UPDATE ON public.digital_asset_character_images
  FOR EACH ROW
  EXECUTE FUNCTION public.update_digital_asset_character_images_updated_at();

-- Enforce max 12 images per character
CREATE OR REPLACE FUNCTION public.enforce_digital_asset_character_images_max()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  img_count integer;
BEGIN
  SELECT count(*)::integer INTO img_count
  FROM public.digital_asset_character_images
  WHERE character_id = NEW.character_id;

  IF TG_OP = 'INSERT' AND img_count >= 12 THEN
    RAISE EXCEPTION 'Maximum of 12 images per character';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_digital_asset_character_images_max
  ON public.digital_asset_character_images;
CREATE TRIGGER trigger_digital_asset_character_images_max
  BEFORE INSERT ON public.digital_asset_character_images
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_digital_asset_character_images_max();

ALTER TABLE public.digital_asset_character_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digital_asset_character_images_org" ON public.digital_asset_character_images;
CREATE POLICY "digital_asset_character_images_org" ON public.digital_asset_character_images
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- Backfill from existing primary reference_image_path
INSERT INTO public.digital_asset_character_images (
  organization_id,
  character_id,
  storage_path,
  pose_key,
  label_custom,
  sort_order,
  is_primary
)
SELECT
  c.organization_id,
  c.id,
  c.reference_image_path,
  'full_body',
  NULL,
  0,
  true
FROM public.digital_asset_characters c
WHERE c.reference_image_path IS NOT NULL
  AND length(trim(c.reference_image_path)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.digital_asset_character_images i
    WHERE i.character_id = c.id
  );
