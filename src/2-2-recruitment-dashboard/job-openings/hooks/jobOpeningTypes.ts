
export type JobOpening = {
  id: string;
  organization_id?: string;
  department_id?: string;
  job_position_id?: string;
  job_level_id?: string;
  employment_status_id?: string;
  job_title: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  job_description?: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: JobBenefit[];
  status: 'active' | 'inactive' | 'draft' | 'closed';
  posted_date?: string;
  closing_date?: string;
  clicks?: number;
  submissions?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  // Relations for display
  departments?: {
    name: string;
  };
  job_positions?: {
    name: string;
  };
  job_levels?: {
    name: string;
  };
  employee_statuses?: {
    name: string;
  };
  creator_profile?: {
    full_name: string;
    email: string;
  } | null;
};

export interface JobBenefit {
  title: string;
  description: string;
}

export interface JobOpeningFormData {
  job_title: string;
  department_id: string;
  job_position_id: string;
  job_level_id: string;
  employment_status_id: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  job_description?: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: JobBenefit[];
  status: 'active' | 'inactive' | 'draft' | 'closed';
  closing_date?: string;
}
