SELECT a.meta_access_token AS account_token, a.whatsapp_business_account_id AS account_waba, a.whatsapp_business_name
FROM public.organization_whatsapp_accounts a
WHERE a.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
  AND a.is_active = true
  AND a.meta_access_token IS NOT NULL
  AND trim(a.meta_access_token) <> ''
ORDER BY a.updated_at DESC;
