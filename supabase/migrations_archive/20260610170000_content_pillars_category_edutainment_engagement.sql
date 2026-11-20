-- Category grouping: EDUTAINMENT & ENGAGEMENT (rows 31–40)
UPDATE public.content_pillars
SET category = 'EDUTAINMENT & ENGAGEMENT', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Skit / Roleplay',
    'Reaction / Stitch',
    'POV (Point of View)',
    'Rating Things (1-10)',
    'This vs That',
    'Challenge 7 Hari',
    'B-Roll Storytelling',
    'Rapid Fire QnA',
    'Green Screen BG',
    'The ''Roast My...'''
  );
