-- Category grouping: THE BCP EXCLUSIVES (AUTHORITY HIJACK) (rows 91–100)
UPDATE public.content_pillars
SET category = 'THE BCP EXCLUSIVES (AUTHORITY HIJACK)', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'The Reality Check',
    'The Mathematical Hook',
    'The ''We Need to Talk''',
    'The Paradigm Shift',
    'The Blueprint Expose',
    'The Unfair Advantage',
    'Stop Asking Me Rant',
    'The Silent Tutorial',
    'Contrarian Interview',
    'Build in Public'
  );
