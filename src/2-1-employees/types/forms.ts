
export interface EmployeeFormData {
  // Personal Data
  name: string;
  email: string;
  mobile_phone: string;
  birth_place: string;
  birth_date: string;
  gender: string;
  marital_status: string;
  religion: string;
  nik: string;
  postal_code: string;
  citizen_address: string;
  address: string;
  blood_type?: string;
  nationality?: string;
  
  // Personal Documents
  id_card_file?: string;
  family_card_file?: string;
  cv_file?: string;
  
  // Employment Data
  /** Required for new non-owner employees; must satisfy manager rules */
  manager_id: string;
  department_id: string;
  job_position_id: string;
  job_level_id: string;
  branch_id: string;
  join_date: string;
  hire_date: string;
  
  // Employment Documents
  contract_file?: string;
  certificate_files?: string[];
  
  // Employee Info
  role: string;
  employee_status_id: string;
  /** @deprecated use employee_status_id */
  status?: string;
  employee_id?: string;
}

export interface AddEmployeePageState {
  activeTab: string;
  formData: EmployeeFormData;
  isSubmitting: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "date" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: SelectOption[];
  validation?: (value: string) => boolean;
  helpText?: string;
}

export interface CRUDOption {
  id: string;
  title?: string;
  name?: string;
  organization_id?: string;
}

export interface CreateEmployeeResult {
  success: boolean;
  employee_id: string;
  employee_number: string;
  profile_id: string;
  email: string;
  magic_link_sent: boolean;
}
