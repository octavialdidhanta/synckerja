-- Stamp / signature image for invoice template (left signature area on PDF).

ALTER TABLE public.invoice_templates
  ADD COLUMN IF NOT EXISTS company_signature_path text NULL;

COMMENT ON COLUMN public.invoice_templates.company_signature_path IS
  'Storage object path in bucket invoice-template-logos ({organization_id}/invoice-template-signatures/...).';
