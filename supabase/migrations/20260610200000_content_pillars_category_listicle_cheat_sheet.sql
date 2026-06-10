-- Category grouping: LISTICLE & CHEAT SHEET (rows 61–70)
UPDATE public.content_pillars
SET category = 'LISTICLE & CHEAT SHEET', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Top 5 Tools',
    '3 Langkah Cepat',
    'Checklist Harian',
    'Red Flags',
    'Green Flags',
    'Starter Pack',
    'Do''s and Don''ts',
    'Cheat Sheet Rumus',
    'My Favorite...',
    'The ''Save This'' Matrix'
  );
