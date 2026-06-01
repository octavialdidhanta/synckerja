SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leads'
  AND column_name IN ('fbclid', 'meta_ads_account_id')
ORDER BY 1;
