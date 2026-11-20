-- Category grouping: STORYTELLING & JOURNEY (rows 11–20)
UPDATE public.content_pillars
SET category = 'STORYTELLING & JOURNEY', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Story Telling - Origin Story',
    'Story Telling - The Lowest Point',
    'Vlog - Day in the Life (DITL)',
    'Behind The Scene',
    'Before & After',
    'How I Did It Breakdown',
    'Failed Experiment',
    'Letter to Younger Self',
    'Documenting Journey',
    'The Manifesto'
  );
