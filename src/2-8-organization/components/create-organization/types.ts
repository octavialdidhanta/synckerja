
export interface OrganizationFormData {
  company_name: string;
  industry: string;
  company_size: string;
  address: string;
  phone_number: string;
  website: string;
  description: string;
  terms_accepted: boolean;
}

export const initialFormData: OrganizationFormData = {
  company_name: "",
  industry: "",
  company_size: "",
  address: "",
  phone_number: "",
  website: "",
  description: "",
  terms_accepted: false,
};
