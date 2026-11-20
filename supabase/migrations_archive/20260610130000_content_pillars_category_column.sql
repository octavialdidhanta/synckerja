-- category label for content pillar tracker (already present in some environments)
ALTER TABLE public.content_pillars
  ADD COLUMN IF NOT EXISTS category text;

COMMENT ON COLUMN public.content_pillars.category IS 'Short category label shown under pillar name in Content Pillar Tracker.';
