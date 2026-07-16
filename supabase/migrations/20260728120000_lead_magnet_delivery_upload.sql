-- Lead Magnet: delivery mode link vs uploaded file metadata.

ALTER TABLE public.lead_magnet_campaigns
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS delivery_storage_path text NULL,
  ADD COLUMN IF NOT EXISTS delivery_file_name text NULL,
  ADD COLUMN IF NOT EXISTS delivery_file_mime text NULL,
  ADD COLUMN IF NOT EXISTS delivery_file_size_bytes bigint NULL;

ALTER TABLE public.lead_magnet_campaigns
  DROP CONSTRAINT IF EXISTS lead_magnet_campaigns_delivery_mode_chk;

ALTER TABLE public.lead_magnet_campaigns
  ADD CONSTRAINT lead_magnet_campaigns_delivery_mode_chk
  CHECK (delivery_mode IN ('link', 'upload'));

UPDATE public.lead_magnet_campaigns
SET delivery_mode = 'link'
WHERE delivery_mode IS NULL OR delivery_mode NOT IN ('link', 'upload');

COMMENT ON COLUMN public.lead_magnet_campaigns.delivery_mode IS
  'link = external HTTPS URL in delivery_url; upload = file hosted in lead-magnet-assets bucket.';
COMMENT ON COLUMN public.lead_magnet_campaigns.delivery_storage_path IS
  'Storage object path: {org_id}/{campaign_id}/{uuid}_{filename}';
COMMENT ON COLUMN public.lead_magnet_campaigns.delivery_file_name IS
  'Original uploaded filename for UI display.';
COMMENT ON COLUMN public.lead_magnet_campaigns.delivery_file_mime IS
  'MIME type of uploaded delivery asset.';
COMMENT ON COLUMN public.lead_magnet_campaigns.delivery_file_size_bytes IS
  'Byte size of uploaded delivery asset.';
