-- Invoice templates for sales activity invoice preview (PaymentUpdateModal / InvoicePreviewModal).
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE policies.

CREATE TABLE IF NOT EXISTS public.invoice_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  template_name text NOT NULL,
  company_name text NULL,
  company_phone text NULL,
  company_email text NULL,
  company_address text NULL,
  invoice_description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_templates_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_templates_organization_id
  ON public.invoice_templates (organization_id);

CREATE INDEX IF NOT EXISTS idx_invoice_templates_org_active_name
  ON public.invoice_templates (organization_id, template_name)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS update_invoice_templates_updated_at ON public.invoice_templates;
CREATE TRIGGER update_invoice_templates_updated_at
  BEFORE UPDATE ON public.invoice_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_templates_org_select" ON public.invoice_templates;
CREATE POLICY "invoice_templates_org_select"
  ON public.invoice_templates FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "invoice_templates_org_insert" ON public.invoice_templates;
CREATE POLICY "invoice_templates_org_insert"
  ON public.invoice_templates FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "invoice_templates_org_update" ON public.invoice_templates;
CREATE POLICY "invoice_templates_org_update"
  ON public.invoice_templates FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "invoice_templates_org_delete" ON public.invoice_templates;
CREATE POLICY "invoice_templates_org_delete"
  ON public.invoice_templates FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));
