-- Category grouping: CULTURAL & TREND JACKING (rows 71–80)
UPDATE public.content_pillars
SET category = 'CULTURAL & TREND JACKING', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Meme Re-enactment',
    'Trend Audio + Text',
    'Pop Culture Analogy',
    'Holiday Specific',
    'Nostalgia Bait',
    'In and Out List',
    'Local Pride / Slang',
    'Event Recap',
    'Mythical Creatures',
    'Challenge Trend'
  );
