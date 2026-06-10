-- Category grouping: AUTHORITY & EXPERT POSITIONING (content format taxonomy)
UPDATE public.content_pillars
SET category = 'AUTHORITY & EXPERT POSITIONING', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Education - Talking Head',
    'Education - Whiteboard Explanation',
    'Myth vs Fact',
    'Unpopular Opinion',
    'Education - The ''Stop Doing This''',
    'Education - [#] Kesalahan Pemula',
    'Education - Framework Breakdown',
    'Education - Industry News Hijack',
    'Resource Review',
    'Trend Prediction'
  );
