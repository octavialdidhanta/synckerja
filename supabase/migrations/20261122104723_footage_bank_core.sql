-- Footage bank, step 1: org-scoped clip metadata, scenes, custom tags, usage, and bans.
-- Original media stays on the laptop. Thumbnail and preview paths are stored here and
-- filled in a later pass. Location and product stay text labels until those pages exist.
-- Brand filters (hijab, watermark, and anything a later org needs) are tag rows, not columns.
-- No production rows are seeded.

-- ---------------------------------------------------------------------------
-- footage_assets
-- ---------------------------------------------------------------------------
CREATE TABLE public.footage_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  file_key text NOT NULL,
  media_type text NOT NULL,
  origin text NOT NULL,
  location_label text,
  product_label text,
  summary text,
  duration_seconds numeric,
  storage_status text NOT NULL DEFAULT 'inbox',
  thumb_storage_path text,
  preview_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT footage_assets_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT footage_assets_org_file_key UNIQUE (organization_id, file_key),
  CONSTRAINT footage_assets_media_type_check CHECK (media_type IN ('video', 'image')),
  CONSTRAINT footage_assets_origin_check CHECK (origin IN ('hp', 'ai', 'foto')),
  CONSTRAINT footage_assets_storage_status_check CHECK (storage_status IN ('inbox', 'bank')),
  CONSTRAINT footage_assets_file_key_check CHECK (char_length(btrim(file_key)) > 0),
  CONSTRAINT footage_assets_duration_check CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

COMMENT ON COLUMN public.footage_assets.file_key IS
  'Relative path on the laptop bank, such as INBOX/clip.mp4 or PIK2/sop/clip.mp4.';
COMMENT ON COLUMN public.footage_assets.location_label IS
  'Place name as text until location records exist.';
COMMENT ON COLUMN public.footage_assets.product_label IS
  'Product or menu name as text until product knowledge is linked.';
COMMENT ON COLUMN public.footage_assets.thumb_storage_path IS
  'Storage object path for the 240px thumbnail. Null until the file is uploaded.';
COMMENT ON COLUMN public.footage_assets.preview_storage_path IS
  'Storage object path for the 480p preview. Null until the preview exists.';

CREATE INDEX footage_assets_org_media_type_idx
  ON public.footage_assets (organization_id, media_type);
CREATE INDEX footage_assets_org_storage_status_idx
  ON public.footage_assets (organization_id, storage_status);
CREATE INDEX footage_assets_org_location_label_idx
  ON public.footage_assets (organization_id, location_label);

CREATE TRIGGER update_footage_assets_updated_at
  BEFORE UPDATE ON public.footage_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- footage_scenes
-- ---------------------------------------------------------------------------
CREATE TABLE public.footage_scenes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  asset_id uuid NOT NULL,
  start_seconds numeric NOT NULL,
  end_seconds numeric,
  scene_kind text NOT NULL,
  summary text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT footage_scenes_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT footage_scenes_id_asset_key UNIQUE (id, asset_id),
  CONSTRAINT footage_scenes_asset_start_key UNIQUE (asset_id, start_seconds),
  CONSTRAINT footage_scenes_asset_org_fkey
    FOREIGN KEY (asset_id, organization_id)
    REFERENCES public.footage_assets (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT footage_scenes_times_check CHECK (
    start_seconds >= 0
    AND (end_seconds IS NULL OR end_seconds >= start_seconds)
  ),
  CONSTRAINT footage_scenes_kind_check CHECK (char_length(btrim(scene_kind)) > 0)
);

COMMENT ON COLUMN public.footage_scenes.scene_kind IS
  'Free text. Current footage uses produk, orang, suasana, lokasi, grafis, and berita; an org may add its own.';

CREATE INDEX footage_scenes_org_asset_idx
  ON public.footage_scenes (organization_id, asset_id);
CREATE INDEX footage_scenes_org_kind_idx
  ON public.footage_scenes (organization_id, scene_kind);

CREATE TRIGGER update_footage_scenes_updated_at
  BEFORE UPDATE ON public.footage_scenes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- footage_tag_defs
-- ---------------------------------------------------------------------------
CREATE TABLE public.footage_tag_defs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  applies_to text NOT NULL,
  value_type text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT footage_tag_defs_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT footage_tag_defs_org_key UNIQUE (organization_id, key),
  CONSTRAINT footage_tag_defs_applies_to_check CHECK (applies_to IN ('asset', 'scene')),
  CONSTRAINT footage_tag_defs_value_type_check CHECK (value_type IN ('bool', 'text')),
  CONSTRAINT footage_tag_defs_key_check CHECK (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT footage_tag_defs_label_check CHECK (char_length(btrim(label)) > 0),
  CONSTRAINT footage_tag_defs_position_check CHECK (position >= 0)
);

COMMENT ON TABLE public.footage_tag_defs IS
  'Per-org footage filters. Hijab, watermark, and later brand tags are rows here, not table columns.';

CREATE TRIGGER update_footage_tag_defs_updated_at
  BEFORE UPDATE ON public.footage_tag_defs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- footage_tag_values
