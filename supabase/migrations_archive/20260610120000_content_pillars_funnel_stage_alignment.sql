-- Align default content_pillars funnel_stage with TOFU / MOFU / BOFU intent.
-- top = Awareness, middle = Consideration, bottom = Conversion

-- Awareness: reach, brand story, trends, entertainment, broad education
UPDATE public.content_pillars
SET funnel_stage = 'top', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Build in Public',
    'The Manifesto',
    'Documenting Journey',
    'Vlog - Day in the Life (DITL)',
    'Event Recap',
    'Challenge Trend',
    'Rating Things (1-10)',
    'Rapid Fire QnA'
  );

-- Consideration: tutorials, comparisons, trust-building, product evaluation
UPDATE public.content_pillars
SET funnel_stage = 'middle', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Top 5 Tools',
    'This vs That',
    '3 Langkah Cepat',
    'Surprise Follower'
  );

-- Conversion: demos, offers, proof, objection handling, direct purchase intent
UPDATE public.content_pillars
SET funnel_stage = 'bottom', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Product Demo HACK',
    'Handling Objections',
    'Don''t Buy This If...',
    'Follower Tries...',
    'Packaging ASMR',
    'Giveaway Edukatif'
  );

-- Missing description on promotional pillar
UPDATE public.content_pillars
SET
  description = 'Penawaran bundling untuk mendorong pembelian langsung.',
  updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name = 'Buy 1 Get 1'
  AND (description IS NULL OR btrim(description) = '');
