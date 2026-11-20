-- Category grouping: SOCIAL PROOF & CASE STUDY (rows 21–30)
UPDATE public.content_pillars
SET category = 'SOCIAL PROOF & CASE STUDY', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Client Transformation',
    '1-Minute Case Study',
    'Screenshot Proof',
    'Client Interview',
    'Handling Objections',
    'Audit Akun Publik',
    'The ''We F*cked Up''',
    'Milestone Celebration',
    'UGC Highlight',
    'The ''I Told You So'''
  );
