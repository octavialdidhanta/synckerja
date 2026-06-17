SELECT template_name, template_language, body_keys, body_parameter_names, is_active, web_id, left(components_json::text, 500) AS components_preview
FROM public.organization_whatsapp_templates
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a';
