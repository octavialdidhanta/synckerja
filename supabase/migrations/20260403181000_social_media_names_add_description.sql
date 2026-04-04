-- Social Media Management: add missing description column to social_media_names
-- Required by Social Media Settings UI (reference parity)

ALTER TABLE public.social_media_names
  ADD COLUMN IF NOT EXISTS description text;

