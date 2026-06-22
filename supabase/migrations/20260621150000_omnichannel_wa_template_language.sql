-- Org-level WhatsApp template language for public API invoice/lead sends.

ALTER TABLE public.organization_omnichannel_api_settings
  ADD COLUMN IF NOT EXISTS default_whatsapp_invoice_template_language text NULL,
  ADD COLUMN IF NOT EXISTS default_whatsapp_lead_template_language text NULL;

COMMENT ON COLUMN public.organization_omnichannel_api_settings.default_whatsapp_invoice_template_language IS
  'Meta template language code for default invoice WhatsApp template (e.g. id, en_US). Falls back to id when null.';

COMMENT ON COLUMN public.organization_omnichannel_api_settings.default_whatsapp_lead_template_language IS
  'Meta template language code for default lead WhatsApp template. Legacy organization_whatsapp_templates row takes precedence per web_id; otherwise falls back to id when null.';
