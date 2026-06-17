SELECT default_whatsapp_invoice_template_name, offline_conversion_enabled
FROM public.organization_omnichannel_api_settings
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a';

SELECT id, phone_number_id, is_active, whatsapp_business_name, display_phone_number
FROM public.organization_whatsapp_accounts
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a';
