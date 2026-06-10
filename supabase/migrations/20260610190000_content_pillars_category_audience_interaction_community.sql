-- Category grouping: AUDIENCE INTERACTION & COMMUNITY (rows 51–60)
UPDATE public.content_pillars
SET category = 'AUDIENCE INTERACTION & COMMUNITY', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Baca Komen Haters',
    'Follower Tries...',
    'Deep Dive QnA',
    'Vote / Polling',
    'Giveaway Edukatif',
    'Help Me Decide',
    'Live Highlights',
    'Community Shoutout',
    'Minta Di-Roast',
    'Surprise Follower'
  );
