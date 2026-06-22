-- Drop legacy unique (organization_id, web_id) — mapping is per web_id + template_name + language.
ALTER TABLE public.organization_whatsapp_templates
  DROP CONSTRAINT IF EXISTS organization_whatsapp_templates_org_web_unique;
