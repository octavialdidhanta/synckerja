-- Columns the legacy CSVs need so a re-run updates the same row instead of inserting another.

ALTER TABLE public.footage_scenes
  ADD COLUMN scene_index integer NOT NULL,
  ADD CONSTRAINT footage_scenes_index_check CHECK (scene_index >= 1),
  ADD CONSTRAINT footage_scenes_asset_index_key UNIQUE (asset_id, scene_index);

COMMENT ON COLUMN public.footage_scenes.scene_index IS
  '1-based scene number from the legacy katalog_scene.csv. Upsert identity together with the asset.';

ALTER TABLE public.footage_assets
  ADD COLUMN note text;

COMMENT ON COLUMN public.footage_assets.note IS
  'Clip note from the legacy katalog.csv catatan column.';

ALTER TABLE public.footage_usages
  ADD COLUMN title text;

COMMENT ON COLUMN public.footage_usages.title IS
  'Video title from the legacy usage log.';

CREATE UNIQUE INDEX footage_usages_identity_uidx
  ON public.footage_usages (organization_id, asset_id, external_ref, in_seconds, out_seconds);
