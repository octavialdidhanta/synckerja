-- Store post preview metadata for campaign list (thumbnail + headline).

ALTER TABLE public.lead_magnet_campaign_posts
  ADD COLUMN IF NOT EXISTS media_caption text NULL,
  ADD COLUMN IF NOT EXISTS media_thumbnail_url text NULL;
