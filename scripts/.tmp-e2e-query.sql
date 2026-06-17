SELECT default_whatsapp_invoice_template_name, offline_conversion_enabled
FROM public.organization_omnichannel_api_settings
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a';

SELECT token_prefix, label, token_type, web_id, is_active
FROM public.organization_omnichannel_api_tokens
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
  AND is_active = true
ORDER BY created_at DESC;
