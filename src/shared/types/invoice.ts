export interface InvoiceTemplate {
  id: string;
  organization_id: string;
  template_name: string;
  company_name?: string;
  company_phone?: string;
  company_email?: string;
  company_address?: string;
  invoice_description?: string;
  /** Storage path in bucket `invoice-template-logos`. */
  company_logo_path?: string | null;
  /** Stamp/signature image for left signature block on invoice PDF. */
  company_signature_path?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface InvoiceTemplateFormData {
  template_name: string;
  company_name: string;
  company_phone: string;
  company_email: string;
  company_address: string;
  invoice_description: string;
  company_logo_path?: string | null;
  company_signature_path?: string | null;
}