-- ---------------------------------------------------------------------------
CREATE TABLE public.footage_tag_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  tag_def_id uuid NOT NULL,
  asset_id uuid,
  scene_id uuid,
  value_bool boolean,
  value_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT footage_tag_values_target_check CHECK (num_nonnulls(asset_id, scene_id) = 1),
  CONSTRAINT footage_tag_values_value_check CHECK (num_nonnulls(value_bool, value_text) = 1),
  CONSTRAINT footage_tag_values_def_org_fkey
    FOREIGN KEY (tag_def_id, organization_id)
    REFERENCES public.footage_tag_defs (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT footage_tag_values_asset_org_fkey
    FOREIGN KEY (asset_id, organization_id)
    REFERENCES public.footage_assets (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT footage_tag_values_scene_org_fkey
    FOREIGN KEY (scene_id, organization_id)
    REFERENCES public.footage_scenes (id, organization_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX footage_tag_values_asset_tag_uidx
  ON public.footage_tag_values (tag_def_id, asset_id)
  WHERE asset_id IS NOT NULL;
CREATE UNIQUE INDEX footage_tag_values_scene_tag_uidx
  ON public.footage_tag_values (tag_def_id, scene_id)
  WHERE scene_id IS NOT NULL;
CREATE INDEX footage_tag_values_org_def_idx
  ON public.footage_tag_values (organization_id, tag_def_id);
CREATE INDEX footage_tag_values_tag_def_idx
  ON public.footage_tag_values (tag_def_id);
CREATE INDEX footage_tag_values_asset_idx
  ON public.footage_tag_values (asset_id)
  WHERE asset_id IS NOT NULL;
CREATE INDEX footage_tag_values_scene_idx
  ON public.footage_tag_values (scene_id)
  WHERE scene_id IS NOT NULL;

CREATE TRIGGER update_footage_tag_values_updated_at
  BEFORE UPDATE ON public.footage_tag_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- footage_usages
-- ---------------------------------------------------------------------------
CREATE TABLE public.footage_usages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  asset_id uuid NOT NULL,
  scene_id uuid,
  in_seconds numeric,
  out_seconds numeric,
  external_ref text,
  social_media_plan_id uuid REFERENCES public.social_media_plans (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT footage_usages_asset_org_fkey
    FOREIGN KEY (asset_id, organization_id)
    REFERENCES public.footage_assets (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT footage_usages_scene_org_fkey
    FOREIGN KEY (scene_id, organization_id)
    REFERENCES public.footage_scenes (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT footage_usages_scene_asset_fkey
    FOREIGN KEY (scene_id, asset_id)
    REFERENCES public.footage_scenes (id, asset_id)
    ON DELETE CASCADE,
  CONSTRAINT footage_usages_times_check CHECK (
    (in_seconds IS NULL OR in_seconds >= 0)
    AND (out_seconds IS NULL OR in_seconds IS NULL OR out_seconds >= in_seconds)
  )
);

COMMENT ON COLUMN public.footage_usages.external_ref IS
  'Content id or name from the legacy usage log when no social media plan is linked.';

CREATE INDEX footage_usages_org_asset_idx
  ON public.footage_usages (organization_id, asset_id);
CREATE INDEX footage_usages_asset_idx
  ON public.footage_usages (asset_id);
CREATE INDEX footage_usages_scene_idx
  ON public.footage_usages (scene_id)
  WHERE scene_id IS NOT NULL;
CREATE INDEX footage_usages_plan_idx
  ON public.footage_usages (social_media_plan_id)
  WHERE social_media_plan_id IS NOT NULL;

CREATE TRIGGER update_footage_usages_updated_at
  BEFORE UPDATE ON public.footage_usages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- footage_bans
-- ---------------------------------------------------------------------------
CREATE TABLE public.footage_bans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  scene_id uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT footage_bans_scene_key UNIQUE (scene_id),
  CONSTRAINT footage_bans_scene_org_fkey
    FOREIGN KEY (scene_id, organization_id)
    REFERENCES public.footage_scenes (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT footage_bans_reason_check CHECK (char_length(btrim(reason)) > 0)
);

COMMENT ON TABLE public.footage_bans IS
  'One active ban per scene. Clearing a ban deletes the row.';

CREATE INDEX footage_bans_org_idx
  ON public.footage_bans (organization_id);

CREATE TRIGGER update_footage_bans_updated_at
  BEFORE UPDATE ON public.footage_bans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.footage_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footage_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footage_tag_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footage_tag_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footage_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footage_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY footage_assets_org ON public.footage_assets
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY footage_scenes_org ON public.footage_scenes
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY footage_tag_defs_org ON public.footage_tag_defs
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY footage_tag_values_org ON public.footage_tag_values
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY footage_usages_org ON public.footage_usages
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY footage_bans_org ON public.footage_bans
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

REVOKE ALL ON TABLE public.footage_assets FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.footage_scenes FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.footage_tag_defs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.footage_tag_values FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.footage_usages FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.footage_bans FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.footage_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.footage_scenes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.footage_tag_defs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.footage_tag_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.footage_usages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.footage_bans TO authenticated;

GRANT ALL ON TABLE public.footage_assets TO service_role;
GRANT ALL ON TABLE public.footage_scenes TO service_role;
GRANT ALL ON TABLE public.footage_tag_defs TO service_role;
GRANT ALL ON TABLE public.footage_tag_values TO service_role;
GRANT ALL ON TABLE public.footage_usages TO service_role;
GRANT ALL ON TABLE public.footage_bans TO service_role;
