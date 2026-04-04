export interface InvoiceTemplate {
  id: string;
  organization_id: string;
  template_name: string;
  company_name?: string;
  company_phone?: string;
  company_email?: string;
  company_address?: string;
  invoice_description?: string;
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
}
