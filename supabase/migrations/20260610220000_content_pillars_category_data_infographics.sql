-- Category grouping: DATA & INFOGRAPHICS (rows 81–90)
UPDATE public.content_pillars
SET category = 'DATA & INFOGRAPHICS', updated_at = now()
WHERE is_default = true
  AND organization_id IS NULL
  AND name IN (
    'Statistik Mengejutkan',
    'Pie Chart Animation',
    'Did You Know?',
    'Timeline Sejarah',
    'Cost Breakdown',
    'Map / Geografi',
    'The Iceberg Theory',
    'Data Prediksi',
    'Survey Results',
    'ROI Calculator'
  );
