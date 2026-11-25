-- F&B starter tags are the ones every restaurant can use.
-- Lengkuas and Meja biru stay on organizations that already saved them.
-- A new restaurant that applies F&B no longer receives those two keys.

DELETE FROM public.catalog_industry_template_tags
WHERE template_code = 'fnb'
  AND key IN ('lengkuas', 'meja_biru');
