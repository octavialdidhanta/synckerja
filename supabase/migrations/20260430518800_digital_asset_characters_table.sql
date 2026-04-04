-- Digital asset characters (Social Media Settings → Digital Assets).
-- Prerequisites: public.organizations, public.user_organization_ids().

CREATE OR REPLACE FUNCTION public.update_digital_asset_characters_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.digital_asset_characters (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL,
  name text NULL,
  age text NULL,
  nationality text NULL,
  gender text NULL,
  hair_description text NULL,
  face_description text NULL,
  accessories text NULL,
  body_shape text NULL,
  height text NULL,
  additional_details text NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  reference_image_path text NULL,
  combined_prompt text NULL,
  clothing_description text NULL,
  CONSTRAINT digital_asset_characters_pkey PRIMARY KEY (id),
  CONSTRAINT digital_asset_characters_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_digital_asset_characters_organization_id ON public.digital_asset_characters USING btree (organization_id);

DROP TRIGGER IF EXISTS trigger_digital_asset_characters_updated_at ON public.digital_asset_characters;
CREATE TRIGGER trigger_digital_asset_characters_updated_at
  BEFORE UPDATE ON public.digital_asset_characters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_digital_asset_characters_updated_at();

ALTER TABLE public.digital_asset_characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digital_asset_characters_org" ON public.digital_asset_characters;
CREATE POLICY "digital_asset_characters_org" ON public.digital_asset_characters
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
