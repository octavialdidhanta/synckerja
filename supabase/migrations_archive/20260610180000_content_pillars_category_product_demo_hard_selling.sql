-- Category grouping: PRODUCT DEMO & HARD SELLING (rows 41–50)
UPDATE public.content_pillars
SET category = 'PRODUCT DEMO & HARD SELLING', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Product Demo HACK',
    'Packaging ASMR',
    'Why It Costs This Much',
    'Feature Highlight',
    'Restock Alert',
    'Don''t Buy This If...',
    'Founders Pitch',
    'Tour Tempat Usaha',
    'Flash Sale Hook',
    'Competitor Compare'
  );
